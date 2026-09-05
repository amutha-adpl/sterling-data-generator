import { useState, type FormEvent } from 'react';
import type { OmsInvokeResponse, OmsSession } from '../api.js';
import ResponsePanel from './ResponsePanel.js';

interface Props {
  session: OmsSession;
  busy: boolean;
  testResult: OmsInvokeResponse | null;
  error: string | null;
  onLogin: (details: { baseUrl: string; loginId: string; password: string }) => Promise<void>;
  onLogout: () => Promise<void>;
  onTest: () => Promise<void>;
  onDismissTest: () => void;
}

/**
 * OMS connection page.
 *
 * Login lives on its own page rather than in a bar above the generator, so the
 * generator view stays focused on payloads.
 */
export default function ConnectionView({
  session,
  busy,
  testResult,
  error,
  onLogin,
  onLogout,
  onTest,
  onDismissTest,
}: Props) {
  const [baseUrl, setBaseUrl] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  if (!session.connected) {
    return (
      <main className="page">
        <section className="card" aria-label="OMS connection">
          <h2>Connect to an OMS</h2>
          <p className="card__hint">
            Enter the base URL of your Sterling instance — <code>/smcfs/restapi</code> is added
            automatically.
          </p>

          <form
            className="card__form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void onLogin({ baseUrl, loginId, password }).then(
                () => setPassword(''),
                () => undefined,
              );
            }}
          >
            <label className="field">
              <span>OMS base URL</span>
              <input
                type="url"
                value={baseUrl}
                placeholder="https://oms-host:8443"
                onChange={(event) => setBaseUrl(event.target.value)}
                required
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Login ID</span>
                <input
                  type="text"
                  value={loginId}
                  autoComplete="username"
                  onChange={(event) => setLoginId(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="card__actions">
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </form>

          <p className="card__note">
            The password is used once to obtain a token, then held in the server's memory only —
            never written to disk, never logged, and never sent back to the browser. Restarting the
            server or disconnecting discards it.
          </p>

          {error ? <p className="card__error">{error}</p> : null}
        </section>
      </main>
    );
  }

  const host = hostOf(session.baseUrl);

  return (
    <main className="page">
      <section className="card" aria-label="OMS connection">
        <header className="card__head">
          <h2>
            Connected{host ? <span className="card__host"> to {host}</span> : null}
          </h2>
          <span className="badge badge--ok">Connected</span>
          {/prod/i.test(host) ? <span className="badge badge--danger">PRODUCTION</span> : null}
        </header>

        <dl className="detail-grid">
          <div>
            <dt>User</dt>
            <dd>{session.userName || '—'}</dd>
          </div>
          <div>
            <dt>Login ID</dt>
            <dd>{session.loginId}</dd>
          </div>
          <div>
            <dt>User group</dt>
            <dd>{session.userGroupId || '—'}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{session.organizationCode || '—'}</dd>
          </div>
          <div>
            <dt>Base URL</dt>
            <dd className="detail-grid__mono">{session.baseUrl}</dd>
          </div>
          <div>
            <dt>Connected since</dt>
            <dd>{formatTime(session.obtainedAt)}</dd>
          </div>
        </dl>

        <div className="card__actions">
          <button className="btn btn--primary" type="button" onClick={() => void onTest()} disabled={busy}>
            {busy ? 'Working…' : 'Test connection'}
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => void onLogout()} disabled={busy}>
            Disconnect
          </button>
        </div>

        <p className="card__note">
          Test connection calls <code>getOrderList</code> read-only — it proves the token works
          without changing anything.
        </p>

        {error ? <p className="card__error">{error}</p> : null}
        {testResult ? <ResponsePanel result={testResult} onClose={onDismissTest} /> : null}
      </section>
    </main>
  );
}

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function formatTime(epochMs: number): string {
  if (!epochMs) return '—';
  return new Date(epochMs).toLocaleTimeString();
}