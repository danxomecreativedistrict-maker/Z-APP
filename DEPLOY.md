# Déploiement de Z-APP

Architecture cible :

- **Frontend (Next.js)** → **Vercel**
- **Backend (NestJS)** → **Render** (process persistant — requis pour WhatsApp/Baileys, Socket.IO, le cron)
- **PostgreSQL + Redis** → déjà **Neon** + **Upstash** (rien à faire)

> ⚠️ L'offre **gratuite Render** met le service en veille après ~15 min d'inactivité. L'API se
> réveille à la 1ʳᵉ requête (léger délai) ; la session WhatsApp se reconnecte automatiquement
> (elle est chiffrée dans Redis). Pour un WhatsApp connecté en permanence, passer à un plan payant.

---

## 1. Pousser le code sur GitHub

```bash
# Depuis C:\Users\User\Desktop\z-app
git remote add origin https://github.com/<TON_COMPTE>/z-app.git
git branch -M main
git push -u origin main
```

> Le fichier `.gitignore` exclut déjà `.env`, `node_modules`, `dist`, `.next` : **aucun secret
> n'est poussé**. Les valeurs sensibles se renseignent dans Render/Vercel.

---

## 2. Déployer le backend sur Render

1. [render.com](https://render.com) → **New** → **Blueprint** → connecter le repo GitHub `z-app`.
2. Render détecte `render.yaml` et propose le service **zapp-api**. Valider.
3. Renseigner les variables marquées `sync: false` (valeurs de `backend/.env`) :
   - `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`
   - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
   - `RESEND_API_KEY`, `FROM_EMAIL`, `UPLOADTHING_TOKEN`
   - `FRONTEND_URL` → mettre temporairement `https://localhost` (on le corrigera à l'étape 4)
4. **Create** → attendre le build. URL obtenue : `https://zapp-api.onrender.com`
5. Vérifier : `https://zapp-api.onrender.com/api/health` → `{"success":true,...}`

---

## 3. Déployer le frontend sur Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → importer le repo `z-app`.
2. **Root Directory** → `frontend` (important : monorepo).
3. **Environment Variables** :
   - `NEXT_PUBLIC_API_URL` = `https://zapp-api.onrender.com/api`
4. **Deploy** → URL obtenue : `https://z-app-xxxx.vercel.app`

---

## 4. Relier les deux (CORS)

1. Render → service **zapp-api** → **Environment** → mettre
   `FRONTEND_URL` = `https://z-app-xxxx.vercel.app` (l'URL Vercel exacte).
2. Render redéploie automatiquement.

---

## 5. Tester

Ouvrir `https://z-app-xxxx.vercel.app` :

1. **Inscription** (un code OTP est envoyé par email si `RESEND_API_KEY` est une vraie clé +
   domaine vérifié ; sinon le code apparaît dans les **logs Render**).
2. Créer la fiche entreprise, configurer NOVA.
3. **Base de connaissances** : ajouter quelques produits/FAQ.
4. **WhatsApp** : scanner le QR (sur le plan gratuit, garder un onglet actif évite la veille).
5. Tester **NOVA** (page de chat) et voir le **dashboard** se mettre à jour en temps réel.

---

## Notes

- **Emails réels** : nécessitent une vraie clé `RESEND_API_KEY` **et** un domaine vérifié chez
  Resend (sinon les OTP/alertes sont seulement loggués).
- **Cookies cross-domaine** : le cookie de refresh est en `SameSite=None; Secure` en production
  (déjà géré) — l'API doit être en **HTTPS** (Render fournit le HTTPS).
- **Changement de schéma DB** : si tu modifies `schema.prisma`, lance
  `npm --prefix backend run prisma:migrate` en local (la base Neon est partagée).
