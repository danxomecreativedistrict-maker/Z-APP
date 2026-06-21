'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';

interface CheckboxRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}

function CheckboxRow({ checked, onChange, children }: CheckboxRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
      />
      <span>{children}</span>
    </label>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange =
    (key: keyof typeof form) =>
    (event: ChangeEvent<HTMLInputElement>): void =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ ...form, acceptTerms, acceptPrivacy, marketingEmails });
      // V1 : inscription = connexion immédiate → accès direct au tableau de bord.
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'inscription.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = acceptTerms && acceptPrivacy && !loading;

  return (
    <AuthShell
      title="Créer un compte"
      description="Quelques secondes pour activer votre agent NOVA."
      footer={
        <>
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">Prénom</Label>
            <Input id="firstName" value={form.firstName} onChange={onChange('firstName')} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nom</Label>
            <Input id="lastName" value={form.lastName} onChange={onChange('lastName')} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={onChange('email')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={onChange('password')}
            placeholder="8 caractères minimum"
            required
          />
        </div>

        <div className="space-y-2 rounded-card border border-border bg-secondary/40 p-3">
          <CheckboxRow checked={acceptTerms} onChange={setAcceptTerms}>
            J’ai lu et j’accepte les{' '}
            <Link
              href="/terms"
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              Conditions Générales d’Utilisation
            </Link>{' '}
            de Z-APP éditées par DANXOME CREATIVE DISTRICT SARL.
          </CheckboxRow>
          <CheckboxRow checked={acceptPrivacy} onChange={setAcceptPrivacy}>
            J’accepte la{' '}
            <Link
              href="/privacy"
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              Politique de Confidentialité
            </Link>{' '}
            de DANXOME CREATIVE DISTRICT SARL.
          </CheckboxRow>
          <CheckboxRow checked={marketingEmails} onChange={setMarketingEmails}>
            J’accepte de recevoir les emails de service de Z-APP (optionnel).
          </CheckboxRow>
        </div>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {loading ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
    </AuthShell>
  );
}
