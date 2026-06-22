'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Loader2,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';
import {
  CONFIANCE_STYLES,
  ExtractedProduct,
  KB_TABS,
  KBType,
  KnowledgeItem,
  ProductRow,
} from '@/lib/knowledge';

interface SearchHit {
  id: string;
  title: string;
  content: string;
  type: string;
  score: number;
}

const emptyExtracted = (): ExtractedProduct => ({
  nom: '',
  categorie: '',
  description: '',
  prix_min: null,
  prix_max: null,
  devise: 'FCFA',
  disponible: true,
  confiance_extraction: 'haute',
});

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

  // Import catalogue (extraction IA → prévisualisation éditable → validation)
  const [extracted, setExtracted] = useState<ExtractedProduct[] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

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

  // ─────────── Import catalogue ───────────
  async function extractFromFile(file: File): Promise<void> {
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch<ExtractedProduct[]>('/knowledge/extract', {
        method: 'POST',
        body: fd,
      });
      if (!res.data.length) {
        toast('Aucun produit détecté dans ce fichier. Essayez un autre format.', 'error');
        return;
      }
      setExtracted(res.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'extraction.", 'error');
    } finally {
      setExtracting(false);
    }
  }

  function onCatalogFile(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void extractFromFile(file);
  }

  async function onSheetImport(): Promise<void> {
    if (!sheetUrl.trim()) return;
    setExtracting(true);
    try {
      const res = await authFetch<ExtractedProduct[]>('/knowledge/extract-url', {
        method: 'POST',
        body: JSON.stringify({ url: sheetUrl.trim() }),
      });
      if (!res.data.length) {
        toast('Aucun produit détecté dans ce Google Sheet.', 'error');
        return;
      }
      setExtracted(res.data);
      setSheetUrl('');
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'import.", 'error');
    } finally {
      setExtracting(false);
    }
  }

  function updateRow(i: number, patch: Partial<ExtractedProduct>): void {
    setExtracted((prev) => (prev ? prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) : prev));
  }
  function removeRow(i: number): void {
    setExtracted((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function addRow(): void {
    setExtracted((prev) => [...(prev ?? []), emptyExtracted()]);
  }

  async function confirmCatalog(): Promise<void> {
    if (!extracted?.length) return;
    if (extracted.some((p) => !p.nom.trim())) {
      toast('Chaque produit doit avoir un nom.', 'error');
      return;
    }
    setBusy(true);
    try {
      const produits = extracted.map((p) => ({
        nom: p.nom.trim(),
        categorie: p.categorie || undefined,
        description: p.description || undefined,
        prix_min: p.prix_min ?? undefined,
        prix_max: p.prix_max ?? undefined,
        devise: p.devise || undefined,
        disponible: p.disponible,
      }));
      const res = await authFetch<{ imported: number }>('/knowledge/catalog', {
        method: 'POST',
        body: JSON.stringify({ produits }),
      });
      toast(`${res.data.imported} produit(s) importé(s) dans votre catalogue !`);
      setExtracted(null);
      void load('PRODUCT');
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de l'enregistrement.", 'error');
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

  const lowConfidence = extracted?.filter((p) => p.confiance_extraction === 'basse').length ?? 0;

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

      {/* Import catalogue (onglet Produits) */}
      {tab === 'PRODUCT' ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Importer mon catalogue</CardTitle>
          </CardHeader>
          <CardContent>
            {extracted === null ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Téléversez votre catalogue tel quel — NOVA en extrait les produits automatiquement.
                  Formats : <strong>PDF, Word, Excel, CSV, ou une photo</strong> de votre menu/carte.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Label
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-button bg-primary px-4 py-2 text-sm font-medium text-white ${extracting ? 'opacity-60' : ''}`}
                  >
                    {extracting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    Choisir un fichier
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.xls,.csv,image/*"
                      onChange={onCatalogFile}
                      disabled={extracting}
                      className="hidden"
                    />
                  </Label>
                  <Label
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-button border border-border px-4 py-2 text-sm font-medium ${extracting ? 'opacity-60' : ''}`}
                  >
                    <Camera className="h-4 w-4" /> Prendre une photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={onCatalogFile}
                      disabled={extracting}
                      className="hidden"
                    />
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="…ou collez un lien Google Sheets (partagé en lecture)"
                  />
                  <Button variant="outline" onClick={onSheetImport} disabled={extracting || !sheetUrl}>
                    Importer
                  </Button>
                </div>
                {extracting ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyse du document par NOVA…
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {extracted.length} produit(s) détecté(s) — vérifiez puis validez
                  </p>
                  <Button variant="ghost" onClick={() => setExtracted(null)} disabled={busy}>
                    Annuler
                  </Button>
                </div>
                {lowConfidence > 0 ? (
                  <p className="flex items-center gap-2 rounded-input bg-accent/10 p-2 text-xs text-accent">
                    <AlertTriangle className="h-4 w-4" />
                    {lowConfidence} produit(s) à faible confiance (en orange) — vérifiez-les.
                  </p>
                ) : null}

                <div className="space-y-3">
                  {extracted.map((p, i) => (
                    <div
                      key={i}
                      className={`rounded-card border p-3 ${p.confiance_extraction === 'basse' ? 'border-accent/50 bg-accent/5' : 'border-border'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONFIANCE_STYLES[p.confiance_extraction]}`}
                        >
                          confiance {p.confiance_extraction}
                        </span>
                        <button
                          onClick={() => removeRow(i)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Input
                          value={p.nom}
                          onChange={(e) => updateRow(i, { nom: e.target.value })}
                          placeholder="Nom du produit"
                        />
                        <Input
                          value={p.categorie}
                          onChange={(e) => updateRow(i, { categorie: e.target.value })}
                          placeholder="Catégorie"
                        />
                        <Input
                          type="number"
                          value={p.prix_min ?? ''}
                          onChange={(e) =>
                            updateRow(i, {
                              prix_min: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          placeholder="Prix"
                        />
                        <Input
                          value={p.devise}
                          onChange={(e) => updateRow(i, { devise: e.target.value })}
                          placeholder="Devise (FCFA)"
                        />
                      </div>
                      <Textarea
                        className="mt-2"
                        value={p.description}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                        placeholder="Description"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={addRow} disabled={busy}>
                    <Plus className="h-4 w-4" /> Ajouter un produit
                  </Button>
                  <Button variant="success" onClick={confirmCatalog} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Valider l’import ({extracted.length})
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Formulaire d'ajout manuel */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            {tab === 'PRODUCT' ? 'Ajouter un produit manuellement' : 'Ajouter un élément'}
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
