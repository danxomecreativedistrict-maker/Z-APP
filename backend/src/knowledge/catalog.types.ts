import { z } from 'zod';

export const CONFIANCE_VALUES = ['haute', 'moyenne', 'basse'] as const;

/** Produit extrait d'un catalogue par Claude (avant validation humaine). */
export const ExtractedProductSchema = z.object({
  nom: z.string().min(1),
  categorie: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  description: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  prix_min: z.coerce.number().nonnegative().nullish().catch(null),
  prix_max: z.coerce.number().nonnegative().nullish().catch(null),
  devise: z
    .string()
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : 'FCFA')),
  disponible: z.boolean().catch(true),
  confiance_extraction: z.enum(CONFIANCE_VALUES).catch('moyenne'),
});

export const CatalogSchema = z.object({
  produits: z.array(ExtractedProductSchema),
});

export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;
