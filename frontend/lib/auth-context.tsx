'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const SESSION_FLAG = 'zapp_session';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  verified: boolean;
  plan: string;
  termsUpToDate: boolean;
}

interface SessionData {
  accessToken: string;
  user: AuthUser;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  marketingEmails?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  register: (payload: RegisterPayload) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  acceptTerms: () => Promise<void>;
  authFetch: <T>(path: string, options?: RequestInit) => Promise<ApiResponse<T>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function publicCall<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new Error('Réponse invalide du serveur.');
  }
  if (!res.ok || !body.success) {
    throw new Error(body?.message ?? 'Une erreur est survenue.');
  }
  return body;
}

function setSessionFlag(): void {
  document.cookie = `${SESSION_FLAG}=1; path=/; max-age=${7 * 24 * 3600}; samesite=lax`;
}

function clearSessionFlag(): void {
  document.cookie = `${SESSION_FLAG}=; path=/; max-age=0; samesite=lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  const applySession = useCallback((data: SessionData) => {
    accessTokenRef.current = data.accessToken;
    setUser(data.user);
    setSessionFlag();
  }, []);

  const refreshAccess = useCallback(async (): Promise<boolean> => {
    try {
      const res = await publicCall<SessionData>('/auth/refresh', { method: 'POST' });
      applySession(res.data);
      return true;
    } catch {
      accessTokenRef.current = null;
      setUser(null);
      clearSessionFlag();
      return false;
    }
  }, [applySession]);

  useEffect(() => {
    let active = true;
    (async () => {
      await refreshAccess();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refreshAccess]);

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
      const isForm = options.body instanceof FormData;
      const buildHeaders = (): HeadersInit => ({
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}),
        ...(options.headers ?? {}),
      });
      const run = () =>
        fetch(`${API_URL}${path}`, { ...options, credentials: 'include', headers: buildHeaders() });

      let res = await run();
      if (res.status === 401 && (await refreshAccess())) {
        res = await run();
      }
      let body: ApiResponse<T>;
      try {
        body = (await res.json()) as ApiResponse<T>;
      } catch {
        throw new Error('Réponse invalide du serveur.');
      }
      if (!res.ok || !body.success) {
        throw new Error(body?.message ?? 'Une erreur est survenue.');
      }
      return body;
    },
    [refreshAccess],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    await publicCall('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  }, []);

  const verifyOtp = useCallback(
    async (email: string, code: string) => {
      const res = await publicCall<SessionData>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      applySession(res.data);
    },
    [applySession],
  );

  const resendOtp = useCallback(async (email: string) => {
    await publicCall('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await publicCall<SessionData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      applySession(res.data);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await publicCall('/auth/logout', { method: 'POST' });
    } catch {
      // on nettoie l'état local quoi qu'il arrive
    }
    accessTokenRef.current = null;
    setUser(null);
    clearSessionFlag();
  }, []);

  const acceptTerms = useCallback(async () => {
    const res = await authFetch<AuthUser>('/auth/accept-terms', { method: 'POST' });
    setUser(res.data);
  }, [authFetch]);

  return (
    <AuthContext.Provider
      value={{ user, loading, register, verifyOtp, resendOtp, login, logout, acceptTerms, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un <AuthProvider>.");
  }
  return ctx;
}
