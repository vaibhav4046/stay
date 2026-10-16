import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { HeroInteractiveWalkthrough } from '@/components/HeroInteractiveWalkthrough';

const STEPS = [
  { n: '1', title: "Say what you're stuck on", body: 'Speak naturally, or type if you are somewhere quiet.' },
  { n: '2', title: 'Get one smaller first step', body: 'Stay names the barrier and shrinks the task to something you can begin in two minutes.' },
  { n: '3', title: 'Start a short focus block', body: 'Five, ten or fifteen minutes. Stay checks in when it ends, so you are not on your own.' },
  { n: '4', title: 'Learn what helps you begin', body: 'Your own start rate per strategy, with the real counts. No streaks, no shame.' },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:pt-16">
          <div>
            <p className="meta">A task-starting companion for adults with ADHD</p>
            <h1 className="hero-title mt-4 max-w-[16ch]">One small first step. Then stay with it.</h1>
            <p className="mt-5 max-w-[50ch] text-[1.1rem] text-ink-2 leading-relaxed">
              Tell Stay what you&apos;re avoiding. Choose a practical first move, work for a short block,
              and keep a clear record of what helped.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className="btn btn-primary" data-testid="hero-demo">
                Try the 45-second demo
              </Link>
              <Link href="/app/today" className="btn btn-secondary">
                Start a real session
              </Link>
            </div>
            <p className="meta mt-4 text-[0.82rem]">
              Not a medical device · No diagnosis · No medication advice · Local-first browser storage
            </p>
          </div>
          <HeroInteractiveWalkthrough />
        </section>

        <section className="mx-auto max-w-6xl px-5 sm:px-8" aria-labelledby="how-title">
          <h2 id="how-title" className="section-title">How it works</h2>
          <ol className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="font-display tnum text-accent text-[1.1rem] font-semibold w-6 shrink-0">{s.n}</span>
                <div>
                  <h3 className="font-medium text-[1.05rem]">{s.title}</h3>
                  <p className="text-ink-2 mt-1 max-w-[46ch]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto mt-20 max-w-6xl px-5 sm:px-8">
          <div className="card grid gap-8 p-6 sm:p-10 md:grid-cols-2">
            <div>
              <h2 className="section-title">Something useful for your next appointment</h2>
              <p className="text-ink-2 mt-3 max-w-[48ch]">
                GP slots are short and specialist waits are long. Stay turns your sessions and check-ins into one page:
                start rate, strategies that helped, treatment check-ins and the notes you chose to include. You preview
                it and pick every section before anything is exported.
              </p>
            </div>
            <ul className="space-y-3 text-[0.98rem] self-center">
              <li className="border-t border-line pt-3">Strategies from CBT-based ADHD skills work: task shrinking, if-then plans, reframing, timeboxing</li>
              <li className="border-t border-line pt-3">30-second treatment check-in that logs, and never advises on doses</li>
              <li className="border-t border-line pt-3">Fixed UK crisis route: 999, NHS 111, Samaritans 116 123</li>
              <li className="border-t border-line pt-3">Your data stays on your device. Download or delete it in one tap</li>
            </ul>
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-3xl px-5 sm:px-8 text-center">
          <h2 className="section-title">What Stay is honest about</h2>
          <p className="text-ink-2 mt-4">
            Stay supports you in getting started and helps you track what works. It doesn&apos;t treat ADHD or replace
            medication, therapy or your clinician. Whether it improves outcomes is a question it measures openly, with
            your own numbers, rather than promises.
          </p>
          <Link href="/demo" className="btn btn-primary mt-8">
            See the full loop
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
