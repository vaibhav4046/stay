import { SiteFooter, SiteHeader } from '@/components/SiteChrome';

export const metadata = { title: 'Privacy — Stay' };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[68ch] px-5 py-10 sm:px-8">
        <h1 className="section-title">Privacy</h1>
        <div className="mt-6 space-y-5 text-ink-2">
          <p><strong className="text-ink">What Stay stores.</strong> Your care context, preferences, the tasks you log, the barrier and strategy for each, your first step, timer length, outcome, any treatment check-ins and notes you write, what Stay remembers about you (your name, things you told it, recent sessions), your Today list, parked thoughts, routines, check-in reminders, and, if you add them, your own API keys. By default all of this lives in your browser on this device.</p>
          <p><strong className="text-ink">Voice.</strong> With fast voice (the default), your microphone audio streams from your browser straight to AssemblyAI to be transcribed. What you said, as text, goes through Stay's server to the language model that writes the reply (Groq by default, or the provider whose key you added). The reply text goes to AssemblyAI to be spoken. With the standard voice, audio streams to AssemblyAI's Voice Agent, which does all three steps. Stay does not save audio recordings, and the server does not store what you say.</p>
          <p><strong className="text-ink">What goes to a language model.</strong> To write your first step, sort a brain dump, or reply in conversation, the text you typed or said is sent to Groq (or your own provider), along with a short summary of what Stay remembers. Crisis and medication wording is stopped on the server before any model sees it.</p>
          <p><strong className="text-ink">Your own keys.</strong> A key you add in Settings stays in this browser. It travels with each request, over HTTPS, through Stay's server to the provider you chose, and is used for that one request. Stay never stores or logs it. "Delete all my data" removes it. Custom provider addresses must be public https addresses; private and internal addresses are refused.</p>
          <p><strong className="text-ink">Reminders and offline.</strong> Check-ins fire from this browser tab while Stay is open, and show a system notification only if you allow it. A service worker keeps the app shell available offline; it never caches voice, plans or any account data.</p>
          <p><strong className="text-ink">Hosting.</strong> Stay runs on Vercel, which keeps ordinary request logs (address, time, route) like any host. Those logs do not contain what you said or typed.</p>
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
