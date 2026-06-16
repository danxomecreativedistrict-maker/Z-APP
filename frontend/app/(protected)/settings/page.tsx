'use client';

import { ChangeEvent, KeyboardEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NovaPreview } from '@/components/nova-preview';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';
import { Company, NOVA_TONES, SECTORS } from '@/lib/company';

type FormState = {
  name: string;
  sector: string;
  city: string;
  country: string;
  managerPhone: string;
  ownerPhone: string;
  deliveryPolicy: string;
  paymentPolicy: string;
  deliveryZones: string[];
  deliveryDelay: string;
  novaName: string;
  novaTone: string;
  novaLanguage: string;
  welcomeMessage: string;
  alertPhone: string;
  delivererPhone: string;
  dailySummaryTime: string;
  dailySummaryOn: boolean;
  logoUrl: string | null;
};

function toForm(c: Company): FormState {
  return {
    name: c.name ?? '',
    sector: c.sector ?? '',
    city: c.city ?? '',
    country: c.country ?? 'BJ',
    managerPhone: c.managerPhone ?? '',
    ownerPhone: c.ownerPhone ?? '',
    deliveryPolicy: c.deliveryPolicy ?? '',
    paymentPolicy: c.paymentPolicy ?? '',
    deliveryZones: c.deliveryZones ?? [],
    deliveryDelay: c.deliveryDelay ?? '',
    novaName: c.novaName ?? 'NOVA',
    novaTone: c.novaTone ?? 'semi-formal',
    novaLanguage: c.novaLanguage ?? 'fr',
    welcomeMessage: c.welcomeMessage ?? '',
    alertPhone: c.alertPhone ?? '',
    delivererPhone: c.delivererPhone ?? '',
    dailySummaryTime: c.dailySummaryTime ?? '20:00',
    dailySummaryOn: c.dailySummaryOn,
    logoUrl: c.logoUrl,
  };
}

const TABS = ['Mon entreprise', 'Politique commerciale', 'Configurer NOVA', 'Notifications'];

export default function SettingsPage() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState | null>(null);
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [zoneInput, setZoneInput] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    authFetch<Company>('/company/me')
      .then((res) => setForm(toForm(res.data)))
      .catch(() => toast('Impossible de charger la fiche entreprise.', 'error'));
  }, [authFetch, toast]);

  if (!form) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Chargement…
      </main>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  async function save(path: string, payload: Record<string, unknown>, label: string): Promise<void> {
    setSaving(true);
    try {
      const res = await authFetch<Company>(path, { method: 'PATCH', body: JSON.stringify(payload) });
      setForm(toForm(res.data));
      toast(`${label} enregistré(e).`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec de l’enregistrement.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function onLogoChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function saveLogo(): Promise<void> {
    if (!logoFile) return;
    setSaving(true);
    try {
      const body = new FormData();
      body.append('file', logoFile);
      const res = await authFetch<Company>('/company/me/logo', { method: 'POST', body });
      setForm(toForm(res.data));
      setLogoFile(null);
      toast('Logo mis à jour.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Échec de l’envoi du logo.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function addZone(): void {
    const value = zoneInput.trim();
    if (value && !form!.deliveryZones.includes(value)) {
      set('deliveryZones', [...form!.deliveryZones, value]);
    }
    setZoneInput('');
  }

  function onZoneKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addZone();
    }
  }

  const SaveButton = ({ onClick }: { onClick: () => void }) => (
    <Button onClick={onClick} disabled={saving} className="mt-2">
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Enregistrer
    </Button>
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Tableau de bord
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Paramètres</h1>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map((label, index) => (
          <button
            key={label}
            onClick={() => setTab(index)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === index
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Mon entreprise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview ?? form.logoUrl ?? 'https://placehold.co/80x80/F8FAFF/1B4FD8?text=Logo'}
                  alt="Logo"
                  className="h-20 w-20 rounded-card border border-border object-cover"
                />
                <div className="space-y-2">
                  <Label htmlFor="logo" className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary">
                    <Upload className="h-4 w-4" /> Choisir un logo (max 2 Mo)
                  </Label>
                  <input
                    id="logo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onLogoChange}
                    className="block text-xs text-muted-foreground"
                  />
                  {logoFile ? (
                    <Button size="sm" variant="accent" onClick={saveLogo} disabled={saving}>
                      Envoyer le logo
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nom de l’entreprise</Label>
                <Input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sector">Secteur</Label>
                  <select
                    id="sector"
                    value={form.sector}
                    onChange={(e) => set('sector', e.target.value)}
                    className="flex h-10 w-full rounded-input border border-input bg-background px-3 text-sm"
                  >
                    <option value="">— Choisir —</option>
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => set('country', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="managerPhone">Téléphone gérant</Label>
                  <Input
                    id="managerPhone"
                    value={form.managerPhone}
                    onChange={(e) => set('managerPhone', e.target.value)}
                  />
                </div>
              </div>
              <SaveButton
                onClick={() =>
                  save(
                    '/company/me',
                    {
                      name: form.name,
                      sector: form.sector,
                      city: form.city,
                      country: form.country,
                      managerPhone: form.managerPhone,
                    },
                    'Entreprise',
                  )
                }
              />
            </CardContent>
          </Card>
        )}

        {tab === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Politique commerciale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryPolicy">Politique de livraison</Label>
                <Textarea
                  id="deliveryPolicy"
                  value={form.deliveryPolicy}
                  onChange={(e) => set('deliveryPolicy', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentPolicy">Politique de paiement</Label>
                <Textarea
                  id="paymentPolicy"
                  value={form.paymentPolicy}
                  onChange={(e) => set('paymentPolicy', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Zones de livraison</Label>
                <div className="flex flex-wrap gap-2">
                  {form.deliveryZones.map((zone) => (
                    <span
                      key={zone}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {zone}
                      <button
                        type="button"
                        onClick={() =>
                          set('deliveryZones', form.deliveryZones.filter((z) => z !== zone))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  value={zoneInput}
                  onChange={(e) => setZoneInput(e.target.value)}
                  onKeyDown={onZoneKey}
                  onBlur={addZone}
                  placeholder="Ajouter une zone puis Entrée"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryDelay">Délai de livraison moyen</Label>
                <Input
                  id="deliveryDelay"
                  value={form.deliveryDelay}
                  onChange={(e) => set('deliveryDelay', e.target.value)}
                  placeholder="ex : 24-48h"
                />
              </div>
              <SaveButton
                onClick={() =>
                  save(
                    '/company/me/policy',
                    {
                      deliveryPolicy: form.deliveryPolicy,
                      paymentPolicy: form.paymentPolicy,
                      deliveryZones: form.deliveryZones,
                      deliveryDelay: form.deliveryDelay,
                    },
                    'Politique commerciale',
                  )
                }
              />
            </CardContent>
          </Card>
        )}

        {tab === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Configurer NOVA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="novaName">Nom de NOVA</Label>
                <Input
                  id="novaName"
                  value={form.novaName}
                  onChange={(e) => set('novaName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ton de communication</Label>
                <div className="grid gap-2">
                  {NOVA_TONES.map((t) => (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => set('novaTone', t.value)}
                      className={`rounded-input border px-3 py-2 text-left text-sm transition-colors ${
                        form.novaTone === t.value
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-secondary'
                      }`}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.example}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="novaLanguage">Langue principale</Label>
                  <Input
                    id="novaLanguage"
                    value={form.novaLanguage}
                    onChange={(e) => set('novaLanguage', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcomeMessage">Message d’accueil</Label>
                <Textarea
                  id="welcomeMessage"
                  value={form.welcomeMessage}
                  onChange={(e) => set('welcomeMessage', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Aperçu temps réel</Label>
                <NovaPreview
                  novaName={form.novaName}
                  tone={form.novaTone}
                  welcomeMessage={form.welcomeMessage}
                />
              </div>
              <SaveButton
                onClick={() =>
                  save(
                    '/company/me/nova',
                    {
                      novaName: form.novaName,
                      novaTone: form.novaTone,
                      novaLanguage: form.novaLanguage,
                      welcomeMessage: form.welcomeMessage,
                    },
                    'Configuration NOVA',
                  )
                }
              />
            </CardContent>
          </Card>
        )}

        {tab === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alertPhone">WhatsApp gérant (alertes ventes)</Label>
                <Input
                  id="alertPhone"
                  value={form.alertPhone}
                  onChange={(e) => set('alertPhone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivererPhone">WhatsApp livreur principal</Label>
                <Input
                  id="delivererPhone"
                  value={form.delivererPhone}
                  onChange={(e) => set('delivererPhone', e.target.value)}
                />
              </div>
              <div className="grid items-end gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dailySummaryTime">Heure du résumé quotidien</Label>
                  <Input
                    id="dailySummaryTime"
                    type="time"
                    value={form.dailySummaryTime}
                    onChange={(e) => set('dailySummaryTime', e.target.value)}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.dailySummaryOn}
                    onChange={(e) => set('dailySummaryOn', e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Activer le résumé quotidien
                </label>
              </div>
              <SaveButton
                onClick={() =>
                  save(
                    '/company/me/notifications',
                    {
                      alertPhone: form.alertPhone,
                      delivererPhone: form.delivererPhone,
                      dailySummaryTime: form.dailySummaryTime,
                      dailySummaryOn: form.dailySummaryOn,
                    },
                    'Notifications',
                  )
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
