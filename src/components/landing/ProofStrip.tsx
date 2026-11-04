import { CURRENT } from './currentMeasured';

const sec = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Four numbers straight under the hero. Every value is read from the evidence file (currentMeasured.ts), none is typed in. */
export function ProofStrip() {
  const items = [
    { k: sec(CURRENT.firstPartialMs), v: 'first words on screen after you start speaking (median)' },
    { k: sec(CURRENT.ttsFirstAudioMs), v: "from the reply text to Stay's voice (median)" },
    { k: CURRENT.englishWer, v: `of English words wrong, across ${CURRENT.englishN} clips` },
    { k: CURRENT.langCorrect, v: 'clips in the right language' },
  ];
  return (
    <section className="lp-wrap pb-4" aria-label="Measured with AssemblyAI" data-testid="proof-strip">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <li key={i.v} className="card px-5 py-4">
            <p className="font-display text-3xl font-semibold tracking-tight tnum text-ink">{i.k}</p>
            <p className="meta mt-1">{i.v}</p>
          </li>
        ))}
      </ul>
      <p className="meta mt-3">
        Real AssemblyAI speech-to-text and voice, tested with synthetic speech on one machine. <a href="#measured" className="underline">Method and limits</a>.
      </p>
    </section>
  );
}
