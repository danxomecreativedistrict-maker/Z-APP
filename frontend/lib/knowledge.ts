export type KBType = 'PRODUCT' | 'FAQ' | 'POLICY' | 'SCRIPT' | 'DOCUMENT';

export interface KnowledgeItem {
  id: string;
  type: KBType;
  title: string;
  content: string;
  sourceFile: string | null;
  createdAt: string;
}

export interface ProductRow {
  name: string;
  description?: string;
  price?: number;
  unit?: string;
  stock?: number;
}

export type Confiance = 'haute' | 'moyenne' | 'basse';

/** Produit extrait d'un catalogue par l'IA (avant validation humaine). */
export interface ExtractedProduct {
  nom: string;
  categorie: string;
  description: string;
  prix_min: number | null;
  prix_max: number | null;
  devise: string;
  disponible: boolean;
  confiance_extraction: Confiance;
}

export const CONFIANCE_STYLES: Record<Confiance, string> = {
  haute: 'bg-success/10 text-success',
  moyenne: 'bg-primary/10 text-primary',
  basse: 'bg-accent/10 text-accent',
};

export const KB_TABS: { type: KBType; label: string }[] = [
  { type: 'PRODUCT', label: 'Produits' },
  { type: 'FAQ', label: 'FAQ' },
  { type: 'POLICY', label: 'Politique' },
  { type: 'SCRIPT', label: 'Scripts' },
  { type: 'DOCUMENT', label: 'Documents' },
];

// Codes des caractères invisibles fréquents dans les exports Excel (BOM, zero-width).
const INVISIBLE_CODES = [0x200b, 0x200c, 0x200d, 0xfeff];

/** Nettoie un entête CSV : retire le BOM/caractères invisibles, les espaces, minuscules. */
export function normalizeHeader(header: string): string {
  const cleaned = Array.from(header)
    .filter((ch) => !INVISIBLE_CODES.includes(ch.charCodeAt(0)))
    .join('');
  return cleaned.trim().toLowerCase();
}

/** Normalise une ligne CSV (entêtes FR/EN) vers un ProductRow. */
export function csvRowToProduct(row: Record<string, string>): ProductRow | null {
  const get = (...keys: string[]): string | undefined => {
    for (const key of Object.keys(row)) {
      // .trim() seul ne retire PAS le BOM : on normalise via normalizeHeader (bug import Excel).
      if (keys.includes(normalizeHeader(key))) return row[key];
    }
    return undefined;
  };
  const name = (get('name', 'nom', 'produit', 'product') ?? '').trim();
  if (!name) return null;
  const priceRaw = get('price', 'prix');
  const stockRaw = get('stock', 'quantité', 'quantite', 'qty');
  const price = priceRaw ? Number(priceRaw.replace(/[^\d.,]/g, '').replace(',', '.')) : undefined;
  const stock = stockRaw ? parseInt(stockRaw, 10) : undefined;
  return {
    name,
    description: get('description', 'desc')?.trim() || undefined,
    price: Number.isFinite(price) ? price : undefined,
    unit: get('unit', 'unité', 'unite')?.trim() || undefined,
    stock: Number.isFinite(stock) ? stock : undefined,
  };
}
