import { z } from 'zod';

export const NOVA_INTENTS = [
  'ORDER_INTENT',
  'ORDER_CONFIRMED',
  'HUMAN_REQUEST',
  'PRICE_QUERY',
  'INFO_QUERY',
  'FOLLOW_UP',
  'NONE',
] as const;

export type NovaIntent = (typeof NOVA_INTENTS)[number];

/** Forme JSON stricte de la réponse de NOVA (garantie par les structured outputs). */
export const NovaReplySchema = z.object({
  message: z.string().describe('Le message à envoyer au prospect sur WhatsApp.'),
  intent: z.enum(NOVA_INTENTS).describe("L'intention détectée dans le message du prospect."),
  notifyManager: z
    .boolean()
    .describe('true si le gérant doit être notifié (info manquante, etc.).'),
  orderData: z
    .unknown()
    .nullable()
    .describe('Données structurées de la commande quand ORDER_CONFIRMED, sinon null.'),
});

export type NovaReply = z.infer<typeof NovaReplySchema>;

export interface NovaTurn {
  role: 'user' | 'assistant';
  content: string;
}
