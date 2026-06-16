import Link from 'next/link';

export function LegalFooter() {
  return (
    <footer className="mt-12 border-t border-border py-6 text-center text-xs text-muted-foreground">
      <p>
        Z-APP — Édité par <span className="font-medium">DANXOME CREATIVE DISTRICT SARL</span> ·
        Cotonou, République du Bénin
      </p>
      <p className="mt-1">
        <a href="mailto:danxomecreativedistrict@gmail.com" className="hover:underline">
          danxomecreativedistrict@gmail.com
        </a>
      </p>
      <div className="mt-2 flex justify-center gap-4">
        <Link href="/terms" className="hover:underline">
          CGU
        </Link>
        <Link href="/privacy" className="hover:underline">
          Confidentialité
        </Link>
      </div>
    </footer>
  );
}
