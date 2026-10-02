/**
 * Thin, typed fetch client for the FastAPI backend.
 *
 * - Base URL from VITE_API_URL (default http://localhost:8000)
 * - Bearer token + active workspace header injected automatically
 * - 401 → session cleared and listeners notified (AuthProvider redirects to /login)
 * - Errors normalized into ApiError with the server's `detail` message
 */

export const API_URL: string = (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:8000";
const TOKEN_KEY = "eai.token";
const ORG_KEY = "eai.org";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

const isBrowser = typeof window !== "undefined";

function readStorage(key: string): string | null {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  if (!isBrowser) return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — session lives in memory only */
  }
}

let memToken: string | null = null;
let memOrg: string | null = null;

export const session = {
  get token(): string | null {
    return memToken ?? readStorage(TOKEN_KEY);
  },
  set token(v: string | null) {
    memToken = v;
    writeStorage(TOKEN_KEY, v);
  },
  get orgId(): string | null {
    return memOrg ?? readStorage(ORG_KEY);
  },
  set orgId(v: string | null) {
    memOrg = v;
    writeStorage(ORG_KEY, v);
  },
  clear() {
    this.token = null;
    this.orgId = null;
  },
  onUnauthorized(fn: Listener) {
    unauthorizedListeners.add(fn);
    return () => unauthorizedListeners.delete(fn);
  },
};

export interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  auth?: boolean;
  signal?: AbortSignal;
  raw?: boolean;
}

export function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_URL}/api/v1${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function authHeaders(auth = true): Record<string, string> {
  const h: Record<string, string> = {};
  const token = session.token;
  if (auth && token) h["Authorization"] = `Bearer ${token}`;
  const org = session.orgId;
  if (auth && org) h["X-Organization-Id"] = org;
  return h;
}

export async function apiRaw(path: string, opts: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { ...authHeaders(opts.auth !== false), ...(opts.headers ?? {}) };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? (body ? "POST" : "GET"),
      headers,
      ...(body !== undefined ? { body } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(`Cannot reach the API at ${API_URL}. Is the backend running?`, 0);
  }
  if (res.status === 401 && opts.auth !== false && session.token) {
    session.token = null;
    unauthorizedListeners.forEach((fn) => fn());
  }
  if (!res.ok) {
    let detail: unknown = undefined;
    let message = `${res.status} ${res.statusText}`;
    try {
      detail = await res.json();
      const d = (detail as { detail?: unknown }).detail;
      if (typeof d === "string") message = d;
      else if (Array.isArray(d) && d[0] && typeof d[0] === "object") message = String((d[0] as { msg?: string }).msg ?? message);
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(message, res.status, detail);
  }
  return res;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await apiRaw(path, opts);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("application/json") ? await res.json() : await res.text()) as T;
}

/** Fetch an authenticated binary resource and trigger a browser download. */
export async function downloadFile(path: string, fallbackName = "download", opts: RequestOptions = {}): Promise<void> {
  const res = await apiRaw(path, opts);
  const blob = await res.blob();
  const disp = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disp);
  const name = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Authenticated blob URL (for <img> of private assets). Cached per path. */
const blobCache = new Map<string, Promise<string>>();
export function blobUrl(path: string): Promise<string> {
  let p = blobCache.get(path);
  if (!p) {
    p = apiRaw(path).then(async (r) => URL.createObjectURL(await r.blob()));
    p.catch(() => blobCache.delete(path));
    blobCache.set(path, p);
  }
  return p;
}

export function wsUrl(httpUrl: string): string {
  // The server returns an absolute ws URL based on its own host; prefer the configured API host.
  try {
    const u = new URL(httpUrl);
    const base = new URL(API_URL);
    u.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    u.host = base.host;
    return u.toString();
  } catch {
    return httpUrl;
  }
}
