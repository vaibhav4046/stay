'use client';

import { useEffect, useState } from 'react';
import { byokHeaders, clearByok, EMPTY_BYOK, loadByok, saveByok, type ByokConfig } from '@/lib/byok/config';
import { PRESETS, type ProviderId } from '@/lib/byok/presets';

const PROVIDER_CHIPS: Array<{ id: ProviderId; label: string }> = [
  { id: 'default', label: 'Stay default (free, shared)' },
  { id: 'groq', label: PRESETS.groq.label },
  { id: 'mistral', label: PRESETS.mistral.label },
  { id: 'openai', label: PRESETS.openai.label },
  { id: 'custom', label: 'Other (OpenAI-compatible)' },
];

const ERROR_TEXT: Record<string, string> = {
  invalid_key: 'The provider rejected this key.',
  quota: 'The key is valid but out of quota or credit.',
  unreachable: 'Could not reach the provider.',
  bad_endpoint: 'That address is not allowed. Use an https address of a public provider.',
  rate_limited: 'Too many checks. Wait a minute.',
  other: 'The provider answered, but not usefully. Check the model name.',
};

type Status = { kind: 'ok' | 'error'; text: string } | null;

/** Bring-your-own keys: reasoning model for plans and shapes, and AssemblyAI for live voice. Stored in this browser only. */
export function KeysSection() {
  const [cfg, setCfg] = useState<ByokConfig>(EMPTY_BYOK);
  const [loaded, setLoaded] = useState(false);
  const [llmStatus, setLlmStatus] = useState<Status>(null);
  const [aaiStatus, setAaiStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCfg(loadByok());
    setLoaded(true);
  }, []);
  if (!loaded) return null;

  const update = (patch: Partial<ByokConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveByok(next);
    setLlmStatus(null);
    setAaiStatus(null);
  };

  const check = async (target: 'llm' | 'assembly') => {
    setBusy(true);
    const set = target === 'llm' ? setLlmStatus : setAaiStatus;
    try {
      const res = await fetch('/api/keys/check', { method: 'POST', headers: { 'Content-Type': 'application/json', ...byokHeaders(cfg) }, body: JSON.stringify({ target }) });
      const json = (await res.json()) as { ok: boolean; error?: string; model?: string };
      set(json.ok ? { kind: 'ok', text: target === 'llm' ? `Works. Using ${json.model}.` : 'Works. Live voice will use your allowance.' } : { kind: 'error', text: ERROR_TEXT[json.error || 'other'] || ERROR_TEXT.other });
    } catch {
      set({ kind: 'error', text: ERROR_TEXT.unreachable });
    } finally {
      setBusy(false);
    }
  };

  const preset = cfg.provider === 'groq' || cfg.provider === 'mistral' || cfg.provider === 'openai' ? PRESETS[cfg.provider] : null;

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="keys-title" data-testid="keys-section">
      <h2 id="keys-title" className="card-title">Your own keys</h2>
      <p className="text-ink-2 mt-2 text-[0.95rem]">
        Stay works with its shared defaults. If they run out, or you want your own model, add your own keys. They stay in this browser, travel with each request through Stay&apos;s server to the provider you pick, and are never saved or logged by Stay.
      </p>

      <fieldset className="mt-5">
        <legend className="label">Reasoning model (plans and orb shapes)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROVIDER_CHIPS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={cfg.provider === p.id} onClick={() => update({ provider: p.id, model: '', baseUrl: '' })} data-testid={`provider-${p.id}`}>
              {p.label}
            </button>
          ))}
        </div>

        {cfg.provider !== 'default' && (
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="label">API key{preset ? <> (<a className="underline" href={preset.keyUrl} target="_blank" rel="noopener noreferrer">get one</a>)</> : null}</span>
              <input className="field mt-1 w-full" type="password" autoComplete="off" spellCheck={false} placeholder="Paste your key" value={cfg.llmKey} onChange={(e) => update({ llmKey: e.target.value })} data-testid="llm-key" />
            </label>
            {cfg.provider === 'custom' && (
              <label className="block">
                <span className="label">Base address (https, ends before /chat/completions)</span>
                <input className="field mt-1 w-full" type="url" placeholder="https://api.example.com/v1" value={cfg.baseUrl} onChange={(e) => update({ baseUrl: e.target.value })} data-testid="llm-base" />
              </label>
            )}
            <label className="block">
              <span className="label">Model</span>
              <input className="field mt-1 w-full" type="text" spellCheck={false} placeholder={preset?.model || 'model name'} value={cfg.model} onChange={(e) => update({ model: e.target.value })} data-testid="llm-model" />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-secondary" disabled={busy || !cfg.llmKey.trim()} onClick={() => check('llm')} data-testid="llm-check">Test this key</button>
              {llmStatus && <span className="meta" role="status" style={{ color: llmStatus.kind === 'error' ? 'var(--color-danger)' : undefined }}>{llmStatus.text}</span>}
            </div>
          </div>
        )}
      </fieldset>

      <div className="mt-6">
        <label className="block">
          <span className="label">AssemblyAI key for live voice (use when the shared allowance runs out)</span>
          <input className="field mt-1 w-full" type="password" autoComplete="off" spellCheck={false} placeholder="Paste your AssemblyAI key" value={cfg.assemblyKey} onChange={(e) => update({ assemblyKey: e.target.value })} data-testid="aai-key" />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-secondary" disabled={busy || !cfg.assemblyKey.trim()} onClick={() => check('assembly')} data-testid="aai-check">Test this key</button>
          {aaiStatus && <span className="meta" role="status" style={{ color: aaiStatus.kind === 'error' ? 'var(--color-danger)' : undefined }}>{aaiStatus.text}</span>}
        </div>
        <p className="meta mt-3">Live voice replies are written by the model inside AssemblyAI&apos;s voice agent. Your reasoning key powers plans and shapes.</p>
      </div>

      <div className="mt-6">
        <button type="button" className="btn btn-ghost" onClick={() => { clearByok(); setCfg(EMPTY_BYOK); setLlmStatus(null); setAaiStatus(null); }} data-testid="keys-clear">Remove my keys from this browser</button>
      </div>
    </section>
  );
}
