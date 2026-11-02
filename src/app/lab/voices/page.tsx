'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateClip, playClip, type LiveClip } from '@/lib/voice/lab/liveTts';
import { LISTEN_QUESTION, LISTEN_TEXT, addRating, buildRound, exportJson, newResult, summarise, type ListenItem, type ListenerResult } from '@/lib/voice/lab/listening';

/**
 * T1.6 listening test. The same reply, spoken live by three Stay voices and by the browser's own voice, in a random order
 * labelled A to D. The listener rates each from 1 to 5 on "I'd happily listen to this for ten minutes". Results stay in this
 * browser until exported as JSON. Ask at least five people; report the raw file.
 */
const STAY_VOICES = [
  { source: '49c443a4-8a1d-5f7e-b70b-98bdbd9823c3', name: 'Audrey (American, TTS-1)' },
  { source: '478badc1-a7eb-5bef-b916-c6e51bd2771e', name: 'Adrienne (British, TTS-1)' },
  { source: 'ac73d2f0-888d-500a-b5fa-3e98a271ee92', name: 'Ernest (American, TTS-1)' },
];
const BROWSER = { source: 'browser', name: "The browser's own voice" };
const STORE = 'stay:lab:voices:v1';

const load = (): ListenerResult[] => {
  try { return JSON.parse(localStorage.getItem(STORE) || '[]') as ListenerResult[]; } catch { return []; }
};

export default function ListeningTest() {
  const [clips, setClips] = useState<Record<string, LiveClip>>({});
  const [status, setStatus] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [listener, setListener] = useState('');
  const [round, setRound] = useState<ListenItem[]>([]);
  const [result, setResult] = useState<ListenerResult | null>(null);
  const [saved, setSaved] = useState<ListenerResult[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => setSaved(load()), []);

  const prepare = useCallback(async () => {
    setStatus('preparing');
    setError('');
    try {
      const made: Record<string, LiveClip> = {};
      for (const v of STAY_VOICES) made[v.source] = await generateClip(v.source, 'english', LISTEN_TEXT); // three sessions, under the limit of five a minute
      setClips(made);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare the voices.');
      setStatus('error');
    }
  }, []);

  const begin = () => {
    const r = buildRound([...STAY_VOICES, BROWSER]);
    setRound(r);
    setResult(newResult(listener, r));
  };

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setPlaying(null);
  };

  const play = async (item: ListenItem) => {
    stop();
    setPlaying(item.label);
    if (item.source === 'browser') {
      const u = new SpeechSynthesisUtterance(LISTEN_TEXT);
      u.lang = 'en-US';
      u.onend = () => setPlaying(null);
      u.onerror = () => setPlaying(null);
      stopRef.current = () => window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return;
    }
    ctxRef.current ??= new AudioContext();
    await ctxRef.current.resume();
    const h = playClip(clips[item.source], ctxRef.current);
    stopRef.current = h.stop;
    void h.done.then(() => setPlaying((p) => (p === item.label ? null : p)));
  };

  const rate = (item: ListenItem, stars: number) => {
    if (!result) return;
    try { setResult(addRating(result, item, stars)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save that rating.'); }
  };

  const save = () => {
    if (!result) return;
    const next = [...saved, result];
    try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* blocked: the export below still has them this session */ }
    setSaved(next);
    stop();
    setResult(null);
    setRound([]);
    setListener('');
  };

  const download = () => {
    const blob = new Blob([exportJson(saved)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stay-listening-test-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rated = (item: ListenItem) => result?.ratings.find((r) => r.source === item.source)?.stars;
  const allRated = Boolean(result && round.length > 0 && result.ratings.length === round.length);

  return (
    <div data-testid="listening-test">
      <h1 className="section-title">Listening test</h1>
      <p className="text-ink-2 mt-2 text-[0.95rem]">
        You will hear the same short reply four times, in four voices, in an order that changes for each listener. Rate each one from 1 (no) to 5 (yes): <strong>{LISTEN_QUESTION}.</strong>
      </p>

      {status === 'idle' && (
        <button type="button" className="btn btn-primary mt-5" onClick={prepare} data-testid="lab-prepare">Prepare the voices</button>
      )}
      {status === 'preparing' && <p className="mt-5" role="status">Making the voices speak live. A few seconds.</p>}
      {status === 'error' && (
        <div className="notice mt-5" role="alert">
          {error} <button type="button" className="btn btn-secondary ml-2" onClick={prepare}>Try again</button>
        </div>
      )}

      {status === 'ready' && !result && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label">Listener (a first name or number)</span>
            <input className="input mt-1" value={listener} onChange={(e) => setListener(e.target.value)} data-testid="lab-listener" />
          </label>
          <button type="button" className="btn btn-primary" onClick={begin} data-testid="lab-begin">Start</button>
        </div>
      )}

      {result && (
        <ol className="mt-6 space-y-4">
          {round.map((item) => (
            <li key={item.label} className="card p-4" data-testid={`lab-item-${item.label.slice(-1)}`}>
              <div className="flex items-center justify-between gap-3">
                <strong>{item.label}</strong>
                <button type="button" className="btn btn-secondary" onClick={() => (playing === item.label ? stop() : void play(item))} aria-label={`${playing === item.label ? 'Stop' : 'Play'} ${item.label}`}>
                  {playing === item.label ? 'Stop' : 'Play'}
                </button>
              </div>
              <div className="mt-3 flex gap-2" role="radiogroup" aria-label={`Rate ${item.label} from 1 to 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rated(item) === n} className="chip" aria-pressed={rated(item) === n} onClick={() => rate(item, n)} data-testid={`lab-rate-${item.label.slice(-1)}-${n}`}>
                    {n}
                  </button>
                ))}
              </div>
            </li>
          ))}
          <li>
            <button type="button" className="btn btn-primary" disabled={!allRated} onClick={save} data-testid="lab-save">Save and next listener</button>
          </li>
        </ol>
      )}

      {error && status !== 'error' && <p className="notice mt-4" role="alert">{error}</p>}

      <section className="mt-8" aria-labelledby="lab-results">
        <h2 id="lab-results" className="card-title">Saved: {saved.length} listener{saved.length === 1 ? '' : 's'}</h2>
        {saved.length > 0 && (
          <>
            <ul className="mt-2 text-sm" data-testid="lab-summary">
              {summarise(saved).map((s) => (
                <li key={s.source}>{s.name}: mean {s.mean} from {s.n} rating{s.n === 1 ? '' : 's'}</li>
              ))}
            </ul>
            <div className="mt-3 flex gap-3">
              <button type="button" className="btn btn-secondary" onClick={download} data-testid="lab-export">Export the raw JSON</button>
              <button type="button" className="btn btn-ghost" onClick={() => { try { localStorage.removeItem(STORE); } catch { /* ignore */ } setSaved([]); }}>Clear</button>
            </div>
            <p className="meta mt-3">Report the raw file, not only the means. With fewer than five listeners, say so.</p>
          </>
        )}
      </section>
    </div>
  );
}
