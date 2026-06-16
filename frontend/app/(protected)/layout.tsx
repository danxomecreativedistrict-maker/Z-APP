'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LegalFooter } from '@/components/legal/legal-footer';
import { Onboarding } from '@/components/onboarding';
import { TermsReacceptModal } from '@/components/terms-modal';
import { useAuth } from '@/lib/auth-context';
import { Company } from '@/lib/company';

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center text-muted-foreground">
      {children}
    </main>
  );
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, loading, acceptTerms, authFetch } = useAuth();
  const router = useRouter();
  // undefined = en cours de chargement, null = pas encore de fiche
  const [company, setCompany] = useState<Company | null | undefined>(undefined);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  const loadCompany = useCallback(async () => {
    try {
      const res = await authFetch<Company>('/company/me');
      setCompany(res.data);
    } catch {
      setCompany(null);
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) {
      void loadCompany();
    }
  }, [user, loadCompany]);

  if (loading || !user) {
    return <FullScreen>Chargement…</FullScreen>;
  }

  if (!user.termsUpToDate) {
    return <TermsReacceptModal onAccept={acceptTerms} />;
  }

  if (company === undefined) {
    return <FullScreen>Chargement…</FullScreen>;
  }

  const needsOnboarding = company === null || !company.onboardingDone;
  if (needsOnboarding) {
    return <Onboarding initialCompany={company} onDone={(c) => setCompany(c)} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">{children}</div>
      <LegalFooter />
    </div>
  );
}
