import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { Hero } from '@/components/landing/Hero';
import { SmoothScroll } from '@/components/landing/SmoothScroll';
import { ProofStrip } from '@/components/landing/ProofStrip';
import { PipelineMotion } from '@/components/landing/PipelineMotion';
import { FeatureBento } from '@/components/landing/FeatureBento';
import { BenchmarkBoard } from '@/components/landing/BenchmarkBoard';
import { DemoPlayer } from '@/components/landing/DemoPlayer';
import { Results } from '@/components/landing/Results';
import { Compare, NotFor, Platforms, Promises } from '@/components/landing/Sections';
import { TRANSCRIPT } from '@/components/landing/transcript';
import './landing.css';
import './facets.css';

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <SiteHeader anchors />
      <main>
        {/* The page is five sections: 1 hero, 2 the real call, 3 how it works, 4 the proof, 5 trust and start. */}
        <div data-landing-section="1">
          <Hero />
          <ProofStrip />
        </div>

        <section id="watch" data-landing-section="2" className="lp-night lp-band" aria-labelledby="watch-title" data-testid="demo-video">
          <div className="lp-wrap">
            <p className="eyebrow lp-eyebrow-night">The demo</p>
            <h2 id="watch-title" className="section-title lp-night-title max-w-[26ch]">Watch a real call.</h2>
            <p className="lp-night-copy mt-3 max-w-[62ch]">
              A screen recording of the live app, with no sound: the browser cannot record page audio, so the words are in the captions. The speaker is a synthesised AssemblyAI voice fed into the microphone, marked as such in the captions; Stay&apos;s replies are real AssemblyAI speech. It shows the chat-first screen, a spoken interruption, a switch to Spanish, and two panels opened by typing.
            </p>
          </div>
          <div className="lp-player-bleed">
            <DemoPlayer />
          </div>
          <div className="lp-wrap">
            <details className="lp-details lp-transcript">
              <summary>Read the transcript</summary>
              <div className="lp-details-body">
                <ol>
                  {TRANSCRIPT.map((c) => (
                    <li key={c.start}>
                      <time className="tnum">{c.start}</time>
                      <p>{c.text}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          </div>
        </section>

        <section id="how" data-landing-section="3" className="lp-section lp-wrap" aria-labelledby="pipe-title">
          <PipelineMotion />
          <FeatureBento />
        </section>

        <section id="measured" data-landing-section="4" className="lp-night lp-band" aria-labelledby="bench-title" data-testid="measured">
          <div className="lp-wrap">
            <BenchmarkBoard />

            <div className="mt-20">
              <p className="eyebrow lp-eyebrow-night">Measured, with the limits</p>
              <h3 id="measured-title" className="section-title lp-night-title max-w-[24ch]">What we tested</h3>
            <ul className="lp-night-copy mt-6 max-w-[66ch] space-y-3">
              <li><strong className="lp-night-strong">Safety first.</strong> Unit and browser suites (recorded in <code>docs/evidence/phase0-vitest.txt</code> and <code>docs/evidence/phase0-playwright.txt</code>) verify crisis wording in more than 30 languages against real phrasings and ordinary sentences that must not trigger, spacing-evasion protection, the medication boundary, and the rule that voice never deletes your data.</li>
              <li><strong className="lp-night-strong">Patience.</strong> A simulated speaker trailed off mid-sentence for 2.3 seconds, in several accents with room noise. Stay waited in every run. The managed voice it replaced talked over the pause (<code>docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md</code>).</li>
              <li><strong className="lp-night-strong">Honesty.</strong> Every number below comes from a script in the repository (<code>docs/evidence/</code>), and the tests that found our own mistakes are in it too.</li>
            </ul>
              <div className="mt-10">
                <Results />
              </div>
            </div>

            <div className="mt-20" data-testid="compare">
              <p className="eyebrow lp-eyebrow-night">Alternatives</p>
              <h3 id="compare" className="section-title lp-night-title max-w-[24ch]">Why not just use something else?</h3>
              <div className="mt-6">
                <Compare />
              </div>
            </div>
          </div>
        </section>

        <section id="trust" data-landing-section="5" className="lp-section lp-wrap" aria-labelledby="trust-title">
          <p className="eyebrow">Trust</p>
          <h2 id="trust-title" className="section-title max-w-[22ch]">Built to be trusted with a hard day</h2>
          <Promises />

          <div className="mt-16 grid gap-10 lg:grid-cols-2">
            <div id="platforms-block">
              <h3 id="platforms-title" className="sub-title">What exists today, and what does not</h3>
              <p className="mt-3 max-w-[62ch] text-ink-2">A tick here means it is in the repository and works. Anything else says so plainly.</p>
              <Platforms />
            </div>
            <div data-testid="not-for-block">
              <h3 id="notfor" className="sub-title">Who Stay is not for</h3>
              <div className="mt-4">
                <NotFor />
              </div>
            </div>
          </div>

          <details className="lp-details mt-14" data-testid="evidence">
            <summary>What the research says, and what it does not</summary>
            <div className="lp-details-body">
          <div className="mt-6 max-w-[66ch] space-y-4 text-ink-2">
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
            </div>
          </details>

          <div className="lp-cta-wrap mt-14">
          <div className="lp-cta lp-night">
            <div>
              <h2 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">Ready when you are.</h2>
              <p className="lp-night-copy mt-2 max-w-[40ch]">One small thing is enough. Say it badly; Stay will wait.</p>
            </div>
            <Link href="/app/today" className="btn lp-cta-btn" data-testid="cta-open">
              Open Stay
            </Link>
          </div>
          </div>

        </section>
      </main>
      <SiteFooter />
    </>
  );
}
