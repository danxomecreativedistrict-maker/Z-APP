import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal/legal-footer';

export const metadata: Metadata = {
  title: 'Z-APP — Politique de Confidentialité',
};

const EMAIL = 'danxomecreativedistrict@gmail.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const updatedAt = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        ← Retour
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Politique de Confidentialité</h1>
      <p className="mt-1 text-sm text-muted-foreground">Version v1.0 · Mise à jour le {updatedAt}</p>

      <div className="mt-8 space-y-8">
        <Section title="Responsable de traitement">
          <p>
            DANXOME CREATIVE DISTRICT SARL, Cotonou, République du Bénin. Contact :{' '}
            <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
              {EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="Données collectées">
          <p>Email, téléphone, nom, et conversations gérées par NOVA.</p>
        </Section>

        <Section title="Finalité">
          <p>Faire fonctionner le service NOVA pour la PME cliente.</p>
        </Section>

        <Section title="Base légale">
          <p>Consentement explicite (CGU acceptées à l’inscription).</p>
        </Section>

        <Section title="Durée de conservation">
          <p>Durée de l’abonnement, prolongée de 12 mois.</p>
        </Section>

        <Section title="Protection">
          <p>Chiffrement TLS en transit et AES-256 au repos.</p>
        </Section>

        <Section title="Vos droits">
          <p>
            Accès, rectification et suppression de vos données. Pour exercer vos droits, écrivez à{' '}
            <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
              {EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>

      <LegalFooter />
    </main>
  );
}
