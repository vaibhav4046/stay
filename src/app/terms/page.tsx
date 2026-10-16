import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { UK_CRISIS_RESOURCES } from '@/lib/safety/crisis';

export const metadata = { title: 'Terms and safety — Stay' };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[68ch] px-5 py-10 sm:px-8">
        <h1 className="section-title">Terms and safety</h1>
        <div className="mt-6 space-y-5 text-ink-2">
          <p><strong className="text-ink">Not medical care.</strong> Stay is a self-help and self-tracking tool. It is not a medical device, does not diagnose ADHD or any condition, and does not replace your GP, specialist, therapist or pharmacist.</p>
          <p><strong className="text-ink">No medication advice.</strong> Stay can record whether you took prescribed treatment and notes you want to share. It will never suggest starting, stopping, changing or comparing medication or doses.</p>
          <p><strong className="text-ink">Evidence.</strong> Stay&apos;s strategies are drawn from CBT-based ADHD skills programmes. Stay itself has not been tested in a clinical trial. Your strategy stats are personal self-tracking, shown with exact counts.</p>
          <p><strong className="text-ink">Not for emergencies.</strong> If anything you say or type suggests you may be unsafe, Stay stops coaching and shows these services:</p>
          <ul className="space-y-2">
            {UK_CRISIS_RESOURCES.map((r) => (
              <li key={r.name}>
                <a className="text-accent font-medium" href={r.href}>{r.name}: {r.contact}</a>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
