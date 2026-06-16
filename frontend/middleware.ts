import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protection edge des routes du dashboard.
 * Note : le cookie de refresh httpOnly appartient à l'origine de l'API (port 3001)
 * et n'est donc pas lisible ici (origine 3000). On s'appuie sur un marqueur léger
 * `zapp_session` posé côté client après connexion ; la sécurité réelle reste assurée
 * par le JWT vérifié par l'API sur chaque route protégée.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.get('zapp_session')?.value === '1';
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/whatsapp/:path*'],
};
