const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const ACCESS_KEY = 'listro_access_token';
const REFRESH_KEY = 'listro_refresh_token';
const USER_KEY = 'listro_user';

export const SESSION_EVENT = 'listro:session';

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
}

interface MeResponse {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: string;
  customer?: { id: string } | null;
  employee?: {
    id: string;
    branchMemberships?: Array<{ branchId: string }> | null;
  } | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

function notifySession(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setSession(
  token: string,
  user: unknown,
  refreshToken?: string | null,
): void {
  window.localStorage.setItem(ACCESS_KEY, token);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_KEY, refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_KEY);
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifySession();
}

export function getStoredUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
  notifySession();
}

let refreshInFlight: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  const attempt = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (!response.ok) return false;
      const result = (await response.json()) as TokenResponse;
      if (!result.accessToken) return false;
      setSession(
        result.accessToken,
        getStoredUser<unknown>() ?? {},
        result.refreshToken ?? refreshToken,
      );
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  refreshInFlight = attempt;
  return attempt;
}

function normalizeUser(me: MeResponse): Record<string, unknown> {
  return {
    id: me.id,
    firstName: me.firstName,
    lastName: me.lastName,
    email: me.email,
    role: me.role,
    customerId: me.customer?.id ?? null,
    employeeId: me.employee?.id ?? null,
    branchIds:
      me.employee?.branchMemberships?.map((member) => member.branchId) ?? [],
  };
}

export async function restoreSession(): Promise<boolean> {
  if (typeof window === 'undefined' || !getToken()) return false;
  try {
    const me = await api<MeResponse>('/me');
    const token = getToken();
    if (!token) return false;
    setSession(token, normalizeUser(me), getRefreshToken());
    return true;
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 401) clearSession();
    return getToken() !== null;
  }
}

export async function logout(): Promise<void> {
  const token = getToken();
  const refreshToken = getRefreshToken();
  if (token && refreshToken) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {}
  }
  clearSession();
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function failureMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    return Array.isArray(message)
      ? message.join(', ')
      : String(message);
  }
  return `Request failed with status ${status}`;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> {
  const authenticated =
    options.auth ??
    !['/auth/login', '/auth/register', '/auth/refresh'].includes(path);

  const send = async (): Promise<{ response: Response; payload: unknown }> => {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (authenticated) {
      const token = getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });
    return { response, payload: await readPayload(response) };
  };

  let { response, payload } = await send();
  if (authenticated && response.status === 401 && (await refreshAccessToken())) {
    ({ response, payload } = await send());
  }

  if (!response.ok) {
    if (authenticated && response.status === 401) clearSession();
    throw new ApiError(failureMessage(payload, response.status), response.status, payload);
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
