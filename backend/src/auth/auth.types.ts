/** Version courante des CGU/Politique de confidentialité (DANXOME CREATIVE DISTRICT SARL). */
export const CURRENT_TERMS_VERSION = 'v1.0';

/** Représentation publique d'un utilisateur (jamais le hash du mot de passe). */
export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  verified: boolean;
  plan: string;
  /** false si les CGU acceptées ne sont plus à jour → re-acceptation requise. */
  termsUpToDate: boolean;
}

export interface SessionResult {
  accessToken: string;
  user: PublicUser;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}
