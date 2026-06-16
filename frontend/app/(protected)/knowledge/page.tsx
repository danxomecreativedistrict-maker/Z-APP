'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { ArrowLeft, FileUp, Loader2, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';
import { csvRowToProduct, KB_TABS, KBType, KnowledgeItem, ProductRow } from '@/lib/knowledge';

interface SearchHit {
  id: string;
  title: string;
  content: string;
  type: string;
  score: number;
}

export default function KnowledgePage() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<KBType>('PRODUCT');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [product, setProduct] = useState({ name: '', description: '', price: '', unit: '', stock: '' });
  const [generic, setGeneric] = useState({ title: '', content: '' });
  const [csvRows, setCsvRows] = useState<ProductRow[] | null>(null);

  const load = useCallback(
    async (type: KBType) => {
      setLoading(true);
      try {
        const res = await authFetch<KnowledgeItem[]>(`/knowledge?type=${type}`);
        setItems(res.data);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Erreur de chargement.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [authFetch, toast],
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function addProduct(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    const row: ProductRow = {
      name: product.name,
      description: product.description || undefined,
      price: product.price ? Number(product.price) : undefined,
      unit: product.unit || undefined,
      stock: product.stock ? parseInt(product.stock, 10) : undefined,
    };
    try {
      await authFetch('/knowledge/import-csv', {
        method: 'POST',
        body: JSON.stringify({ products: [row] }),
      });
      toast('Produit ajouté.');
      setProduct({ name: '', description: '', price: '', unit: '', stock: '' });
      void load('PRODUCT');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addGeneric(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      await authFetch('/knowledge', {
        method: 'POST',
        body: JSON.stringify({ type: tab, title: generic.title, content: generic.content }),
      });
      toast('Ajouté à la base de connaissances.');
      setGeneric({ title: '', content: '' });
      void load(tab);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    if (!window.confirm('Supprimer cet élément ?')) return;
    try {
      await authFetch(`/knowledge/${id}`, { method: 'DELETE' });
      toast('Élément supprimé.');
      void load(tab);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur.', 'error');
    }
  }

  function onCsvFile(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data
          .map(csvRowToProduct)
          .filter((r): r is ProductRow => r !== null);
        if (rows.length === 0) {
          toast('Aucune ligne valide (colonne « name/nom » requise).', 'error');
          return;
        }
        setCsvRows(rows);
      },
    });
  }

  async function confirmCsv(): Promise<void> {
    if (!csvRows?.length) return;
    setBusy(true);
    try {
      await authFetch('/knowledge/import-csv', {
        method: 'POST',
        body: JSON.stringify({ products: csvRows }),
      });
      toast(`${csvRows.length} produit(s) importé(s).`);
      setCsvRows(null);
      void load('PRODUCT');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doSearch(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await authFetch<SearchHit[]>('/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query, k: 5 }),
      });
      setResults(res.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur.', 'error');
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Tableau de bord
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Base de connaissances</h1>
      <p className="text-sm text-muted-foreground">
        Ce que NOVA sait sur votre entreprise pour répondre à vos prospects.
      </p>

      {/* Recherche sémantique (RAG) */}
      <form onSubmit={doSearch} className="mt-4 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tester la recherche de NOVA…"
        />
        <Button type="submit" variant="outline" disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Rechercher
        </Button>
      </form>
      {results ? (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle className="text-sm">Résultats (top {results.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun résultat.</p>
            ) : (
              results.map((r) => (
                <div key={r.id} className="rounded-input border border-border p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs text-success">score {r.score.toFixed(2)}</span>
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">{r.content}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Onglets */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {KB_TABS.map((t) => (
          <button
            key={t.type}
            onClick={() => setTab(t.type)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.type
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Formulaire d'ajout */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            {tab === 'PRODUCT' ? 'Ajouter un produit' : 'Ajouter un élément'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tab === 'PRODUCT' ? (
            <form onSubmit={addProduct} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Nom</Label>
                  <Input
                    id="pname"
                    value={product.name}
                    onChange={(e) => setProduct({ ...product, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pprice">Prix</Label>
                  <Input
                    id="pprice"
                    type="number"
                    value={product.price}
                    onChange={(e) => setProduct({ ...product, price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="punit">Unité</Label>
                  <Input
                    id="punit"
                    value={product.unit}
                    onChange={(e) => setProduct({ ...product, unit: e.target.value })}
                    placeholder="FCFA, kg…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pstock">Stock</Label>
                  <Input
                    id="pstock"
                    type="number"
                    value={product.stock}
                    onChange={(e) => setProduct({ ...product, stock: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pdesc">Description</Label>
                <Textarea
                  id="pdesc"
                  value={product.description}
                  onChange={(e) => setProduct({ ...product, description: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={busy}>
                Ajouter le produit
              </Button>
            </form>
          ) : (
            <form onSubmit={addGeneric} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="gtitle">Titre</Label>
                <Input
                  id="gtitle"
                  value={generic.title}
                  onChange={(e) => setGeneric({ ...generic, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gcontent">Contenu</Label>
                <Textarea
                  id="gcontent"
                  value={generic.content}
                  onChange={(e) => setGeneric({ ...generic, content: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                Ajouter
              </Button>
            </form>
          )}

          {tab === 'PRODUCT' ? (
            <div className="mt-4 border-t border-border pt-4">
              <Label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-primary">
                <FileUp className="h-4 w-4" /> Importer un CSV
                <input type="file" accept=".csv" onChange={onCsvFile} className="hidden" />
              </Label>
              {csvRows ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">Prévisualisation ({csvRows.length} produits)</p>
                  <div className="max-h-48 overflow-auto rounded-input border border-border text-sm">
                    <table className="w-full">
                      <thead className="bg-secondary text-left">
                        <tr>
                          <th className="p-2">Nom</th>
                          <th className="p-2">Prix</th>
                          <th className="p-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="p-2">{r.name}</td>
                            <td className="p-2">{r.price ?? '—'}</td>
                            <td className="p-2">{r.stock ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={confirmCsv} disabled={busy} variant="success">
                      Valider l’import
                    </Button>
                    <Button onClick={() => setCsvRows(null)} variant="ghost">
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Liste */}
      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun élément pour le moment.</p>
        ) : (
          items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground line-clamp-3">
                    {item.content}
                  </p>
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
