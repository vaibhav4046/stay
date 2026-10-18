import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { LandingHero } from '@/components/LandingHero';

const STEPS = [
  { title: 'Say it', body: 'Talk, or type if you are somewhere quiet. One task is enough, said however it comes out.' },
  { title: 'Shrink it', body: 'Stay names what is making it hard and turns the task into one step you can start in two minutes.' },
  { title: 'Start it', body: 'A short timer, a check-in when it ends, and a note of what helped, so next time starts easier.' },
];

const PROMISES = [
  { title: 'Your history stays on your device', body: 'Sessions and memory are stored in your browser. Download or delete all of it in Settings, in one tap.' },
  { title: 'No medication advice', body: 'Ask about a dose and Stay says it cannot help and points you to your prescriber or pharmacist.' },
  { title: 'Not a diagnosis, not a clinician', body: 'Stay is a self-help companion. It never diagnoses and does not replace treatment.' },
  { title: 'If you are in danger, it stops coaching', body: 'Crisis wording pauses everything and shows UK emergency numbers: 999, NHS 111 and Samaritans on 116 123.' },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <LandingHero />

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="how">
          <h2 id="how" className="section-title max-w-[22ch]">
            Three moves, about two minutes
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t-2 border-ink pt-4">
                <p className="tnum font-display text-sm font-semibold text-ink-2">{i + 1}</p>
                <h3 className="mt-1 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 max-w-[34ch] text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="meta mt-8 max-w-[60ch]">
            Speak in your own language. Live voice is tested in 23 languages, from English and Spanish to Hindi, Arabic, Japanese and Korean. Others use your browser&apos;s speech recognition.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="trust">
          <h2 id="trust" className="section-title max-w-[22ch]">
            Built to be trusted with a hard day
          </h2>
          <dl className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {PROMISES.map((p) => (
              <div key={p.title}>
                <dt className="font-display text-lg font-semibold">{p.title}</dt>
                <dd className="mt-1 max-w-[46ch] text-ink-2">{p.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-8 pt-10 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[28px] bg-ink px-8 py-10 text-white sm:flex-row sm:items-center">
            <h2 className="font-display text-2xl font-semibold leading-tight sm:max-w-[18ch] sm:text-3xl">Ready when you are.</h2>
            <Link href="/app/today" className="btn btn-primary !bg-white !text-ink hover:!bg-recessed" data-testid="cta-open">
              Open Stay
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
