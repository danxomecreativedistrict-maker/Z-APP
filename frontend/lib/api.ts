// Client API minimal — sera enrichi (auth, refresh token) au Module 2.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !body.success) {
    throw new Error(body?.message ?? 'Une erreur réseau est survenue.');
  }

  return body;
}
