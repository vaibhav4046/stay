import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { ScrollFallback } from '@/components/landing/ScrollFallback';
import { PipelineMotion } from '@/components/landing/PipelineMotion';
import { BenchmarkBoard } from '@/components/landing/BenchmarkBoard';
import { Results } from '@/components/landing/Results';
import { Compare, Platforms } from '@/components/landing/Sections';
import '../landing.css';
import '../facets.css';
import '../scroll.css';

export const metadata = { title: 'How we tested Stay | Stay', description: 'The measurements, the tests and the limits behind Stay, for anyone who wants to check.' };

/** For reviewers and the curious. The home page stays about the person; the numbers, the tests and their limits live here. */
export default function ProofPage() {
  return (
    <>
      <ScrollFallback />
      <SiteHeader />
      <main>
        <section className="lp-section lp-wrap" aria-labelledby="proof-title">
          <h1 id="proof-title" className="section-title max-w-[22ch]">How we tested Stay</h1>
          <p className="mt-3 max-w-[62ch] text-ink-2">
            Every number here comes from a script in the repository (<code>docs/evidence/</code>), with its limits next to it. Nothing here has been tested with a human voice in a real room yet.
          </p>
        </section>

        <section className="lp-section lp-wrap" aria-label="How a turn works">
          <PipelineMotion />
        </section>

        <section id="measured" className="lp-night lp-band" aria-labelledby="bench-title" data-testid="measured">
          <div className="lp-wrap">
            <BenchmarkBoard />

            <div className="mt-20">
              <h2 id="measured-title" className="section-title lp-night-title max-w-[24ch]">What we tested</h2>
              <ul className="lp-night-copy mt-6 max-w-[66ch] space-y-3">
                <li><strong className="lp-night-strong">Safety.</strong> Unit and browser suites (recorded in <code>docs/evidence/phase0-vitest.txt</code> and <code>docs/evidence/phase0-playwright.txt</code>) verify crisis wording in 23 languages plus English against real phrasings and ordinary sentences that must not trigger, spacing-evasion protection, the medication boundary, and the rule that voice never deletes your data.</li>
                {/* evidence: docs/evidence/loop/T2-bench-2026-11-02-series1.json */}
                <li><strong className="lp-night-strong">Patience.</strong> A simulated speaker trailed off mid-sentence for 2.3 seconds with room noise. Stay waited through it and answered the finished thought (<code>docs/evidence/loop/T2-bench-2026-11-02-series1.json</code>).</li>
                <li><strong className="lp-night-strong">Sources.</strong> Every number on this page comes from a script in the repository (<code>docs/evidence/</code>). The tests that found our own mistakes are in there too.</li>
              </ul>
              <div className="mt-10">
                <Results />
              </div>
            </div>

            <div className="mt-20" data-testid="compare">
              <h2 id="compare" className="section-title lp-night-title max-w-[24ch]">Why not just use something else?</h2>
              <div className="mt-6">
                <Compare />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-wrap" aria-labelledby="platforms-title">
          <h2 id="platforms-title" className="sub-title">What exists today, and what does not</h2>
          <p className="mt-3 max-w-[62ch] text-ink-2">Green means it works today.</p>
          <Platforms />

          <h2 className="sub-title mt-14">What the research says, and what it does not</h2>
          <div className="mt-6 max-w-[66ch] space-y-4 text-ink-2" data-testid="evidence">
            <p>
              Skills programmes for adult ADHD that teach task breakdown, planning and time management have randomised trials behind them:{' '}
              <a className="underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC3641654" rel="noopener noreferrer">Safren and colleagues (JAMA, 2010)</a> and{' '}
              <a className="underline" href="https://pubmed.ncbi.nlm.nih.gov/20231319/" rel="noopener noreferrer">Solanto and colleagues (American Journal of Psychiatry, 2010)</a>. Stay applies the same ideas: shrink the task, start small, time it, notice what helped.
            </p>
            <p>
              Body-doubling, working alongside someone, is popular with people who have ADHD, but{' '}
              <a className="underline" href="https://chadd.org/adhd-news/adhd-news-adults/could-a-body-double-help-you-increase-your-productivity/" rel="noopener noreferrer">CHADD notes the research is thin</a>.
            </p>
            <p className="text-ink">
              Stay itself has not been trialled. We think it is plausible, we have not shown it works, and it is built so you can see your own start rate, with exact counts, and decide for yourself.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
