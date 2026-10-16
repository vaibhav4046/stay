'use client';

import { useEffect, useState } from 'react';
import { useStayData } from '@/lib/storage/useStayData';
import { CARE_OPTIONS } from '@/components/Onboarding';
import { deleteAllUserData, exportAllUserDataJson, getLocalAuditEvents } from '@/lib/storage/repository';
import type { AuditEventRecord } from '@/types/domain';

export default function SettingsPage() {
  const { profile, loaded, updateProfile } = useStayData('app');
  const [audits, setAudits] = useState<AuditEventRecord[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => setAudits(getLocalAuditEvents()), []);
  if (!loaded) return null;

  const download = () => {
    const blob = new Blob([exportAllUserDataJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stay-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="section-title">Settings</h1>

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
        <label className="mt-5 flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="h-5 w-5 accent-[#006A67]" checked={profile.interactionMode === 'quiet_text_only'} onChange={(e) => updateProfile({ interactionMode: e.target.checked ? 'quiet_text_only' : 'voice_and_text' })} />
          <span>Quiet mode by default (text only)</span>
        </label>
        <label className="mt-3 flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="h-5 w-5 accent-[#006A67]" checked={profile.proactiveCheckins} onChange={(e) => updateProfile({ proactiveCheckins: e.target.checked })} />
          <span>Check in when a focus block ends</span>
        </label>
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="data-title">
        <h2 id="data-title" className="card-title">Your data</h2>
        <p className="text-ink-2 mt-2 text-[0.95rem]">
          Stored on this device. Voice audio is streamed to AssemblyAI for live conversation and is not saved by Stay.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn btn-secondary" onClick={download} data-testid="export-json">
            Download all my data
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
                    await deleteAllUserData();
                    setDeleted(true);
                    setConfirmDelete(false);
                    setAudits([]);
                    window.location.href = '/app/today';
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
    </div>
  );
}
