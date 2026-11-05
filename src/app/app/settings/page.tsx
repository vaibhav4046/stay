'use client';

import { useEffect, useState } from 'react';
import { useStayData } from '@/lib/storage/useStayData';
import { CARE_OPTIONS } from '@/components/Onboarding';
import { deleteAllUserData, exportAllUserDataJson, getLocalAuditEvents, getLocalSessions } from '@/lib/storage/repository';
import { buildEmailSummary, buildVault, mailtoLink, type VaultInput } from '@/lib/export/vault';
import { buildZip } from '@/lib/export/zip';
import { loadUserMemory } from '@/lib/coach/userMemory';
import { loadLearnings } from '@/lib/coach/learnings';
import { loadToday } from '@/lib/coach/todayList';
import type { AuditEventRecord } from '@/types/domain';
import { useAuth } from '@/lib/auth/useAuth';
import { AuthModal } from '@/components/AuthModal';
import { KeysSection } from '@/components/KeysSection';
import { StyleSettings } from '@/components/StyleSettings';
import { ProactiveSettings } from '@/components/ProactiveSettings';
import { disablePush } from '@/lib/push/client';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PageHeading } from '@/components/PageHeading';

export default function SettingsPage() {
  const { profile, loaded, updateProfile } = useStayData('app');
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [audits, setAudits] = useState<AuditEventRecord[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [playfulOrb, setPlayfulOrb] = useState(true);

  useEffect(() => {
    setAudits(getLocalAuditEvents());
    if (typeof window !== 'undefined') {
      setPlayfulOrb(window.localStorage.getItem('stay:playful_orb:v1') !== '0');
    }
  }, []);
  if (!loaded) return <PageSkeleton variant="settings" />;

  const download = () => {
    const blob = new Blob([exportAllUserDataJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stay-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // everything below is built on this device from this device's data; nothing is uploaded
  const vaultInput = (): VaultInput => ({ memory: loadUserMemory(), learnings: loadLearnings(), sessions: getLocalSessions(), list: loadToday().map((i) => ({ text: i.text, bucket: i.bucket, done: i.done })) });
  const exportVault = () => {
    const zip = buildZip(buildVault(vaultInput()));
    const url = URL.createObjectURL(new Blob([zip.slice().buffer as ArrayBuffer], { type: "application/zip" }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `stay-vault-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const emailMe = () => {
    window.location.href = mailtoLink(buildEmailSummary(vaultInput()));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeading>Settings</PageHeading>

      <section className="card p-5 sm:p-6" aria-labelledby="pref-title">
        <h2 id="pref-title" className="card-title">Preferences</h2>
        <fieldset className="mt-4">
          <legend className="label">Care context</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CARE_OPTIONS.map((o) => (
              <button key={o.key} type="button" className="chip" aria-pressed={profile.careContext === o.key} onClick={() => updateProfile({ careContext: o.key })}>
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 flex min-h-11 items-center gap-3 cursor-pointer">
          <input type="checkbox" className="h-5 w-5 accent-[#8FD3FF]" checked={profile.interactionMode === 'quiet_text_only'} onChange={(e) => updateProfile({ interactionMode: e.target.checked ? 'quiet_text_only' : 'voice_and_text' })} />
          <span>Quiet mode by default (text only)</span>
        </label>
        <label className="mt-3 flex min-h-11 items-center gap-3 cursor-pointer">
          <input type="checkbox" className="h-5 w-5 accent-[#8FD3FF]" checked={profile.proactiveCheckins} onChange={(e) => updateProfile({ proactiveCheckins: e.target.checked })} />
          <span>Check in when a focus block ends</span>
        </label>
        <label className="mt-3 flex min-h-11 items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 accent-[#8FD3FF]"
            checked={playfulOrb}
            onChange={(e) => {
              setPlayfulOrb(e.target.checked);
              if (typeof window !== 'undefined') {
                window.localStorage.setItem('stay:playful_orb:v1', e.target.checked ? '1' : '0');
              }
            }}
            data-testid="playful-orb-toggle"
          />
          <span>
            <span className="font-medium text-ink block">Shapes and face</span>
            <span className="text-xs text-ink-2 block">The orb turns into what you talk about, and into a face while Stay speaks. Turn off for a still orb.</span>
          </span>
        </label>
        <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3">
          <div>
            <span className="font-medium text-ink block text-sm">Microphone permission</span>
            <span className="text-xs text-ink-2 block">Show the notice about your voice data again.</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary shrink-0 whitespace-nowrap text-xs px-3"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.localStorage.removeItem('stay:mic_consented:v1');
              }
            }}
            data-testid="reset-mic-consent"
          >
            Reset consent
          </button>
        </div>
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="auth-title">
        <h2 id="auth-title" className="card-title">Account and sync</h2>
        <p className="text-ink-2 mt-2 text-[0.95rem]">
          Your history lives on this device by default. Plans and voice go through a server to a language model and to AssemblyAI (see Privacy). Sign in only if you want your memory and session history synced between your phone and desktop; what syncs is exactly what History and Memory show.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent border border-accent/20">
                Signed in as {user.email}
              </span>
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5 px-3"
                onClick={() => signOut()}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary text-xs py-2 px-4 flex items-center gap-2"
              onClick={() => setShowAuthModal(true)}
              data-testid="settings-signin-btn"
            >
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </section>

      <StyleSettings />

      <ProactiveSettings />

      <KeysSection />

      <section className="card p-5 sm:p-6" aria-labelledby="data-title">
        <h2 id="data-title" className="card-title">Your data</h2>
        <p className="text-ink-2 mt-2 text-[0.95rem]">
          Stored on this device. Voice audio is streamed to AssemblyAI for live conversation and is not saved by Stay.
        </p>
        <p className="text-ink-2 mt-2 text-[0.95rem]">
          <strong>Export to Obsidian</strong> gives you a folder of linked notes (memory, what Stay learned and why, every block, your list). <strong>Email this to me</strong> opens your own mail app with a short summary; Stay sends nothing.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn btn-secondary" onClick={download} data-testid="export-json">
            Download all my data
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportVault} data-testid="export-vault">
            Export to Obsidian
          </button>
          <button type="button" className="btn btn-secondary" onClick={emailMe} data-testid="email-me">
            Email this to me
          </button>
          {!confirmDelete ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)} data-testid="delete-start">
              Delete all my data
            </button>
          ) : (
            <div className="notice w-full" role="alertdialog" aria-labelledby="del-q">
              <p id="del-q" className="text-ink">This permanently deletes your profile, sessions, check-ins and activity log. It can&apos;t be undone.</p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    try {
                      await disablePush(); // the notification address is the one thing the server holds
                      await deleteAllUserData();
                      setDeleteError(null);
                      setDeleted(true);
                      setConfirmDelete(false);
                      setAudits([]);
                      window.setTimeout(() => { window.location.href = '/app/today'; }, 1200);
                    } catch (e) {
                      setDeleteError(e instanceof Error ? e.message : 'Deletion failed.');
                      setConfirmDelete(false);
                    }
                  }}
                  data-testid="delete-confirm"
                >
                  Yes, delete everything
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {deleted && <p className="meta mt-3" role="status">All data deleted.</p>}
        {deleteError && <p className="meta mt-3" style={{ color: "var(--color-danger)" }} role="alert">{deleteError}</p>}
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="audit-title">
        <h2 id="audit-title" className="card-title">Activity log</h2>
        <p className="meta mt-1">What Stay did on your behalf.</p>
        {audits.length === 0 ? (
          <p className="text-ink-2 mt-3 text-[0.95rem]">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-[0.92rem]">
            {audits.slice(0, 30).map((a) => (
              <li key={a.id} className="py-2 flex justify-between gap-4">
                <span>{a.eventSummary}</span>
                <span className="meta tnum shrink-0">
                  {new Date(a.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
