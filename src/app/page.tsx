import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { Hero } from '@/components/landing/Hero';
import { SmoothScroll } from '@/components/landing/SmoothScroll';
import { ScrollFallback } from '@/components/landing/ScrollFallback';
import { SplitWords } from '@/components/landing/SplitWords';
import { MagneticLink } from '@/components/landing/MagneticLink';
import { ProofStrip } from '@/components/landing/ProofStrip';
import { FeatureBento } from '@/components/landing/FeatureBento';
import { FilmStage } from '@/components/landing/FilmStage';
import { FilmSeen } from '@/components/landing/FilmSeen';
import { NotFor, Promises } from '@/components/landing/Sections';
import { TRANSCRIPT } from '@/components/landing/transcript';
import './landing.css';
import './fold.css';
import './facets.css';
import './scroll.css';

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <ScrollFallback />
      <div className="lp-progress" aria-hidden="true" />
      <SiteHeader anchors />
      <main>
        {/* The page is four sections: 1 hero, 2 the film, 3 what it does, 4 trust and start. Numbers, tests and platform status live on /proof. */}
        <div data-landing-section="1">
          <Hero />
          <ProofStrip />
        </div>

        <section id="watch" data-landing-section="2" className="lp-night lp-band" aria-labelledby="watch-title" data-testid="demo-video">
          <div className="lp-wrap">
            <h2 id="watch-title" className="section-title lp-night-title lp-split max-w-[26ch]"><SplitWords text="A paper due at nine. A thumb stuck on the feed." /></h2>
            <p className="lp-night-copy mt-3 max-w-[62ch]">
              Two minutes forty-nine seconds, a short story built around one real call. Pix is an invented character with a synthetic voice (ElevenLabs). Stay&apos;s replies and its voice (AssemblyAI) are the real thing, recorded in the real app. It plays on its own; press Sound to hear it.
            </p>
          </div>
          <FilmStage />
          <div className="lp-wrap">
            <FilmSeen />
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

        <section id="how" data-landing-section="3" className="lp-section lp-wrap" aria-labelledby="bento-title">
          <FeatureBento />
        </section>

        <section id="trust" data-landing-section="4" className="lp-section lp-wrap" aria-labelledby="trust-title">
          <h2 id="trust-title" className="section-title max-w-[22ch]">What Stay does on a hard day</h2>
          <Promises />

          <div className="mt-16 max-w-3xl" data-testid="not-for-block">
            <h3 id="notfor" className="sub-title">Who Stay is not for</h3>
            <div className="mt-4">
              <NotFor />
            </div>
          </div>

          <div className="lp-cta-wrap mt-14">
            <div className="lp-cta lp-night">
              <div>
                <h2 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">Start with one small thing.</h2>
                <p className="lp-night-copy mt-2 max-w-[40ch]">Say it badly. Stay will wait.</p>
              </div>
              <MagneticLink href="/app/today" className="btn btn-primary" data-testid="cta-open">
                Open Stay
              </MagneticLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
