# Z-APP

SaaS multi-tenant fournissant à chaque entreprise abonnée un **Agent Commercial Virtuel
Intelligent** nommé **NOVA** (Claude `claude-sonnet-4-6` + RAG + WhatsApp).

## Stack

| Couche       | Techno                                                   |
| ------------ | -------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router) · Tailwind CSS · shadcn/ui       |
| Backend      | NestJS · TypeScript (strict)                             |
| Base données | PostgreSQL + Prisma + **pgvector** · Redis               |
| IA           | Anthropic Claude API (`claude-sonnet-4-6`) · RAG pgvector |
| WhatsApp     | Baileys (QR code)                                        |
| Auth         | JWT (access 15 min + refresh 7 j) · OTP email (Resend)   |
| Fichiers     | Cloudinary                                               |
| Emails       | Resend                                                   |
| Tests        | Jest · Supertest                                         |

## Prérequis

- Node.js ≥ 18 (testé sur v26)
- Un compte **Neon** (PostgreSQL + extension `pgvector`)
- Un compte **Upstash** (Redis)
- Clés API : Anthropic, Resend, Cloudinary

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

## Modules (MVP)

1. **Setup & Infrastructure** ✅ · 2. Auth · 3. Entreprise & config NOVA · 4. WhatsApp QR ·
5. Base de connaissances (RAG) · 6. Cerveau NOVA · 7. Flow de commande · 8. Notifications ·
9. Dashboard temps réel · 10. Tests & validation.

## Identité visuelle

| Rôle      | Couleur   |
| --------- | --------- |
| Principal | `#1B4FD8` |
| Accent    | `#FF6B2B` |
| Succès    | `#00C48C` |
| Fond      | `#F8FAFF` |

Typo : **Inter** · Icônes : **Lucide** · Radius : cards 12px, inputs 8px, buttons 24px.
