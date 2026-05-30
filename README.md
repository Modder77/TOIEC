# Atelier TOEIC — PWA augmentée par l'IA

Entraîneur TOEIC complet, installable sur iPhone/Android, avec correction et conseils par l'IA Claude.

## Ce que contient l'app

**8 modules**
1. **Vocabulaire** — 6 thèmes (~90 mots), cartes mémoire + quiz, audio
2. **Listening** — conversations et annonces (synthèse vocale), questions
3. **Reading** — textes professionnels **+ textes générés par l'IA à la volée**
4. **Grammar** — banque de 30 questions Part 5 **+ questions générées par l'IA**
5. **Writing** — rédaction avec **correction IA détaillée** (note, points forts, reformulations)
6. **Speaking** — expression orale : reconnaissance vocale + **évaluation IA** de la transcription
7. **Tuteur IA** — chatbot pour poser toutes tes questions d'anglais / TOEIC
8. **Examen blanc** — simulation chronométrée 20 min avec score

Plus : un **tableau de bord** avec suivi de progression et **conseils personnalisés générés par l'IA**, et un onglet **Paramètres** (statut IA, stats, réinitialisation).

## Architecture

```
toeic-app/
├── index.html              ← toute l'app (frontend, un seul fichier)
├── netlify/
│   └── functions/
│       └── chat.mjs        ← backend serverless : garde ta clé API secrète
├── netlify.toml            ← config Netlify (build, en-têtes de cache, routage /api)
├── manifest.json           ← métadonnées PWA
├── sw.js                   ← service worker (fonctionnement hors-ligne)
├── package.json
└── icon-180/192/512.png
```

Le frontend n'appelle **jamais** Anthropic directement : il passe par `/api/chat`, exécuté côté serveur sur Netlify (la fonction `netlify/functions/chat.mjs`, routée sur `/api/chat`), qui seul connaît la clé. Ta clé n'est donc jamais exposée dans le navigateur.

---

## Déploiement : GitHub + Netlify (≈ 5 minutes, gratuit)

### Étape 1 — Récupérer une clé API Anthropic
1. Va sur **console.anthropic.com** → **API Keys** → **Create Key**
2. Copie la clé (commence par `sk-ant-...`). Garde-la secrète.
3. Crédite ton compte de quelques euros (Billing). Un usage perso intensif coûte quelques euros par mois — voir la section Coûts.

### Étape 2 — Pousser le dépôt sur GitHub
1. Crée un dépôt sur **github.com** (vide, sans README généré).
2. Depuis le dossier du projet :
   ```bash
   git init
   git add .
   git commit -m "Atelier TOEIC — PWA + backend Netlify"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/<ton-depot>.git
   git push -u origin main
   ```
   Le `.gitignore` fourni empêche de versionner `.env` (ta clé) et `node_modules/`.

### Étape 3 — Importer le projet sur Netlify
1. Crée un compte gratuit sur **netlify.com**.
2. **Add new site** → **Import an existing project** → **GitHub** → autorise Netlify puis **choisis ton dépôt**.

### Étape 4 — Réglages de build
Netlify lit automatiquement `netlify.toml`, donc ces réglages sont déjà renseignés. Vérifie simplement :
- **Build command** : *vide* (site statique, rien à compiler)
- **Publish directory** : `.` (la racine)
- **Functions directory** : détecté automatiquement → `netlify/functions`

### Étape 5 — Configurer la clé API
1. **Site configuration** → **Environment variables** → **Add a variable**
2. Ajoute :
   - **Key** : `ANTHROPIC_API_KEY`
   - **Value** : ta clé `sk-ant-...`
3. Si tu ajoutes la variable après un premier déploiement, relance un déploiement pour qu'elle soit prise en compte : onglet **Deploys** → **Trigger deploy** → **Deploy site**.

### Étape 6 — Déployer et vérifier
1. Netlify déploie automatiquement à chaque `git push` (et au premier import). Tu obtiens une URL en `*.netlify.app`.
2. Ouvre ton URL, va dans l'onglet **⚙** : tu dois voir **« ✓ IA active »**. Si tu vois « ⚠ Clé manquante », la variable d'environnement n'est pas prise en compte → vérifie l'orthographe exacte `ANTHROPIC_API_KEY` et relance un déploiement.

### Test local optionnel
Pour servir le site **et** les fonctions en local (avec la clé locale, sans pousser sur Netlify) :
```bash
npm i -g netlify-cli           # installe la CLI Netlify
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env   # ta clé, en local seulement (ignorée par git)
netlify dev                    # sert le site + /api/chat sur http://localhost:8888
```
`netlify dev` lit `.env` et expose `/api/chat` exactement comme en production. Vérifie le health-check : ouvrir `http://localhost:8888/api/chat` doit renvoyer `{"ok":true,"hasKey":true}` **sans consommer de token**.

---

## Installer sur ton iPhone

1. Ouvre ton URL Netlify dans **Safari** (obligatoirement Safari sur iOS)
2. Bouton **Partager** (⬆ en bas de l'écran)
3. **« Sur l'écran d'accueil »** → **Ajouter**
4. L'icône « A » apparaît sur ton écran d'accueil. Tap dessus : l'app se lance en plein écran.

Sur **Android** : ouvre l'URL dans Chrome → menu ⋮ → « Installer l'application ».

---

## Coûts (usage personnel)

L'app utilise **Claude Sonnet 4.6** (`claude-sonnet-4-6`), facturé par l'API Anthropic à 3 $ / million de tokens en entrée et 15 $ / million en sortie. Ordre de grandeur :

| Action | Coût approximatif |
|---|---|
| Une correction Writing | ~0,03 € |
| Une évaluation Speaking | ~0,02 € |
| Génération de 8 questions de grammaire | ~0,03 € |
| Génération d'un texte de lecture | ~0,02 € |
| Un message au tuteur | ~0,01–0,02 € |
| Conseils personnalisés | ~0,01 € |

Le tableau de bord vérifie la disponibilité de l'IA via un *health-check* (`GET /api/chat`) qui **ne consomme aucun token**. En pratique, un usage quotidien sérieux revient à quelques euros par mois. Tu peux fixer une limite de dépense mensuelle dans la console Anthropic (Billing → Limits) pour être tranquille.

### Réduire les coûts
- Pour des fonctions plus économiques, tu peux changer le modèle par défaut dans `netlify/functions/chat.mjs` (constante `DEFAULT_MODEL`) en `claude-haiku-4-5-20251001` (5× moins cher, qualité un peu en dessous mais très correcte pour la grammaire et le vocabulaire).

---

## Faire une « vraie » app sur les stores (optionnel)

La PWA installée se comporte déjà comme une app native (plein écran, icône, hors-ligne). Si tu veux **en plus** une présence sur l'App Store / Play Store, on peut empaqueter la PWA avec **Capacitor** sans réécrire le code :

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Atelier TOEIC" com.toi.toeic --web-dir=.
npx cap add ios       # nécessite un Mac + Xcode
npx cap add android   # nécessite Android Studio
npx cap open ios      # compile et publie depuis Xcode
```

Cela demande un compte Apple Developer (99 $/an) pour l'App Store et/ou un compte Google Play (25 $ une fois). Pour un usage perso, l'installation PWA suffit largement et ne coûte rien.

---

## Confidentialité

- Ta **progression** (scores, mots étudiés…) est stockée uniquement dans le navigateur de ton appareil (`localStorage`). Elle ne part sur aucun serveur.
- Les **textes que tu soumets** aux fonctions IA (rédactions, transcriptions orales, questions au tuteur) transitent par ton backend Netlify vers l'API Anthropic, le temps de générer la réponse. Anthropic ne les utilise pas pour entraîner ses modèles via l'API.

---

## Dépannage

| Symptôme | Solution |
|---|---|
| « ⚠ Clé manquante » dans ⚙ | Vérifie `ANTHROPIC_API_KEY` dans Netlify → **Site configuration** → **Environment variables**, puis relance un déploiement (**Deploys** → **Trigger deploy**) |
| « ○ IA hors-ligne » | Tu as ouvert le fichier en local (`file://`). Les fonctions IA exigent le déploiement Netlify — ou `netlify dev` en local |
| Erreur 401 lors d'une correction | Clé API invalide ou compte non crédité (console.anthropic.com → Billing) |
| Erreur 429 | Tu as atteint une limite de débit ; attends quelques secondes |
| Voix de mauvaise qualité (Listening) | Dépend du navigateur ; Safari sur iPhone/Mac a les meilleures voix anglaises |
| Reconnaissance vocale absente (Speaking) | Utilise Safari (iOS) ou Chrome/Edge (ordinateur) |

---

*Construit comme une PWA autonome : un frontend statique + une fonction serverless. Aucune base de données, aucun framework de build.*
