import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const metadata = { title: 'Privacy — Stay' };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[68ch] px-5 py-10 sm:px-8">
        <h1 className="section-title">Privacy</h1>
        <div className="mt-6 space-y-5 text-ink-2">
          <p><strong className="text-ink">What Stay stores.</strong> Your care context, preferences, the tasks you log, the barrier and strategy for each, your first step, timer length, outcome, any treatment check-ins and notes you write, and what Stay remembers about you (your name, things you told it, recent sessions). By default all of this lives in your browser on this device.</p>
          <p><strong className="text-ink">Voice.</strong> When you talk to Stay, audio streams to AssemblyAI to transcribe it and speak a reply in real time. Stay does not save audio recordings.</p>
          <p><strong className="text-ink">What goes to a language model.</strong> To write your first step, the task you typed or said is sent to Groq, along with a short summary of what Stay remembers. Crisis and medication wording is stopped before that happens.</p>
          <p><strong className="text-ink">The orb.</strong> To draw a shape for a word it does not know, Stay sends up to three keywords (never sentences) to a small model that names a matching picture. Nothing about you goes with them.</p>
          <p><strong className="text-ink">Your report.</strong> The clinician PDF is built in your browser. Nothing is sent anywhere unless you share the file yourself. You preview it and choose every section.</p>
          <p><strong className="text-ink">Your controls.</strong> In Settings you can download everything as JSON, or delete everything, memory included, in one step. In the app menu you can see what Stay remembers and remove any of it.</p>
          <p><strong className="text-ink">Cloud sync (optional).</strong> If you sign in with a Supabase account, records sync to a database where row-level security limits every row to its owner. Without signing in, nothing leaves your device except as described above.</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
