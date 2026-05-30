// =====================================================================
// netlify/functions/chat.mjs — Proxy serverless vers l'API Anthropic (Netlify)
// ---------------------------------------------------------------------
// Netlify Functions v2 (standard web : Request/Response, fetch global).
// Routé sur /api/chat via `export const config = { path: "/api/chat" }`.
//
// La clé API n'est JAMAIS envoyée au navigateur : elle est lue depuis la
// variable d'environnement ANTHROPIC_API_KEY que tu configures dans le
// dashboard Netlify (Site configuration → Environment variables).
//
// Le frontend envoie { messages, system, max_tokens, model } en POST,
// le serveur ajoute la clé secrète, appelle Anthropic, renvoie la réponse.
// Aucune dépendance npm : on utilise le fetch global (Node 18+).
// =====================================================================

const DEFAULT_MODEL = "claude-sonnet-4-6"; // qualité quasi-Opus, rapide, ~3¢/correction
const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-7",
]);

// En-têtes CORS (utile si tu testes depuis un autre domaine ; sinon same-origin).
// Ils sont ajoutés à TOUTES les réponses, comme dans la version Vercel.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (req, context) => {
  // --- Préflight CORS ---
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // --- Health-check léger : ne consomme AUCUN token ---
  // Le frontend l'appelle au démarrage pour savoir si l'IA est dispo.
  if (req.method === "GET") {
    return Response.json({ ok: true, hasKey: !!apiKey }, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Méthode non autorisée. Utilise POST." },
      { status: 405, headers: CORS_HEADERS }
    );
  }

  if (!apiKey) {
    return Response.json(
      { error: "Clé API non configurée. Ajoute ANTHROPIC_API_KEY dans les variables d'environnement Netlify." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // Parse du body JSON (en standard web, on lit le corps via req.json())
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { messages, system, max_tokens, model } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "Le champ 'messages' (tableau non vide) est requis." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Garde-fou usage perso : on plafonne pour éviter les surprises de facturation
  const safeMaxTokens = Math.min(Math.max(parseInt(max_tokens, 10) || 1500, 1), 4096);
  const safeModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;

  const payload = {
    model: safeModel,
    max_tokens: safeMaxTokens,
    messages,
  };
  if (system && typeof system === "string") payload.system = system;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      // On relaie l'erreur Anthropic telle quelle (utile pour debugger)
      return Response.json(
        { error: data?.error?.message || "Erreur de l'API Anthropic", detail: data },
        { status: anthropicRes.status, headers: CORS_HEADERS }
      );
    }

    // On extrait le texte pour simplifier le frontend, tout en renvoyant le brut
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return Response.json({ text, raw: data, model: safeModel }, { headers: CORS_HEADERS });
  } catch (err) {
    return Response.json(
      { error: "Échec de la requête vers Anthropic.", detail: String(err) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// Route la fonction directement sur /api/chat (Netlify Functions v2).
// Le contrat attendu par le frontend (index.html) reste donc identique.
export const config = { path: "/api/chat" };
