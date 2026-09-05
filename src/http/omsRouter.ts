/**
 * OMS connection API.
 *
 * All OMS traffic goes through here. The browser never talks to the OMS
 * directly - Sterling does not send CORS headers, so a direct call from the
 * page would be blocked. The token and password stay on the server.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { omsInvoke, OmsClientError } from '../oms/client.js';
import { clearSession, currentSession, ensureSession, forceRenew, login } from '../oms/session.js';

const baseUrlSchema = z
  .string()
  .trim()
  .min(1, 'Base URL is required.')
  .refine((value) => /^https?:\/\//i.test(value), 'Base URL must start with http:// or https://');

const loginSchema = z.object({
  baseUrl: baseUrlSchema,
  loginId: z.string().trim().min(1, 'Login ID is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const invokeSchema = z.object({
  api: z.string().trim().min(1, 'API name is required.'),
  payload: z.string().default(''),
  contentType: z.string().trim().optional(),
  accept: z.string().trim().optional(),
});

/** Read-only call used by the "Test connection" button. */
const TEST_API = 'getOrderList';
const TEST_PAYLOAD = '<Order MaximumRecords="1"/>';

function fail(res: Response, status: number, message: string, extra: Record<string, unknown> = {}) {
  res.status(status).json({ error: { message, ...extra } });
}

function handle(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    return fail(res, 400, error.issues.map((issue) => issue.message).join('; '));
  }
  if (error instanceof OmsClientError) {
    return fail(res, error.apiError?.httpCode && error.apiError.httpCode < 500 ? 400 : 502, error.message, {
      code: error.apiError?.code,
      uniqueExceptionId: error.apiError?.uniqueExceptionId,
    });
  }
  const message = error instanceof Error ? error.message : 'Unexpected error talking to the OMS';
  return fail(res, 500, message);
}

/**
 * Call an API, and if Sterling says the session is dead (YCP0427) log in
 * again once and retry. That is how we cope with an opaque token whose real
 * expiry we cannot read.
 */
async function invokeWithRetry(api: string, payload: string, contentType?: string, accept?: string) {
  const first = await ensureSession();
  let result = await omsInvoke({
    baseUrl: first.baseUrl,
    loginId: first.loginId,
    token: first.token,
    api,
    payload,
    contentType,
    accept,
  });

  if (!result.ok && result.error?.isAuthError) {
    const renewed = await forceRenew();
    if (renewed) {
      const second = await ensureSession();
      result = await omsInvoke({
        baseUrl: second.baseUrl,
        loginId: second.loginId,
        token: second.token,
        api,
        payload,
        contentType,
        accept,
      });
      return { result, retried: true };
    }
  }
  return { result, retried: false };
}

export const omsRouter = Router();

/** Current connection state (no secrets). */
omsRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ session: currentSession() });
});

omsRouter.post('/login', (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  login(parsed.data)
    .then((session) => res.json({ session }))
    .catch((error: unknown) => handle(res, error));
});

omsRouter.post('/logout', (_req: Request, res: Response) => {
  clearSession();
  res.json({ session: currentSession() });
});

/** Read-only smoke test - proves the token works without changing anything. */
omsRouter.post('/test', (_req: Request, res: Response) => {
  invokeWithRetry(TEST_API, TEST_PAYLOAD)
    .then(({ result, retried }) => {
      res.json({
        ok: result.ok,
        status: result.status,
        api: TEST_API,
        retried,
        body: result.body.slice(0, 20_000),
        contentType: result.contentType,
        error: result.error,
      });
    })
    .catch((error: unknown) => handle(res, error));
});

/** Invoke any API - used later for sending createOrder. */
omsRouter.post('/invoke', (req: Request, res: Response) => {
  const parsed = invokeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return fail(res, 400, parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  const { api, payload, contentType, accept } = parsed.data;
  invokeWithRetry(api, payload, contentType, accept)
    .then(({ result, retried }) => {
      res.json({
        ok: result.ok,
        status: result.status,
        api,
        retried,
        body: result.body.slice(0, 200_000),
        contentType: result.contentType,
        error: result.error,
      });
    })
    .catch((error: unknown) => handle(res, error));
});