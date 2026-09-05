/**
 * Server-side OMS session holder.
 *
 * The token - and the password needed to renew it - live only in this Node
 * process. Nothing is written to disk, nothing is logged, and the browser
 * never receives either value (see `OmsSessionView`). Restarting the server
 * or pressing Logout discards them.
 *
 * There is deliberately no countdown and no proactive renewal. Sterling's
 * token is opaque, so its real lifetime cannot be decoded, and guessing only
 * burns logins. Instead we keep using the token until the OMS rejects it, and
 * re-login then - see `invokeWithRetry` in src/http/omsRouter.ts.
 */

import { omsLogin, OmsClientError } from './client.js';
import type { OmsCredentials, OmsSessionView } from './types.js';

interface ActiveSession {
  token: string;
  baseUrl: string;
  loginId: string;
  userName: string;
  userGroupId: string;
  organizationCode: string;
  obtainedAt: number;
  /** Held in memory only so the token can be renewed. Never persisted. */
  password: string;
}

let active: ActiveSession | null = null;

function toView(session: ActiveSession): OmsSessionView {
  return {
    connected: true,
    baseUrl: session.baseUrl,
    loginId: session.loginId,
    userName: session.userName,
    userGroupId: session.userGroupId,
    organizationCode: session.organizationCode,
    obtainedAt: session.obtainedAt,
  };
}

export const DISCONNECTED: OmsSessionView = {
  connected: false,
  baseUrl: '',
  loginId: '',
  userName: '',
  userGroupId: '',
  organizationCode: '',
  obtainedAt: 0,
};

/** The current session, minus anything secret. */
export function currentSession(): OmsSessionView {
  return active ? toView(active) : { ...DISCONNECTED };
}

/** Drop the session and the in-memory password immediately. */
export function clearSession(): void {
  active = null;
}

export async function login(credentials: OmsCredentials): Promise<OmsSessionView> {
  const result = await omsLogin(credentials);
  const now = Date.now();
  active = {
    token: result.token,
    baseUrl: credentials.baseUrl,
    loginId: result.loginId,
    userName: result.userName,
    userGroupId: result.userGroupId,
    organizationCode: result.organizationCode,
    obtainedAt: now,
    password: credentials.password,
  };
  return toView(active);
}

async function renew(session: ActiveSession): Promise<ActiveSession> {
  const result = await omsLogin({
    baseUrl: session.baseUrl,
    loginId: session.loginId,
    password: session.password,
  });
  const now = Date.now();
  active = { ...session, token: result.token, obtainedAt: now };
  return active;
}

/**
 * Return the current session.
 *
 * No expiry check: the token is opaque so we cannot know when it really
 * lapses. We use it until the OMS says otherwise, then re-login.
 * Throws when there is no session at all.
 */
export async function ensureSession(): Promise<ActiveSession> {
  if (!active) {
    throw new OmsClientError('Not connected to an OMS. Log in first.');
  }
  return active;
}

/**
 * Re-login immediately, e.g. after a call came back with YCP0427.
 * Returns false when there is no stored password to renew with.
 */
export async function forceRenew(): Promise<boolean> {
  if (!active) return false;
  try {
    await renew(active);
    return true;
  } catch {
    clearSession();
    return false;
  }
}