import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { LandingHero } from '@/components/LandingHero';

const STEPS = [
  { title: 'Say it', body: 'Talk, or type if you are somewhere quiet. One task is enough, said however it comes out.' },
  { title: 'Shrink it', body: 'Stay names what is making it hard and turns the task into one step you can start in two minutes.' },
  { title: 'Start it', body: 'A short timer, a check-in when it ends, and a note of what helped, so next time starts easier.' },
];

const DAYS = [
  { title: 'It waits through your pauses', body: 'You trail off. You say um. You restart. Stay holds the thought for a couple of seconds instead of answering half a sentence, and stops talking the moment you do.' },
  { title: 'Brain dump', body: 'Say everything at once, in any order. Stay picks the one thing to start, a few for today, and puts the rest away. Nothing is ever overdue.' },
  { title: 'Routines, one step at a time', body: 'Morning, leaving the house, winding down, or your own. One big step on screen, its own small timer, skip any of it.' },
  { title: 'Check-ins that find you', body: '"Check in with me in 20 minutes." A soft chime and a line from Stay, even if the tab is in the background.' },
  { title: 'Short blocks first', body: 'Ten minutes by default, longer when you are in flow. All-day mode keeps Stay beside you for hours, not minutes.' },
  { title: 'Park it', body: '"Park it: call the dentist." The thought is saved, out of your head, and you are back on the task.' },
];

const COMPARE = [
  { who: 'Goblin Tools', is: 'A free, typed task breaker.', stay: 'Spoken, with a timer and someone beside you while you do it.' },
  { who: 'Tiimo and planners', is: 'A visual day you have to set up and keep up.', stay: 'No setup. You say what is in the way and it gives you the next step.' },
  { who: 'Body-doubling with a person', is: 'A real human, at a time you booked.', stay: 'There at 11pm and on a bad day. Not a replacement for people.' },
  { who: 'A general voice assistant', is: 'Answers anything.', stay: 'Does one job: getting you started, and it remembers what helped. We have not measured other assistants, so we claim nothing about their speed.' },
];

const MEASURED = [
  { what: 'Reply after you stop talking', fast: 'about 1.2 seconds', old: 'about 2.5 seconds' },
  { what: 'You pause mid-thought for 2.3 seconds', fast: 'Waits for you', old: 'Talks over the pause' },
  { what: 'You interrupt it', fast: 'Notices in about 0.6 seconds and hears the whole sentence', old: 'Notices in about 0.9 seconds and hears part of it' },
  { what: '"Park it: call the dentist"', fast: 'Done and confirmed in about 1.3 seconds', old: 'Done, confirmed in about 2.9 seconds' },
  { what: "Stay's own voice leaks into the microphone", fast: 'It never mistook itself for you (0 stray transcripts in 20)', old: 'It once transcribed its own greeting as if you had said it (1 in 10)' },
];

const PROMISES = [
  { title: 'Your history stays on your device', body: 'Sessions and memory are stored in your browser. Download or delete all of it in Settings, in one tap.' },
  { title: 'No medication advice', body: 'Ask about a dose and Stay says it cannot help and points you to your prescriber or pharmacist.' },
  { title: 'Not a diagnosis, not a clinician', body: 'Stay is a self-help companion. It never diagnoses and does not replace treatment.' },
  { title: 'If you are in danger, it stops coaching', body: 'Crisis wording pauses everything and shows UK emergency numbers (999, NHS 111, Samaritans 116 123) and findahelpline.com for anywhere else.' },
];

const NOT_FOR = [
  'Anyone in crisis. Press Urgent help, call 999, or Samaritans on 116 123. Stay is not a crisis service.',
  'Anyone who wants a calendar or a full planner. Use Tiimo for that.',
  'Anyone who wants advice about medication. Stay will always send you to a prescriber.',
  'Anyone who needs proof it works. It has not been trialled. See below.',
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <LandingHero />

        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8" aria-labelledby="watch" data-testid="demo-video">
          <h2 id="watch" className="section-title max-w-[26ch]">
            Watch it in three minutes.
          </h2>
          <p className="mt-3 max-w-[62ch] text-ink-2">
            Recorded on the live site. The speaker is a synthesized voice fed into the microphone and labelled as simulated on screen; Stay&apos;s replies are the real audio. Captions are on.
          </p>
          <video className="mt-6 w-full max-w-4xl rounded-2xl border border-line" controls preload="none" playsInline poster="/demo/stay-demo-poster.jpg" aria-describedby="watch">
            <source src="/demo/stay-demo.mp4" type="video/mp4" />
            <track kind="captions" src="/demo/stay-demo.vtt" srcLang="en" label="English" default />
          </video>
        </section>

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
          <p className="meta mt-8 max-w-[62ch]">
            Speak in your own language. We tested live voice with synthesized speech in 23 languages; AssemblyAI documents six (English, Spanish, French, German, Italian, Portuguese), and the fast voice speaks those six. Others use the standard voice or your browser&apos;s speech recognition.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="days" data-testid="days">
          <h2 id="days" className="section-title max-w-[26ch]">
            Made for how ADHD days actually go
          </h2>
          <dl className="mt-8 grid gap-x-12 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
            {DAYS.map((d) => (
              <div key={d.title}>
                <dt className="font-display text-lg font-semibold">{d.title}</dt>
                <dd className="mt-1 max-w-[40ch] text-ink-2">{d.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="compare" data-testid="compare">
          <h2 id="compare" className="section-title max-w-[24ch]">
            Why not just use something else?
          </h2>
          <ul className="mt-8 space-y-4 md:hidden">
            {COMPARE.map((c) => (
              <li key={c.who} className="card p-4">
                <p className="font-display text-lg font-semibold">{c.who}</p>
                <p className="mt-2 text-ink-2"><span className="meta block">That is</span>{c.is}</p>
                <p className="mt-2 text-ink-2"><span className="meta block">Stay is</span>{c.stay}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[0.95rem]">
              <caption className="sr-only">How Stay differs from other tools</caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th scope="col" className="py-2 pr-4 font-semibold">Instead of</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">That is</th>
                  <th scope="col" className="py-2 font-semibold">Stay is</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-3 [&_td]:pr-4 [&_th]:border-b [&_th]:border-line [&_th]:py-3 [&_th]:pr-4 [&_th]:text-left [&_th]:font-medium">
                {COMPARE.map((c) => (
                  <tr key={c.who}>
                    <th scope="row">{c.who}</th>
                    <td>{c.is}</td>
                    <td>{c.stay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="evidence" data-testid="evidence">
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

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="measured" data-testid="measured">
          <h2 id="measured" className="section-title max-w-[24ch]">
            What we tested
          </h2>
          <ul className="mt-6 max-w-[66ch] space-y-3 text-ink-2">
            <li><strong className="text-ink">Safety first.</strong> 386 unit tests and 57 browser tests pass. They include crisis wording in more than 30 languages against real phrasings and ordinary sentences that must not trigger, the medication boundary, and the rule that voice never deletes your data.</li>
            <li><strong className="text-ink">Patience.</strong> A simulated speaker trailed off mid-sentence for 2.3 seconds, in several accents with room noise. Stay waited in every run. The managed voice it replaced talked over the pause.</li>
            <li><strong className="text-ink">Honesty.</strong> Every number below comes from a script in the repository, and the tests that found our own mistakes are in it too.</li>
          </ul>
          <details className="mt-8 max-w-4xl">
            <summary className="cursor-pointer font-display text-lg font-semibold">Voice speed, measured with a simulated speaker</summary>
            <ul className="mt-5 space-y-4 md:hidden">
              {MEASURED.map((m) => (
                <li key={m.what} className="card p-4">
                  <p className="font-display font-semibold">{m.what}</p>
                  <p className="mt-2 text-ink-2"><span className="meta block">Fast voice (default)</span>{m.fast}</p>
                  <p className="mt-2 text-ink-2"><span className="meta block">The managed voice it replaced</span>{m.old}</p>
                </li>
              ))}
            </ul>
            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[34rem] border-collapse text-left text-[0.95rem]">
                <caption className="sr-only">Stay&apos;s two voice engines, measured with the same simulated speaker</caption>
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th scope="col" className="py-2 pr-4 font-semibold"></th>
                    <th scope="col" className="py-2 pr-4 font-semibold">Fast voice (default)</th>
                    <th scope="col" className="py-2 font-semibold">The managed voice it replaced</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-3 [&_td]:pr-4 [&_th]:border-b [&_th]:border-line [&_th]:py-3 [&_th]:pr-4 [&_th]:text-left [&_th]:font-medium">
                  {MEASURED.map((m) => (
                    <tr key={m.what}>
                      <th scope="row">{m.what}</th>
                      <td>{m.fast}</td>
                      <td>{m.old}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="meta mt-5 max-w-[64ch]">
              Honest limits: the speakers were synthesized voices played into the browser, not people in a room, and the numbers come from a handful of runs on one machine. Published figures for native speech-to-speech assistants are lower than ours (OpenAI claims 0.23 to 0.32 seconds for its app voice); we did not measure them and make no claim against them. Sources and the full comparison are in <code>docs/RESEARCH_VOICE_LATENCY.md</code>.
            </p>
          </details>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8" aria-labelledby="notfor" data-testid="not-for">
          <h2 id="notfor" className="section-title max-w-[22ch]">
            Who Stay is not for
          </h2>
          <ul className="mt-6 max-w-[62ch] list-disc space-y-2 pl-5 text-ink-2">
            {NOT_FOR.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3 className="mt-12 font-display text-xl font-semibold">Where it goes next</h3>
          <p className="mt-2 max-w-[62ch] text-ink-2">
            Free to use today. Running it costs real money per hour of talking (speech-to-text, speech and a language model), which is why you can bring your own keys. The next step is a small pilot with a university disability service or ADHD coaches, to measure what matters: whether people actually start.
          </p>
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
