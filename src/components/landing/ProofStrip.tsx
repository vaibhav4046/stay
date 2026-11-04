import { CURRENT } from './currentMeasured';

const sec = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** One line under the hero. Both numbers are read from the evidence file (currentMeasured.ts), none is typed in. */
export function ProofStrip() {
  return (
    <section className="lp-wrap pb-4" aria-label="Measured with AssemblyAI" data-testid="proof-strip">
      <p className="meta">
        Live speech in your browser, powered by{' '}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/assemblyai-logo.svg" alt="AssemblyAI" width={92} height={16} className="inline-block h-4 w-auto align-[-3px]" data-testid="hero-badge" />. Your words appear in <strong className="tnum text-ink">{sec(CURRENT.firstPartialMs)}</strong> (median). {CURRENT.clips} test clips of synthetic speech on one machine.{' '}
        <a href="#measured" className="underline">Method and limits</a>.
      </p>
    </section>
  );
}
