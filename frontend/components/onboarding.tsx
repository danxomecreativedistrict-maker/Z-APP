'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, MessageCircle, PartyPopper, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NovaPreview } from '@/components/nova-preview';
import { useAuth } from '@/lib/auth-context';
import { Company, NOVA_TONES, SECTORS } from '@/lib/company';

interface OnboardingProps {
  initialCompany: Company | null;
  onDone: (company: Company) => void;
}

const TOTAL_STEPS = 5;

export function Onboarding({ initialCompany, onDone }: OnboardingProps) {
  const { authFetch } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initialCompany?.name ?? '',
    sector: initialCompany?.sector ?? '',
    city: initialCompany?.city ?? '',
    novaName: initialCompany?.novaName ?? 'NOVA',
    novaTone: initialCompany?.novaTone ?? 'semi-formal',
    welcomeMessage: initialCompany?.welcomeMessage ?? '',
  });

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));

  async function finish(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const payload = { name: form.name.trim(), sector: form.sector, city: form.city };
      if (initialCompany) {
        await authFetch<Company>('/company/me', { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await authFetch<Company>('/company', { method: 'POST', body: JSON.stringify(payload) });
      }
      await authFetch('/company/me/nova', {
        method: 'PATCH',
        body: JSON.stringify({
          novaName: form.novaName,
          novaTone: form.novaTone,
          welcomeMessage: form.welcomeMessage,
        }),
      });
      const done = await authFetch<Company>('/company/me/onboarding-done', { method: 'POST' });
      onDone(done.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="h-1.5 w-full bg-secondary">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
        {step === 1 && (
          <div className="space-y-5 text-center">
            <PartyPopper className="mx-auto h-12 w-12 text-accent" />
            <h1 className="text-2xl font-bold">
              Bienvenue sur Z-APP par DANXOME CREATIVE DISTRICT SARL ! 🎉
            </h1>
            <p className="text-muted-foreground">
              NOVA va gérer vos prospects 24h/24 à votre place. Configurons ensemble votre agent en 4
              étapes rapides.
            </p>
            <Button size="lg" className="w-full" onClick={next}>
              C’est parti <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Votre entreprise</h2>
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l’entreprise</Label>
              <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">Secteur</Label>
              <select
                id="sector"
                value={form.sector}
                onChange={(e) => update('sector', e.target.value)}
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
              <Input id="city" value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <Button className="w-full" onClick={next} disabled={form.name.trim().length < 2}>
              Continuer <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Donnez une identité à NOVA</h2>
            <div className="space-y-2">
              <Label htmlFor="novaName">Nom de l’agent</Label>
              <Input
                id="novaName"
                value={form.novaName}
                onChange={(e) => update('novaName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ton de communication</Label>
              <div className="grid gap-2">
                {NOVA_TONES.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => update('novaTone', t.value)}
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
            <div className="space-y-2">
              <Label htmlFor="welcome">Message d’accueil (optionnel)</Label>
              <Textarea
                id="welcome"
                value={form.welcomeMessage}
                onChange={(e) => update('welcomeMessage', e.target.value)}
                placeholder="Laisser vide pour utiliser l’accueil par défaut du ton choisi."
              />
            </div>
            <NovaPreview
              novaName={form.novaName}
              tone={form.novaTone}
              welcomeMessage={form.welcomeMessage}
            />
            <Button className="w-full" onClick={next}>
              Continuer <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 text-center">
            <MessageCircle className="mx-auto h-12 w-12 text-success" />
            <h2 className="text-xl font-bold">Connectez WhatsApp</h2>
            <p className="text-muted-foreground">
              C’est ici que NOVA recevra et répondra à vos prospects.
            </p>
            <p className="text-xs text-muted-foreground">
              (La connexion WhatsApp sera disponible au Module 4.)
            </p>
            <div className="space-y-2">
              <Button size="lg" className="w-full" onClick={next}>
                Connecter WhatsApp maintenant <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full" onClick={next}>
                Je le ferai plus tard
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5 text-center">
            <Rocket className="mx-auto h-12 w-12 text-primary" />
            <h2 className="text-xl font-bold">Vous êtes prêt ! 🚀</h2>
            <div className="space-y-2 rounded-card border border-border p-4 text-left text-sm">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> Entreprise : {form.name || '—'}
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> Agent : {form.novaName}
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> Ton :{' '}
                {NOVA_TONES.find((t) => t.value === form.novaTone)?.label}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Z-APP by DANXOME CREATIVE DISTRICT SARL</p>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <Button size="lg" className="w-full" onClick={finish} disabled={saving}>
              {saving ? 'Finalisation…' : 'Accéder à mon dashboard'} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
