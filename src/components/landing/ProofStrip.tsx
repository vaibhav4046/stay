/** One quiet line under the hero: who the voice is by. The measurements and their limits live on /proof, not here. */
export function ProofStrip() {
  return (
    <section className="lp-wrap pb-4" aria-label="Voice by AssemblyAI" data-testid="proof-strip">
      <p className="meta">
        Live voice, powered by{' '}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/assemblyai-logo.svg" alt="AssemblyAI" width={92} height={16} className="inline-block h-4 w-auto align-[-3px]" data-testid="hero-badge" />.{' '}
        <a href="/proof" className="underline">How we tested it</a>.
      </p>
    </section>
  );
}
