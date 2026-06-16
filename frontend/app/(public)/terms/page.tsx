import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalFooter } from '@/components/legal/legal-footer';

// NOTE DÉVELOPPEUR : dès qu'un domaine + email pro seront disponibles (ex: contact@danxome.com),
// remplacer danxomecreativedistrict@gmail.com partout (CGU, /privacy, emails automatiques).

export const metadata: Metadata = {
  title: "Z-APP — Conditions Générales d'Utilisation",
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

export default function TermsPage() {
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
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Conditions Générales d’Utilisation</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Version v1.0 · Mise à jour le {updatedAt}
      </p>

      <div className="mt-8 space-y-8">
        <Section title="1. Présentation">
          <p>
            Z-APP est un service SaaS édité par <strong>DANXOME CREATIVE DISTRICT SARL</strong>,
            Société à Responsabilité Limitée de droit béninois, spécialisée dans le conseil aux
            entreprises, l’accompagnement des PME et la transformation digitale en Afrique de
            l’Ouest. Siège social : Cotonou, République du Bénin. Contact :{' '}
            <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
              {EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Objet du service">
          <p>
            Z-APP met à disposition des entreprises abonnées un agent commercial virtuel intelligent
            dénommé NOVA, capable de gérer les prospects, présenter les offres de l’entreprise,
            prendre les commandes et notifier automatiquement l’équipe commerciale et logistique, via
            WhatsApp et autres canaux de communication numérique.
          </p>
        </Section>

        <Section title="3. Obligations de la PME cliente">
          <ul className="list-disc space-y-1 pl-5">
            <li>Fournir des informations exactes et à jour sur son entreprise et ses produits/services.</li>
            <li>Ne pas utiliser NOVA pour diffuser des informations fausses, trompeuses ou frauduleuses.</li>
            <li>Respecter la vie privée et les droits de ses prospects.</li>
            <li>Ne pas utiliser Z-APP à des fins illégales ou contraires à la réglementation béninoise.</li>
            <li>Maintenir à jour sa base de connaissances et son catalogue.</li>
            <li>Être responsable du numéro WhatsApp connecté à Z-APP.</li>
            <li>S’acquitter de son abonnement dans les délais convenus.</li>
          </ul>
        </Section>

        <Section title="4. Obligations de DANXOME CREATIVE DISTRICT SARL">
          <ul className="list-disc space-y-1 pl-5">
            <li>Assurer la disponibilité du service à 99,9 % (hors maintenance planifiée).</li>
            <li>Protéger les données des PME clientes et de leurs prospects.</li>
            <li>Ne jamais partager les données d’une PME avec une autre PME.</li>
            <li>Ne jamais revendre les données des clients à des tiers.</li>
            <li>Assurer le support technique dans un délai de 24 h ouvrables.</li>
            <li>Notifier les clients en cas de maintenance planifiée 48 h à l’avance.</li>
          </ul>
        </Section>

        <Section title="5. Données personnelles & confidentialité">
          <ul className="list-disc space-y-1 pl-5">
            <li>Les données de chaque PME cliente sont totalement isolées des autres comptes.</li>
            <li>DANXOME CREATIVE DISTRICT SARL ne revend aucune donnée à des tiers.</li>
            <li>Les conversations entre NOVA et les prospects sont stockées de façon sécurisée et chiffrée.</li>
            <li>Droit à l’oubli : suppression complète des données sur demande écrite sous 30 jours ouvrables.</li>
            <li>Conformité avec la législation béninoise sur la protection des données personnelles.</li>
          </ul>
        </Section>

        <Section title="6. Politique d’utilisation de WhatsApp">
          <ul className="list-disc space-y-1 pl-5">
            <li>La PME cliente est seule responsable du numéro WhatsApp connecté.</li>
            <li>NOVA respecte les règles anti-spam de WhatsApp et Meta.</li>
            <li>La PME s’engage à permettre à ses prospects de mettre fin aux communications à tout moment.</li>
            <li>
              DANXOME CREATIVE DISTRICT SARL ne pourra être tenu responsable d’une suspension de
              compte WhatsApp due à un usage abusif de la part de la PME cliente.
            </li>
          </ul>
        </Section>

        <Section title="7. Tarification & abonnements">
          <ul className="list-disc space-y-1 pl-5">
            <li>Les tarifs sont affichés sur la page de tarification de Z-APP.</li>
            <li>L’abonnement est mensuel et résiliable à tout moment, avec effet à la fin du mois en cours.</li>
            <li>Aucun remboursement ne sera effectué pour le mois en cours.</li>
            <li>Les tarifs peuvent être modifiés avec un préavis de 30 jours.</li>
          </ul>
        </Section>

        <Section title="8. Limitation de responsabilité">
          <ul className="list-disc space-y-1 pl-5">
            <li>DANXOME CREATIVE DISTRICT SARL n’est pas responsable des ventes conclues ou perdues via NOVA.</li>
            <li>Ni des informations erronées saisies par la PME dans sa base de connaissances.</li>
            <li>En cas de panne, rétablissement du service sous 4 heures ouvrables maximum.</li>
            <li>La responsabilité est limitée au montant de l’abonnement mensuel du client.</li>
          </ul>
        </Section>

        <Section title="9. Propriété intellectuelle">
          <ul className="list-disc space-y-1 pl-5">
            <li>Z-APP, NOVA et tous les éléments de la plateforme sont la propriété exclusive de DANXOME CREATIVE DISTRICT SARL.</li>
            <li>La PME conserve la propriété de ses données, son catalogue et ses informations commerciales.</li>
            <li>Toute reproduction ou copie de la plateforme est strictement interdite.</li>
          </ul>
        </Section>

        <Section title="10. Droit applicable & juridiction">
          <ul className="list-disc space-y-1 pl-5">
            <li>Les présentes CGU sont régies par le droit béninois.</li>
            <li>En cas de litige, recherche d’une solution amiable dans un délai de 30 jours.</li>
            <li>À défaut, compétence du Tribunal de Commerce de Cotonou, République du Bénin.</li>
          </ul>
        </Section>

        <Section title="Éditeur">
          <p>
            DANXOME CREATIVE DISTRICT SARL · Cotonou, République du Bénin · Contact :{' '}
            <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
              {EMAIL}
            </a>
          </p>
        </Section>
      </div>

      <LegalFooter />
    </main>
  );
}
