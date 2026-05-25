import { supabase } from './supabase'

const RAW_BASE_URL = import.meta.env.VITE_API_URL || '';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, ''); // strip trailing slash

export const API_BASE_URL = BASE_URL;

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch (err) {
    console.error('[API] Failed to get auth headers:', err);
    return {};
  }
}

function buildUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${cleanPath}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const url = buildUrl(path);
  const method = options?.method || 'GET';
  const hasBody = !!(options?.body);

  console.log(`[API] ${method} ${url}${hasBody ? '' : ' (no body)'}`);
  if (authHeaders.Authorization) {
    console.log(`[API] Auth: Bearer ${authHeaders.Authorization.slice(7, 27)}...`);
  }

  // Only set Content-Type when there's a body — Fastify rejects empty JSON bodies
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(options?.headers as Record<string, string>),
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      ...options,
    });
  } catch (err: any) {
    const msg = err.message === 'Failed to fetch'
      ? `Network error: Cannot reach ${url}. Backend may be down.`
      : err.message || 'Network request failed';
    console.error(`[API] Network error ${method} ${url}:`, msg);
    throw new Error(msg);
  }

  if (!res.ok) {
    let errorBody: any = {};
    try {
      errorBody = await res.json();
    } catch {
      errorBody = { message: `HTTP ${res.status} ${res.statusText}` };
    }

    const message = errorBody.error
      || errorBody.message
      || errorBody.details
      || `Request failed: ${res.status}`;

    console.error(`[API] ${res.status} ${method} ${url}: ${message}`);
    console.error('[API] Response body:', errorBody);

    throw new Error(message);
  }

  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`[API] JSON parse error for ${method} ${url}:`, text.slice(0, 200));
    throw new Error('Invalid JSON response from server');
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
