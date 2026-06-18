# Image de production du backend NestJS de Z-APP (déploiement Koyeb / Docker).
# Étape 1 : build (toutes les dépendances + prisma generate + nest build)
FROM node:22-slim AS build
WORKDIR /app

# OpenSSL est requis par Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --include=dev

COPY . .
RUN npx prisma generate && npm run build

# Étape 2 : runtime
FROM node:22-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Koyeb injecte PORT (8000 par défaut) ; main.ts l'utilise déjà.
ENV PORT=8000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

EXPOSE 8000
CMD ["node", "dist/main.js"]
