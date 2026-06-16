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

export const KB_TABS: { type: KBType; label: string }[] = [
  { type: 'PRODUCT', label: 'Produits' },
  { type: 'FAQ', label: 'FAQ' },
  { type: 'POLICY', label: 'Politique' },
  { type: 'SCRIPT', label: 'Scripts' },
];

/** Normalise une ligne CSV (entêtes FR/EN) vers un ProductRow. */
export function csvRowToProduct(row: Record<string, string>): ProductRow | null {
  const get = (...keys: string[]): string | undefined => {
    for (const key of Object.keys(row)) {
      if (keys.includes(key.trim().toLowerCase())) return row[key];
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
