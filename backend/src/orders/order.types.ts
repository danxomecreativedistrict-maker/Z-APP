import { z } from 'zod';

/** Données structurées d'une commande, telles que produites par NOVA à la confirmation. */
export const OrderDataSchema = z.object({
  customerName: z.string().nullish(),
  deliveryAddress: z.string().nullish(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        // z.coerce gère les nombres renvoyés en chaîne par Claude ("2" → 2, "25000" → 25000).
        // quantity invalide ("deux", 2.5) → repli sur 1 plutôt que d'annuler la commande.
        quantity: z.coerce.number().int().positive().catch(1),
        unitPrice: z.coerce.number().nonnegative().nullish(),
      }),
    )
    .min(1),
});

export type OrderData = z.infer<typeof OrderDataSchema>;
