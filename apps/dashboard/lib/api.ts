const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('listro_access_token');
}

export function setSession(token: string, user: unknown): void {
  window.localStorage.setItem('listro_access_token', token);
  window.localStorage.setItem('listro_user', JSON.stringify(user));
}

export function getStoredUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('listro_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  window.localStorage.removeItem('listro_access_token');
  window.localStorage.removeItem('listro_user');
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? Array.isArray((payload as { message: unknown }).message)
          ? ((payload as { message: string[] }).message).join(', ')
          : String((payload as { message: unknown }).message)
        : `Request failed with status ${response.status}`;
    if (response.status === 401) clearSession();
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
