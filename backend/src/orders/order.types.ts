import { z } from 'zod';

/** Données structurées d'une commande, telles que produites par NOVA à la confirmation. */
export const OrderDataSchema = z.object({
  customerName: z.string().nullish(),
  deliveryAddress: z.string().nullish(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive().catch(1),
        unitPrice: z.number().nonnegative().nullish(),
      }),
    )
    .min(1),
});

export type OrderData = z.infer<typeof OrderDataSchema>;
