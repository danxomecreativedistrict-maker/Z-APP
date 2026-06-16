'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function TermsReacceptModal({ onAccept }: { onAccept: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await onAccept();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Mise à jour des Conditions</CardTitle>
          <CardDescription>
            DANXOME CREATIVE DISTRICT SARL a mis à jour ses Conditions Générales d’Utilisation.
            Veuillez les accepter pour continuer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 text-sm">
            <Link href="/terms" target="_blank" className="font-medium text-primary hover:underline">
              Lire les CGU
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              Confidentialité
            </Link>
          </div>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          <Button className="w-full" onClick={accept} disabled={loading}>
            {loading ? 'Validation…' : 'J’accepte et je continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
