/**
 * Types for talking to a Sterling OMS over its REST API.
 *
 * Confirmed against a live instance (see scripts/oms-recon.sh):
 *   login : POST /smcfs/restapi/invoke/login  {"LoginID","Password"} -> UserToken
 *   call  : POST /smcfs/restapi/invoke/<api>?_loginid=<user>&_token=<token>
 *
 * Both `_loginid` and `_token` are required - sending `_token` alone is
 * rejected with YCP0427 "user is not authenticated".
 */

/** Connection details supplied by the user. Never persisted. */
export interface OmsCredentials {
  /** e.g. `https://oms-host:8443`. `/smcfs/restapi` is appended automatically. */
  baseUrl: string;
  loginId: string;
  password: string;
}

/** Successful login, as returned by the OMS. */
export interface OmsLoginResult {
  token: string;
  loginId: string;
  userName: string;
  userGroupId: string;
  organizationCode: string;
}

/** A Sterling error, normalised from either its XML or JSON error body. */
export interface OmsApiError {
  code: string;
  description: string;
  httpCode: number;
  /** Sterling's correlation id - quote it when raising a support ticket. */
  uniqueExceptionId?: string;
  /** True when the session is not authenticated; the caller should re-login. */
  isAuthError: boolean;
}

export interface OmsInvokeOptions {
  baseUrl: string;
  loginId: string;
  token: string;
  /** API name, e.g. `getOrderList`. */
  api: string;
  /** Request body, as a string (XML or JSON). */
  payload?: string;
  contentType?: string;
  accept?: string;
  timeoutMs?: number;
}

export interface OmsInvokeResult {
  status: number;
  ok: boolean;
  body: string;
  contentType: string;
  error?: OmsApiError;
}

/**
 * The session as exposed to the browser.
 *
 * Deliberately excludes the token and the password - the UI never needs them
 * and they must not end up in the page, in localStorage or in a log.
 */
export interface OmsSessionView {
  connected: boolean;
  baseUrl: string;
  loginId: string;
  userName: string;
  userGroupId: string;
  organizationCode: string;
  /** Epoch ms when the token was issued (informational only). */
  obtainedAt: number;
}