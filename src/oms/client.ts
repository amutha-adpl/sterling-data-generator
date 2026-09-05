/**
 * Minimal Sterling OMS REST client.
 *
 * Uses the platform `fetch` - no extra dependency. Nothing here writes to
 * disk and nothing logs the token or the password.
 */

import { z } from 'zod';
import type {
  OmsApiError,
  OmsCredentials,
  OmsInvokeOptions,
  OmsInvokeResult,
  OmsLoginResult,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Sterling reports an unauthenticated call with this code. */
const AUTH_ERROR_CODES = new Set(['YCP0427']);

/**
 * Accept `https://host`, `https://host/`, `https://host/smcfs` or
 * `https://host/smcfs/restapi` and return the REST root.
 */
export function normalizeBaseUrl(input: string): string {
  let base = input.trim().replace(/\/+$/, '');
  base = base.replace(/\/smcfs(\/restapi)?$/i, '');
  return `${base}/smcfs/restapi`;
}

/** Mask a token so it can appear in a log or an error message. */
export function redactToken(token: string): string {
  return token.length <= 8 ? '***' : `${token.slice(0, 4)}…${token.slice(-2)} (${token.length} chars)`;
}

export class OmsClientError extends Error {
  readonly status?: number;
  readonly apiError?: OmsApiError;

  constructor(message: string, status?: number, apiError?: OmsApiError) {
    super(message);
    this.name = 'OmsClientError';
    this.status = status;
    this.apiError = apiError;
  }
}

const loginResponseSchema = z.object({
  UserToken: z.string().min(1),
  LoginID: z.string().optional(),
  UserName: z.string().optional(),
  UserGroupID: z.string().optional(),
  OrganizationCode: z.string().optional(),
});

/**
 * Parse a Sterling error body. Sterling returns either:
 *   JSON: {"errors":[{"ErrorCode":"YCP0427","ErrorDescription":"..."}]}
 *   XML : <Errors><Error ErrorCode="YCP0427" ErrorDescription="..."/></Errors>
 */
export function parseSterlingError(body: string, httpCode: number): OmsApiError {
  const pick = (record: Record<string, unknown>): OmsApiError | undefined => {
    const code = typeof record.ErrorCode === 'string' ? record.ErrorCode : '';
    if (!code) return undefined;
    const description =
      typeof record.ErrorDescription === 'string' ? record.ErrorDescription : `Sterling error ${code}`;
    const unique =
      typeof record.ErrorUniqueExceptionId === 'string' && record.ErrorUniqueExceptionId
        ? record.ErrorUniqueExceptionId
        : undefined;
    return {
      code,
      description,
      httpCode,
      uniqueExceptionId: unique,
      isAuthError: AUTH_ERROR_CODES.has(code) || httpCode === 401 || httpCode === 403,
    };
  };

  // JSON form.
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object') {
      const errors = (parsed as { errors?: unknown }).errors;
      if (Array.isArray(errors)) {
        for (const entry of errors) {
          if (entry && typeof entry === 'object') {
            const found = pick(entry as Record<string, unknown>);
            if (found) return found;
          }
        }
      }
      const single = pick(parsed as Record<string, unknown>);
      if (single) return single;
    }
  } catch {
    // Not JSON - fall through to the XML form.
  }

  // XML form: <Error ErrorCode="..." ErrorDescription="..." .../>
  const errorTag = /<Error\b([^>]*)>/i.exec(body)?.[1];
  if (errorTag) {
    const attr = (name: string): string =>
      new RegExp(`${name}="([^"]*)"`, 'i').exec(errorTag)?.[1] ?? '';
    const code = attr('ErrorCode');
    if (code) {
      return {
        code,
        description: attr('ErrorDescription') || `Sterling error ${code}`,
        httpCode,
        uniqueExceptionId: attr('ErrorUniqueExceptionId') || undefined,
        isAuthError: AUTH_ERROR_CODES.has(code) || httpCode === 401 || httpCode === 403,
      };
    }
  }

  return {
    code: `HTTP_${httpCode}`,
    description: body.slice(0, 400) || `Request failed with HTTP ${httpCode}`,
    httpCode,
    isAuthError: httpCode === 401 || httpCode === 403,
  };
}

/** Log in and return the UserToken. */
export async function omsLogin(credentials: OmsCredentials): Promise<OmsLoginResult> {
  const url = `${normalizeBaseUrl(credentials.baseUrl)}/invoke/login`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ LoginID: credentials.loginId, Password: credentials.password }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new OmsClientError(`Could not reach the OMS at ${url} (${reason})`);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new OmsClientError(
      `Login failed with HTTP ${response.status}`,
      response.status,
      parseSterlingError(body, response.status),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new OmsClientError('Login response was not JSON - check the base URL.');
  }

  const result = loginResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new OmsClientError(
      'Login response did not contain a UserToken - is servlet.authstyle set to STANDARD?',
    );
  }

  return {
    token: result.data.UserToken,
    loginId: result.data.LoginID ?? credentials.loginId,
    userName: result.data.UserName ?? '',
    userGroupId: result.data.UserGroupID ?? '',
    organizationCode: result.data.OrganizationCode ?? '',
  };
}

/**
 * Invoke an API. Both `_loginid` and `_token` are sent - this instance
 * rejects `_token` on its own.
 */
export async function omsInvoke(options: OmsInvokeOptions): Promise<OmsInvokeResult> {
  const url = new URL(
    `${normalizeBaseUrl(options.baseUrl)}/invoke/${encodeURIComponent(options.api)}`,
  );
  url.searchParams.set('_loginid', options.loginId);
  url.searchParams.set('_token', options.token);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': options.contentType ?? 'application/xml',
        Accept: options.accept ?? 'application/json',
      },
      body: options.payload ?? '',
      signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new OmsClientError(`Could not reach the OMS (${reason})`);
  }

  const body = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    body,
    contentType: response.headers.get('content-type') ?? '',
    error: response.ok ? undefined : parseSterlingError(body, response.status),
  };
}