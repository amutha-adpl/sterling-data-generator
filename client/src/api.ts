/**
 * Typed client for the generator API (see src/http/api.ts).
 *
 * Requests are relative so the same code works against the Vite dev proxy
 * (port 3000 -> 3001) and the bundled Express server in production.
 */

export type OutputFormat = 'xml' | 'json';

export type FieldSpec =
  | {
      name: string;
      label: string;
      group: string;
      help?: string;
      inputType?: string;
      kind: 'number';
      min: number;
      max: number;
      step?: number;
    }
  | { name: string; label: string; group: string; help?: string; inputType?: string; kind: 'text'; placeholder?: string; maxLength?: number }
  | { name: string; label: string; group: string; help?: string; inputType?: string; kind: 'select'; options: ReadonlyArray<{ value: string; label: string }> }
  /** Free text with suggested values - lets you type codes this list does not know. */
  | { name: string; label: string; group: string; help?: string; inputType?: string; kind: 'combo'; options: ReadonlyArray<{ value: string; label: string }>; placeholder?: string }
  | { name: string; label: string; group: string; help?: string; inputType?: string; kind: 'boolean' };

export interface GeneratorSummary {
  id: string;
  label: string;
  apiName: string;
  description: string;
  formats: ReadonlyArray<OutputFormat>;
  fields: ReadonlyArray<FieldSpec>;
  defaults: Record<string, unknown>;
}

export interface GeneratedDocument {
  key: string;
  label: string;
  xml: string | null;
  json: string | null;
}

export interface GenerateResponse {
  generatorId: string;
  apiName: string;
  options: Record<string, unknown>;
  documents: GeneratedDocument[];
  bundle: { xml: string | null; json: string | null };
  meta: { count: number; generatedAt: string; durationMs: number };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string; issues?: Array<{ path: string; message: string }> } })
    | null;

  if (!response.ok || !payload) {
    const error = payload?.error;
    const message = error?.issues?.length
      ? error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
      : error?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export function fetchGenerators(): Promise<{ generators: GeneratorSummary[] }> {
  return request('/api/generators');
}

export function generate(
  generatorId: string,
  options: Record<string, unknown>,
): Promise<GenerateResponse> {
  return request('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generatorId, options }),
  });
}

/* ------------------------------------------------------------------ *
 * OMS connection
 *
 * The token and the password never come back to the browser - the server
 * holds them and proxies every call (Sterling sends no CORS headers, so a
 * call straight from the page would be blocked anyway).
 * ------------------------------------------------------------------ */

export interface OmsSession {
  connected: boolean;
  baseUrl: string;
  loginId: string;
  userName: string;
  userGroupId: string;
  organizationCode: string;
  obtainedAt: number;
}

/** Placeholder used before the first status call resolves. */
export const DISCONNECTED_SESSION: OmsSession = {
  connected: false,
  baseUrl: '',
  loginId: '',
  userName: '',
  userGroupId: '',
  organizationCode: '',
  obtainedAt: 0,
};

export interface OmsApiError {
  code: string;
  description: string;
  httpCode: number;
  uniqueExceptionId?: string;
  isAuthError: boolean;
}

export interface OmsInvokeResponse {
  ok: boolean;
  status: number;
  api: string;
  /** True when the first call hit an expired token and was retried. */
  retried: boolean;
  body: string;
  contentType: string;
  error?: OmsApiError;
  /** Exactly what was posted to the OMS - echoed back for verification. */
  request?: { api: string; payload: string; contentType: string };
}

export function omsStatus(): Promise<{ session: OmsSession }> {
  return request('/api/oms/status');
}

export function omsLogin(details: {
  baseUrl: string;
  loginId: string;
  password: string;
}): Promise<{ session: OmsSession }> {
  return request('/api/oms/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  });
}

export function omsLogout(): Promise<{ session: OmsSession }> {
  return request('/api/oms/logout', { method: 'POST' });
}

/** Read-only smoke test: calls getOrderList and shows the response. */
export function omsTest(): Promise<OmsInvokeResponse> {
  return request('/api/oms/test', { method: 'POST' });
}

export function omsInvoke(
  api: string,
  payload: string,
  contentType = 'application/xml',
): Promise<OmsInvokeResponse> {
  return request('/api/oms/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api, payload, contentType }),
  });
}