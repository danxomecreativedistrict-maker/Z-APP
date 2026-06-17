# Z-APP

SaaS multi-tenant fournissant à chaque entreprise abonnée un **Agent Commercial Virtuel
Intelligent** nommé **NOVA** (Claude `claude-sonnet-4-6` + RAG + WhatsApp).

## Stack

| Couche       | Techno                                                   |
| ------------ | -------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router) · Tailwind CSS · shadcn/ui       |
| Backend      | NestJS · TypeScript (strict)                             |
| Base données | PostgreSQL + Prisma + **pgvector** · Redis               |
| IA           | Anthropic Claude (`claude-sonnet-4-6`) · OpenAI embeddings · RAG pgvector |
| WhatsApp     | Baileys (QR code)                                        |
| Auth         | JWT (access 15 min + refresh 7 j) · OTP email (Resend)   |
| Fichiers     | UploadThing                                              |
| Emails       | Resend                                                   |
| Tests        | Jest · Supertest                                         |

## Prérequis

- Node.js ≥ 18 (testé sur v26)
- Un compte **Neon** (PostgreSQL + extension `pgvector`)
- Un compte **Upstash** (Redis)
- Clés API : **Anthropic** (génération), **OpenAI** (embeddings + Whisper + TTS), **Resend** (emails), **UploadThing** (fichiers)

> Alternative locale : `docker compose up -d` lance PostgreSQL+pgvector et Redis (voir
> `docker-compose.yml`).

## Démarrage rapide

```bash
# 1. Configurer l'environnement
cp .env.example backend/.env
#   puis renseigner DATABASE_URL, DIRECT_URL, REDIS_URL et les clés API

# 2. Installer les dépendances
npm run install:all

# 3. Appliquer le schéma de base de données (Neon)
npm --prefix backend run prisma:migrate

# 4. Lancer en développement (backend :3001 + frontend :3000)
npm install        # à la racine, pour `concurrently`
npm run dev
```

- API : http://localhost:3001/api
- Health check : http://localhost:3001/api/health
- Frontend : http://localhost:3000

## Modules (MVP) — tous livrés ✅

1. **Setup & Infrastructure** — NestJS + Prisma (Neon/pgvector) + Redis (Upstash), `{success,data,message}`, erreurs FR.
2. **Auth** — register / OTP email / login / refresh (rotation + détection de réutilisation) / logout.
3. **Entreprise & config NOVA** — CGU/Privacy, fiche entreprise, ton & politiques de NOVA, onboarding.
4. **WhatsApp (Baileys)** — connexion QR multi-tenant, sessions Redis chiffrées, appels manqués + notes vocales (Whisper).
5. **Base de connaissances (RAG)** — **configurée par la PME cliente** ; embeddings OpenAI + pgvector ; import CSV/PDF/Word.
6. **Cerveau NOVA** — Claude `claude-sonnet-4-6` + RAG + intentions + scoring des prospects.
7. **Flux de commande** — NOVA prend et confirme la commande (réf `CMD-AAAA-NNNN`), met à jour le pipeline.
8. **Notifications** — envoi réel au gérant (vente, transfert, appel manqué) + résumé quotidien planifié ; réponses vocales (TTS).
9. **Dashboard temps réel** — stats, pipeline, conversations, commandes, notifications (Socket.IO).
10. **Tests & validation MVP** — parcours e2e complet + isolation multi-tenant.

> **La base de connaissances de NOVA est configurée par chaque PME cliente** (en self-service via
> `/knowledge`), strictement isolée par `companyId`. La qualité des réponses de NOVA dépend de ce
> que la PME y renseigne (produits, FAQ, politiques, scripts).

## Validation MVP

- **Qualité** : TypeScript strict, ESLint + Prettier, isolation `companyId` sur chaque requête,
  enveloppe `{ success, data, message }`, messages d'erreur en français.
- **Tests** : **56 tests unitaires + 32 tests e2e** (Jest + Supertest), dont un **parcours complet**
  (inscription → config NOVA → base de connaissances → conversation NOVA + RAG → commande →
  notification → dashboard) et un test d'**isolation multi-tenant**.
- **Vérifié en conditions réelles** (Neon + Upstash + clés réelles) : RAG pgvector, conversation
  NOVA, prise de commande, dispatch des notifications, synthèse vocale (OGG/Opus), démarrage complet
  de l'API.

```bash
npm --prefix backend test          # tests unitaires
npm --prefix backend run test:e2e  # tests d'intégration (e2e)
npm --prefix frontend run build    # build de production du front
```

## Identité visuelle

| Rôle      | Couleur   |
| --------- | --------- |
| Principal | `#1B4FD8` |
| Accent    | `#FF6B2B` |
| Succès    | `#00C48C` |
| Fond      | `#F8FAFF` |

Typo : **Inter** · Icônes : **Lucide** · Radius : cards 12px, inputs 8px, buttons 24px.
