import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchGenerators,
  generate,
  DISCONNECTED_SESSION,
  omsInvoke,
  omsLogin,
  omsLogout,
  omsStatus,
  omsTest,
  type GenerateResponse,
  type GeneratorSummary,
  type OmsInvokeResponse,
  type OmsSession,
  type OutputFormat,
} from './api.js';
import { copyText } from './clipboard.js';
import ConnectionView from './components/ConnectionView.js';
import ResponsePanel from './components/ResponsePanel.js';
import OptionsForm, { type OptionValue } from './components/OptionsForm.js';
import PreviewToolbar from './components/PreviewToolbar.js';
import CodePreview from './components/CodePreview.js';

export default function App() {
  const [generators, setGenerators] = useState<GeneratorSummary[]>([]);
  const [generatorId, setGeneratorId] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<Record<string, unknown>>({});
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [format, setFormat] = useState<OutputFormat>('xml');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState('Loading generators…');
  const [isError, setIsError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const requestToken = useRef(0);
  const [omsSession, setOmsSession] = useState<OmsSession>(DISCONNECTED_SESSION);
  const [omsBusy, setOmsBusy] = useState(false);
  const [omsTestResult, setOmsTestResult] = useState<OmsInvokeResponse | null>(null);
  const [omsError, setOmsError] = useState<string | null>(null);
  const [view, setView] = useState<'generate' | 'connection'>('generate');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<OmsInvokeResponse | null>(null);

  const selected = generators.find((generator) => generator.id === generatorId) ?? null;
  const documents = result?.documents ?? [];
  const current = documents[currentIndex];
  const source = format === 'json' ? current?.json : current?.xml;

  // Load the generator catalogue once.
  useEffect(() => {
    let cancelled = false;
    fetchGenerators()
      .then(({ generators: loaded }) => {
        if (cancelled) return;
        setGenerators(loaded);
        const first = loaded[0];
        if (!first) return;
        setGeneratorId(first.id);
        setDefaults(first.defaults);
        setOptions(first.defaults);
        setFormat(first.formats[0] ?? 'xml');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(messageOf(error));
        setIsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the current OMS connection state once.
  useEffect(() => {
    omsStatus()
      .then(({ session }) => setOmsSession(session))
      .catch(() => setOmsSession(DISCONNECTED_SESSION));
  }, []);

  const handleOmsLogin = async (details: { baseUrl: string; loginId: string; password: string }) => {
    setOmsBusy(true);
    setOmsError(null);
    setOmsTestResult(null);
    try {
      const { session } = await omsLogin(details);
      setOmsSession(session);
      setToast('Connected to the OMS');
    } catch (error) {
      setOmsError(messageOf(error));
    } finally {
      setOmsBusy(false);
    }
  };

  const handleOmsLogout = async () => {
    setOmsBusy(true);
    try {
      const { session } = await omsLogout();
      setOmsSession(session);
      setOmsTestResult(null);
      setToast('Disconnected - the token and password were discarded');
    } catch (error) {
      setOmsError(messageOf(error));
    } finally {
      setOmsBusy(false);
    }
  };

  const handleOmsTest = async () => {
    setOmsBusy(true);
    setOmsError(null);
    try {
      setOmsTestResult(await omsTest());
    } catch (error) {
      setOmsError(messageOf(error));
    } finally {
      setOmsBusy(false);
    }
  };

  const handleSend = async () => {
    if (!current) return;
    // The generator declares its own API name, so new APIs need no change here.
    const apiName = selected?.apiName ?? 'createOrder';
    if (!omsSession.connected) {
      setToast('Connect to an OMS first');
      setView('connection');
      return;
    }
    // Sterling expects the input document as XML.
    const payload = current.xml;
    if (!payload) {
      setToast('This order has no XML payload to send');
      return;
    }
    if (/prod/i.test(omsSession.baseUrl)) {
      const confirmed = window.confirm(
        `Send this order to ${omsSession.baseUrl}?\n\nThis looks like a PRODUCTION environment.`,
      );
      if (!confirmed) return;
    }
    setSending(true);
    try {
      const result = await omsInvoke(apiName, payload, 'application/xml');
      setSendResult(result);
      setToast(
        result.ok
          ? `Order sent — HTTP ${result.status}`
          : `Send failed — ${result.error?.code ?? `HTTP ${result.status}`}`,
      );
    } catch (error) {
      setToast(messageOf(error));
    } finally {
      setSending(false);
    }
  };

  const runGenerate = useCallback(async (id: string, currentOptions: Record<string, unknown>) => {
    const token = requestToken.current + 1;
    requestToken.current = token;
    setStatus('Generating…');
    setIsError(false);
    try {
      const data = await generate(id, currentOptions);
      if (token !== requestToken.current) return; // a newer request has landed
      setResult(data);
      setCurrentIndex((index) => Math.min(index, Math.max(data.documents.length - 1, 0)));
      setStatus(`${data.meta.count} order(s) generated in ${data.meta.durationMs} ms`);
    } catch (error) {
      if (token !== requestToken.current) return;
      setStatus(messageOf(error));
      setIsError(true);
    }
  }, []);

  // Regenerate (debounced) whenever the selection or an option changes.
  useEffect(() => {
    if (!generatorId) return;
    const timer = window.setTimeout(() => {
      void runGenerate(generatorId, options);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [generatorId, options, runGenerate]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleGeneratorChange = (id: string) => {
    const generator = generators.find((item) => item.id === id);
    if (!generator) return;
    setGeneratorId(generator.id);
    setDefaults(generator.defaults);
    setOptions(generator.defaults);
    setFormat(generator.formats[0] ?? 'xml');
    setCurrentIndex(0);
  };

  const handleChange = (name: string, value: OptionValue) => {
    setOptions((previous) => ({ ...previous, [name]: value }));
  };

  const handleCopy = async () => {
    if (!source) return;
    const copied = await copyText(source);
    setToast(copied ? 'Copied to clipboard' : 'Copy failed - select the text or use Download');
  };

  const handleDownloadOne = () => {
    if (!current || !source) return;
    saveFile(`${filePrefix()}_${current.key}.${format}`, source, mimeType(format));
  };

  const handleDownloadAll = () => {
    const bundle = format === 'json' ? result?.bundle.json : result?.bundle.xml;
    if (!bundle) return;
    const suffix = documents.length === 1 && current ? current.key : `${documents.length}-orders`;
    saveFile(`${filePrefix()}_${suffix}.${format}`, bundle, mimeType(format));
  };

  const filePrefix = () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `${generatorId ?? 'createOrder'}_${stamp}`;
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header__titles">
          <h1>Sterling Sample Data Generator</h1>
          <p>
            {selected
              ? `${selected.apiName} - ${selected.description}`
              : 'Loading generators…'}
          </p>
        </div>
        <div className="app-header__actions">
          <label className="field-inline">
            <span>API</span>
            <select value={generatorId ?? ''} onChange={(event) => handleGeneratorChange(event.target.value)}>
              {generators.map((generator) => (
                <option key={generator.id} value={generator.id}>
                  {generator.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <nav className="app-nav" aria-label="Views">
        <button
          type="button"
          className={`app-nav__item${view === 'generate' ? ' is-active' : ''}`}
          onClick={() => setView('generate')}
        >
          Generator
        </button>
        <button
          type="button"
          className={`app-nav__item${view === 'connection' ? ' is-active' : ''}`}
          onClick={() => setView('connection')}
        >
          OMS connection
          {omsSession.connected ? <span className="app-nav__dot" aria-label="connected" /> : null}
        </button>
      </nav>

      {view === 'connection' ? (
        <ConnectionView
          session={omsSession}
          busy={omsBusy}
          testResult={omsTestResult}
          error={omsError}
          onLogin={handleOmsLogin}
          onLogout={handleOmsLogout}
          onTest={handleOmsTest}
          onDismissTest={() => setOmsTestResult(null)}
        />
      ) : (
      <main className="layout">
        <OptionsForm
          fields={selected?.fields ?? []}
          options={options}
          status={status}
          isError={isError}
          onChange={handleChange}
          onReset={() => setOptions({ ...defaults })}
          onSubmit={() => generatorId && void runGenerate(generatorId, options)}
        />

        <section className="panel panel--preview" aria-label="Payload preview">
          <PreviewToolbar
            formats={selected?.formats ?? ['xml', 'json']}
            format={format}
            documents={documents}
            currentIndex={currentIndex}
            onFormatChange={setFormat}
            onIndexChange={setCurrentIndex}
            onCopy={() => void handleCopy()}
            onDownloadOne={handleDownloadOne}
            onDownloadAll={handleDownloadAll}
            onSend={() => void handleSend()}
            canSend={omsSession.connected && Boolean(current?.xml)}
            sending={sending}
          />
          <CodePreview
            source={source ?? 'Generating sample data…'}
            format={format}
          />
          {sendResult ? (
            <ResponsePanel
              result={sendResult}
              label={current ? `Send ${current.label}` : undefined}
              onClose={() => setSendResult(null)}
            />
          ) : null}
        </section>
      </main>
      )}

      <footer className="app-footer">
        <span>
          Payloads are generated locally. Nothing is sent to an OMS until you press Send. Emails use the reserved{' '}
          <code>example.com</code> domain and payment data is synthetic.
        </span>
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function mimeType(format: OutputFormat): string {
  return format === 'json' ? 'application/json;charset=utf-8' : 'application/xml;charset=utf-8';
}

function saveFile(fileName: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}