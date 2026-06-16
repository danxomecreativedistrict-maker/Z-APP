'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';

export default function VerifyOtpPage() {
  const { verifyOtp, resendOtp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const pending = sessionStorage.getItem('zapp_pending_email');
    if (pending) setEmail(pending);
  }, []);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await verifyOtp(email, code);
      sessionStorage.removeItem('zapp_pending_email');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide.');
    } finally {
      setLoading(false);
    }
  }

  async function onResend(): Promise<void> {
    setError(null);
    setInfo(null);
    try {
      await resendOtp(email);
      setInfo('Un nouveau code a été envoyé.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer le code.");
    }
  }

  return (
    <AuthShell
      title="Vérification"
      description="Saisissez le code à 6 chiffres reçu par email."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Code de vérification</Label>
          <Input
            id="code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setCode(e.target.value.replace(/\D/g, ''))
            }
            placeholder="••••••"
            className="text-center text-xl tracking-[0.5em]"
            required
          />
        </div>
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        {info ? <p className="text-sm font-medium text-success">{info}</p> : null}
        <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
          {loading ? 'Vérification…' : 'Valider'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onResend}>
          Renvoyer le code
        </Button>
      </form>
    </AuthShell>
  );
}
