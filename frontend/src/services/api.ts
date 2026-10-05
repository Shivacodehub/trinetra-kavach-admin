const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";
const TOKEN_KEY = "tk_token";
const EXP_KEY = "tk_token_exp";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: { field: string; message: string }[] | null) {
    super(message);
  }
}

/** Token lives in sessionStorage (cleared on tab close) or localStorage when "Remember me" is ticked. Never holds app data. */
export const tokenStore = {
  get(): string | null {
    const exp = Number(localStorage.getItem(EXP_KEY) ?? sessionStorage.getItem(EXP_KEY) ?? 0);
    if (exp && Date.now() > exp) { this.clear(); return null; }
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  },
  set(token: string, expiresInSec: number, remember: boolean) {
    this.clear();
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(EXP_KEY, String(Date.now() + expiresInSec * 1000));
  },
  clear() {
    for (const s of [localStorage, sessionStorage]) { s.removeItem(TOKEN_KEY); s.removeItem(EXP_KEY); }
  },
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

type Query = Record<string, string | number | boolean | null | undefined>;

async function request(path: string, opts: { method?: string; body?: unknown; query?: Query; auth?: boolean }): Promise<Response> {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = opts.auth === false ? null : tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method: opts.method ?? "GET", headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check that the backend is running.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = data?.error;
    if (res.status === 401 && opts.auth !== false && token) onUnauthorized?.();
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return res;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; query?: Query; auth?: boolean } = {}): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** For authenticated binary/text downloads (CSV export, QR image). */
export async function apiBlob(path: string, query: Query = {}): Promise<Blob> {
  return (await request(path, { query })).blob();
}
