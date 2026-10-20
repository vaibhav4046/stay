import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { PERSONAS } from '@/lib/voice/personas';
import { Hero } from '@/components/landing/Hero';
import { DemoPlayer } from '@/components/landing/DemoPlayer';
import { Story } from '@/components/landing/Story';
import { WeekExplorer } from '@/components/landing/WeekExplorer';
import { Results } from '@/components/landing/Results';
import { VoiceBenchmarkArena } from '@/components/landing/VoiceBenchmarkArena';
import { PersonaStressTestExplorer } from '@/components/landing/PersonaStressTestExplorer';
import { AssemblyAiArchitecture } from '@/components/landing/AssemblyAiArchitecture';
import { AdhdScienceHistory } from '@/components/landing/AdhdScienceHistory';
import { NeuralOrbArtifact } from '@/components/landing/NeuralOrbArtifact';
import { Artifacts } from '@/components/landing/Artifacts';
import { Personas } from '@/components/landing/Personas';
import { dotGlyph } from '@/components/landing/personaDots';
import { Compare, Days, NotFor, Platforms, Promises, Receipts } from '@/components/landing/Sections';
import { TRANSCRIPT } from '@/components/landing/transcript';
import './landing.css';

export default function Home() {
  const glyphs = Object.fromEntries(PERSONAS.map((p) => [p.shape, dotGlyph(p.shape, 130)]));

  return (
    <>
      <SiteHeader anchors />
      <main>
        <Hero />

        <section id="watch" className="lp-night lp-band" aria-labelledby="watch-title" data-testid="demo-video">
          <div className="lp-wrap">
            <p className="eyebrow lp-eyebrow-night">The demo</p>
            <h2 id="watch-title" className="section-title lp-night-title max-w-[26ch]">Watch it in under three minutes.</h2>
            <p className="lp-night-copy mt-3 max-w-[62ch]">
              Recorded on the live site. The speaker is a synthesized voice fed into the microphone and labelled as simulated on screen; Stay&apos;s replies are the real audio. Captions are on. This recording was made before the side-by-side with ChatGPT voice and Gemini Live, so its closing line about not having measured them is out of date; the comparison is below.
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

        <section id="flow" className="lp-section lp-wrap" aria-labelledby="how">
          <p className="eyebrow">How a session flows</p>
          <h2 id="how" className="section-title max-w-[22ch]">
            Five moves, about two minutes to start
          </h2>
          <Story />
          <p className="meta mt-10 max-w-[62ch]">
            Speak in your own language. We tested live voice with synthesized speech: 23 languages were heard correctly and 8 were not; AssemblyAI documents six (English, Spanish, French, German, Italian, Portuguese), and the fast voice speaks those six. Others use the standard voice or your browser&apos;s speech recognition.
          </p>
        </section>

        <section id="days" className="lp-section lp-wrap" aria-labelledby="days-title" data-testid="days">
          <p className="eyebrow">What it does</p>
          <h2 id="days-title" className="section-title max-w-[26ch]">
            Made for how ADHD days actually go
          </h2>
          <Days />
        </section>

        <section id="artifacts" className="lp-section lp-tint" aria-labelledby="art-title">
          <div className="lp-wrap">
            <p className="eyebrow">What you get</p>
            <h2 id="art-title" className="section-title max-w-[26ch]">
              Small things you can hold, not a dashboard to maintain
            </h2>
            <p className="mt-3 max-w-[62ch] text-ink-2">
              These four are interactive, built from the same data shapes the app uses and filled with invented examples. Nothing here is a real person&apos;s record.
            </p>
            <Artifacts />
            <h3 className="sub-title mt-16">Twenty-two voices, each with a face made of dots</h3>
            <p className="mt-2 max-w-[62ch] text-ink-2">While you are talking to Stay, ask for a voice by name, or say &ldquo;surprise me&rdquo;. Each takes on its own orb shape.</p>
            <div className="mt-6">
              <Personas personas={PERSONAS} glyphs={glyphs} />
            </div>
          </div>
        </section>

        {/* Interactive 3D Therapist & Neural Model Artifact */}
        <NeuralOrbArtifact />

        <section id="week" className="lp-section lp-wrap" aria-labelledby="week-title">
          <p className="eyebrow">Your week</p>
          <h2 id="week-title" className="section-title max-w-[24ch]">
            See what actually helps you start
          </h2>
          <p className="mt-3 max-w-[62ch] text-ink-2">
            Stay logs every block with the exact count behind it, so you can see your own patterns and decide for yourself. No streaks, no score. Explore a sample below.
          </p>
          <div className="mt-8">
            <WeekExplorer />
          </div>
        </section>

        <section id="measured" className="lp-night lp-band" aria-labelledby="measured-title" data-testid="measured">
          <div className="lp-wrap">
            <p className="eyebrow lp-eyebrow-night">Measured, with the limits</p>
            <h2 id="measured-title" className="section-title lp-night-title max-w-[24ch]">
              What we tested
            </h2>
            <ul className="lp-night-copy mt-6 max-w-[66ch] space-y-3">
              <li><strong className="lp-night-strong">Safety first.</strong> 634 unit tests (37 test files, 100% pass) and 95 browser tests pass. They include crisis wording in more than 30 languages against real phrasings and ordinary sentences that must not trigger, spacing-evasion protection, the medication boundary, and the rule that voice never deletes your data.</li>
              <li><strong className="lp-night-strong">Patience.</strong> A simulated speaker trailed off mid-sentence for 2.3 seconds, in several accents with room noise. Stay waited in every run. The managed voice it replaced talked over the pause.</li>
              <li><strong className="lp-night-strong">Honesty.</strong> Every number below comes from a script in the repository, and the tests that found our own mistakes are in it too.</li>
            </ul>
            <div className="mt-12">
              <Results />
            </div>
          </div>
        </section>

        {/* Head-to-Head Real-World Voice Benchmark Arena */}
        <VoiceBenchmarkArena />

        {/* 100+ Neurodivergent Personas Stress Test Explorer */}
        <PersonaStressTestExplorer />

        {/* AssemblyAI Real-Time Voice Pipeline Architecture */}
        <AssemblyAiArchitecture />

        <section id="receipts" className="lp-section lp-wrap" aria-labelledby="receipts-title">
          <p className="eyebrow">What measuring found wrong</p>
          <h2 id="receipts-title" className="section-title max-w-[26ch]">
            The receipts, including the embarrassing ones
          </h2>
          <Receipts />
        </section>

        {/* 120 Years of ADHD Clinical Science & Neurobiology */}
        <AdhdScienceHistory />

        <section className="lp-section lp-wrap" aria-labelledby="compare" data-testid="compare">
          <p className="eyebrow">Alternatives</p>
          <h2 id="compare" className="section-title max-w-[24ch]">
            Why not just use something else?
          </h2>
          <Compare />
        </section>

        <section className="lp-section lp-wrap" aria-labelledby="trust">
          <p className="eyebrow">Trust</p>
          <h2 id="trust" className="section-title max-w-[22ch]">
            Built to be trusted with a hard day
          </h2>
          <Promises />
        </section>

        <section className="lp-section lp-wrap" aria-labelledby="evidence" data-testid="evidence">
          <p className="eyebrow">Evidence</p>
          <h2 id="evidence" className="section-title max-w-[26ch]">
            What the research says, and what it does not
          </h2>
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
        </section>

        <section id="platforms" className="lp-section lp-tint" aria-labelledby="platforms-title">
          <div className="lp-wrap">
            <p className="eyebrow">Where it runs</p>
            <h2 id="platforms-title" className="section-title max-w-[26ch]">
              What exists today, and what does not
            </h2>
            <p className="mt-3 max-w-[62ch] text-ink-2">A tick here means it is in the repository and works. Anything else says so plainly.</p>
            <Platforms />
          </div>
        </section>

        <section className="lp-section lp-wrap" aria-labelledby="notfor" data-testid="not-for">
          <p className="eyebrow">Honest edges</p>
          <h2 id="notfor" className="section-title max-w-[22ch]">
            Who Stay is not for
          </h2>
          <NotFor />
        </section>

        <section className="lp-wrap lp-cta-wrap">
          <div className="lp-cta lp-night">
            <div>
              <h2 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">Ready when you are.</h2>
              <p className="lp-night-copy mt-2 max-w-[40ch]">One small thing is enough. Say it badly; Stay will wait.</p>
            </div>
            <Link href="/app/today" className="btn lp-cta-btn" data-testid="cta-open">
              Open Stay
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
