/**
 * Fetch client for the Asetto JSON API.
 *
 * Two modes, chosen by `VITE_API_MODE`:
 *  - `mock`  (default): routes to an in-browser store — no backend required.
 *  - `live`: talks to the real Asetto Laravel backend over cookies + Sanctum
 *            CSRF, exactly like the Akunta web apps do.
 *
 * Both paths resolve the same `api.get/post/patch/del` surface, so the pages and
 * query hooks never need to know which mode is active.
 */
import { handle } from './mock/handlers';
import { ApiMockError } from './mock/db';

const MODE = (import.meta.env.VITE_API_MODE as string) || 'mock';
const API_BASE = (import.meta.env.VITE_API_BASE as string) || '';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mockRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  await delay(120 + Math.random() * 180); // feel like a network
  try {
    return handle(method, path, body) as T;
  } catch (err) {
    if (err instanceof ApiMockError) throw new ApiError(err.status, err.message);
    throw err;
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function liveRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (MUTATING.has(method)) {
    // Prime the CSRF cookie; Sanctum rotates it on session regeneration.
    await fetch(`${API_BASE}/sanctum/csrf-cookie`, { credentials: 'include' });
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const xsrf = getCookie('XSRF-TOKEN');
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    window.location.href = `${API_BASE}/auth/ecopa/redirect`;
    throw new ApiError(401, 'Sesi berakhir — mengarahkan ke login Ecopa.');
  }
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (payload && (payload.message as string)) || `API error ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }
  // Laravel API resources often wrap in { data: ... }.
  return (payload && 'data' in payload ? payload.data : payload) as T;
}

async function liveUpload<T>(path: string, form: FormData): Promise<T> {
  await fetch(`${API_BASE}/sanctum/csrf-cookie`, { credentials: 'include' });
  const headers: Record<string, string> = { Accept: 'application/json' };
  const xsrf = getCookie('XSRF-TOKEN');
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method: 'POST',
    credentials: 'include',
    headers, // NB: no Content-Type — the browser sets the multipart boundary.
    body: form,
  });
  if (res.status === 401) {
    window.location.href = `${API_BASE}/auth/ecopa/redirect`;
    throw new ApiError(401, 'Sesi berakhir — mengarahkan ke login Ecopa.');
  }
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (payload && (payload.message as string)) || `API error ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }
  return (payload && 'data' in payload ? payload.data : payload) as T;
}

/** Mock upload: turn FormData into a plain object, files → ephemeral object URLs. */
async function mockUpload<T>(path: string, form: FormData): Promise<T> {
  await delay(160 + Math.random() * 180);
  const body: Record<string, unknown> = {};
  form.forEach((value, key) => {
    body[key] =
      value instanceof File
        ? { __file: true, name: value.name, mime: value.type, url: URL.createObjectURL(value) }
        : value;
  });
  try {
    return handle('POST', path, body) as T;
  } catch (err) {
    if (err instanceof ApiMockError) throw new ApiError(err.status, err.message);
    throw err;
  }
}

const request = MODE === 'live' ? liveRequest : mockRequest;
const upload = MODE === 'live' ? liveUpload : mockUpload;

export const api = {
  mode: MODE,
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => upload<T>(path, form),
};
