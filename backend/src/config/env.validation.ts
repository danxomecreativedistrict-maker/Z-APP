import { z } from 'zod';

/**
 * Schéma de validation des variables d'environnement.
 * Échoue au démarrage si une variable critique manque ou est invalide.
 *
 * Module 1 : seules DATABASE_URL et REDIS_URL sont requises (infrastructure).
 * Les secrets/clés des modules ultérieurs sont optionnels ici et seront
 * rendus obligatoires dans leur module respectif (Auth, NOVA, etc.).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  // Base de données (Neon) — requis
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis (Neon PostgreSQL)'),
  DIRECT_URL: z.string().min(1).optional(),

  // Cache (Upstash) — requis
  REDIS_URL: z.string().min(1, 'REDIS_URL est requis (Upstash Redis)'),

  // Auth (Module 2) — secrets requis
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET doit faire au moins 16 caractères'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET doit faire au moins 16 caractères'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604800),

  // WhatsApp (Module 4) — clé de chiffrement des sessions Baileys stockées dans Redis
  WHATSAPP_ENC_SECRET: z.string().min(8).default('zapp-dev-whatsapp-encryption-secret-change-me'),

  // IA (Modules 5/6/8) — Anthropic (génération) + OpenAI (embeddings, Whisper, TTS)
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Email (Module 2) — Resend (domaine vérifié) ou Gmail SMTP (mot de passe d'application)
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default('nova@z-app.com'),
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),

  // Fichiers (Module 3) — UploadThing (remplace Cloudinary)
  UPLOADTHING_TOKEN: z.string().optional(),

  // App
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  BACKEND_URL: z.string().default('http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration d'environnement invalide :\n${issues}`);
  }
  return parsed.data;
}
