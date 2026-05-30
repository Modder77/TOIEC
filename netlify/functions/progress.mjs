// =====================================================================
// netlify/functions/progress.mjs — Synchronisation de la progression
// ---------------------------------------------------------------------
// Routé sur /api/progress. Stocke la progression par pseudo dans
// Netlify Blobs, pour la retrouver depuis n'importe quel appareil.
//
// PIN optionnel : s'il est défini pour un pseudo, il est exigé pour lire
// ET écrire ce pseudo. Ce n'est PAS une authentification forte — les
// données (scores TOEIC) sont peu sensibles ; le PIN évite simplement
// qu'un autre pseudo identique écrase ta progression.
//
//   GET  /api/progress?user=<pseudo>[&pin=<pin>]
//        → { exists, hasPin, progress }  (403 si PIN requis/incorrect)
//   POST /api/progress  { user, pin?, progress }
//        → { ok, hasPin }                (403 si PIN incorrect)
// =====================================================================
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes } from "node:crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

// Normalise le pseudo : minuscules, alphanum + tiret/underscore, 40 max.
const normUser = (u) =>
  String(u || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);

const hashPin = (pin, salt) =>
  createHash("sha256").update(salt + ":" + String(pin)).digest("hex");

// true si l'accès est autorisé (pas de PIN défini, ou PIN fourni correct).
const pinOk = (rec, pin) => !rec.pinHash || (!!pin && hashPin(pin, rec.salt) === rec.pinHash);

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const store = getStore("toeic-progress");

  if (req.method === "GET") {
    const url = new URL(req.url);
    const user = normUser(url.searchParams.get("user"));
    const pin = url.searchParams.get("pin") || "";
    if (!user) return json({ error: "Pseudo requis." }, 400);

    const rec = await store.get(user, { type: "json" });
    if (!rec) return json({ exists: false, hasPin: false, progress: {} });
    if (!pinOk(rec, pin)) return json({ error: "PIN incorrect.", protected: true }, 403);
    return json({ exists: true, hasPin: !!rec.pinHash, progress: rec.progress || {} });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "JSON invalide." }, 400); }

    const user = normUser(body.user);
    const pin = body.pin != null ? String(body.pin) : "";
    const progress = body.progress;
    if (!user) return json({ error: "Pseudo requis." }, 400);
    if (typeof progress !== "object" || progress === null || Array.isArray(progress)) {
      return json({ error: "Progression invalide." }, 400);
    }

    const rec = await store.get(user, { type: "json" });
    if (rec && !pinOk(rec, pin)) return json({ error: "PIN incorrect.", protected: true }, 403);

    const salt = rec?.salt || randomBytes(8).toString("hex");
    let pinHash = rec?.pinHash || null;
    if (!pinHash && pin) pinHash = hashPin(pin, salt); // définit le PIN (à la création ou plus tard)

    await store.setJSON(user, {
      salt,
      pinHash,
      progress,
      updatedAt: new Date().toISOString(),
    });
    return json({ ok: true, hasPin: !!pinHash });
  }

  return json({ error: "Méthode non autorisée." }, 405);
};

export const config = { path: "/api/progress" };
