const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type ApiError = { code: string; message: string; details?: unknown };

export class ApiErrorResponse extends Error {
  readonly status: number;
  readonly apiError: ApiError | null;
  constructor(status: number, apiError: ApiError | null) {
    super(apiError?.message ?? `Request failed: ${status}`);
    this.status = status;
    this.apiError = apiError;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) window.localStorage.setItem('ics_access_token', token);
    else window.localStorage.removeItem('ics_access_token');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = window.localStorage.getItem('ics_access_token');
  }
  return accessToken;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      const retry = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });
      return handleResponse<T>(retry);
    }
  }
  return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: ApiError } | null;
    throw new ApiErrorResponse(res.status, body?.error ?? null);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Singleton in-flight refresh promise. When several requests 401 in parallel
// (common on app load with N TanStack queries), they must all await the SAME
// /auth/refresh — otherwise the first rotates the refresh token and the rest
// validate against the now-revoked row, all returning 401, and the user gets
// kicked out despite holding a valid session.
let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { accessToken: string };
      setAccessToken(body.accessToken);
      return body.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
