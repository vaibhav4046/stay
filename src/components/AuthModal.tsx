'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import {
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  getEffectiveSupabaseConfig,
  getSupabaseBrowserClient,
} from '@/lib/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user, isConfigured, signInWithGoogle, signOut } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customUrl, setCustomUrl] = useState(() => getEffectiveSupabaseConfig()?.url || '');
  const [customAnonKey, setCustomAnonKey] = useState(() => getEffectiveSupabaseConfig()?.anonKey || '');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveSupabase = () => {
    if (!customUrl.trim() || !customAnonKey.trim()) {
      setTestStatus('Please enter both Supabase URL and Anon Key.');
      return;
    }
    saveCustomSupabaseConfig(customUrl, customAnonKey);
    setTestStatus('✓ Saved credentials. Ready to connect.');
  };

  const handleTestSupabase = async () => {
    setTestStatus('Testing Supabase connection...');
    try {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setTestStatus('Failed: Supabase client could not initialize with provided keys.');
        return;
      }
      const { error } = await client.auth.getSession();
      if (error) {
        setTestStatus(`Error: ${error.message}`);
      } else {
        setTestStatus('✓ Verified: Connected to Supabase Cloud Database.');
      }
    } catch (err) {
      setTestStatus(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleClearSupabase = () => {
    clearCustomSupabaseConfig();
    setCustomUrl('');
    setCustomAnonKey('');
    setTestStatus('Cleared custom credentials. Defaulted to local mode.');
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMsg(error.message || 'Could not initiate Google sign in.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="card w-full max-w-md p-6 bg-surface border border-line shadow-xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔐</span>
            <h3 id="auth-modal-title" className="font-display font-semibold text-ink text-base">
              {user ? 'Account & Cloud Sync' : 'Sign in to Stay'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-3 hover:text-ink text-xl font-medium px-2 py-1"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {user ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-surface-recessed p-3 border border-line flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-ink block truncate">{user.email}</span>
                <span className="text-[0.72rem] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Cloud Sync Active (Multi-Device)
                </span>
              </div>
            </div>

            <p className="text-xs text-ink-2">
              Your ADHD focus history, personal triggers, and calibration memory sync securely across your devices.
            </p>

            <button
              type="button"
              onClick={async () => {
                await signOut();
                onClose();
              }}
              className="btn btn-secondary w-full text-xs py-2"
            >
              Sign out of Google Account
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-ink-2 leading-relaxed">
              Stay works instantly with <strong>zero account required</strong> in private local guest mode. Sign in with
              Google if you want to sync your cognitive memory, focus stats, and history across your phone and laptop.
            </p>

            {errorMsg && (
              <div className="notice text-xs p-2.5" role="alert">
                {errorMsg}
              </div>
            )}

            {!isConfigured && (
              <p className="text-[0.75rem] text-ink-3 italic bg-surface-recessed p-2 rounded border border-line">
                Note: Local guest mode is active. Cloud sync will connect once Supabase OAuth keys are set in your deployment environment.
              </p>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 font-medium py-2.5 px-4 rounded-xl shadow-xs transition-colors text-sm"
              data-testid="google-signin-btn"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{submitting ? 'Connecting...' : 'Continue with Google'}</span>
            </button>

            {/* Supabase Custom Credentials Form */}
            <div className="pt-2 border-t border-line">
              <details className="group text-xs text-ink-2">
                <summary className="cursor-pointer font-medium text-accent hover:underline flex items-center justify-between">
                  <span>⚡ Configure Supabase Database & OAuth Keys</span>
                  <span className="text-xs group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-3 space-y-2 bg-surface-recessed p-3 rounded-lg border border-line">
                  <div>
                    <label className="text-[0.72rem] font-semibold text-ink-2 block">
                      Supabase Project URL
                    </label>
                    <input
                      type="text"
                      className="input w-full text-xs py-1.5 px-2 mt-1"
                      placeholder="https://xyzproject.supabase.co"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[0.72rem] font-semibold text-ink-2 block">
                      Supabase Anon Public Key
                    </label>
                    <input
                      type="password"
                      className="input w-full text-xs py-1.5 px-2 mt-1"
                      placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                      value={customAnonKey}
                      onChange={(e) => setCustomAnonKey(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveSupabase}
                      className="btn btn-primary py-1 px-3 text-xs flex-1"
                    >
                      Save & Connect
                    </button>
                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      className="btn btn-secondary py-1 px-2.5 text-xs"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSupabase}
                      className="btn btn-ghost py-1 px-2 text-xs"
                      title="Clear custom credentials"
                    >
                      Reset
                    </button>
                  </div>
                  {testStatus && (
                    <p
                      className={`text-[0.72rem] font-medium ${
                        testStatus.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {testStatus}
                    </p>
                  )}
                </div>
              </details>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-ink-3 hover:text-ink underline transition-colors"
              >
                Keep using private Local Guest mode
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
