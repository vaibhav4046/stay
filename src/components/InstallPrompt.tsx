'use client';

import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'stay_install_dismissed_at';
const QUIET_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** True when Stay already runs as an installed app or inside a native wrapper, where an install nudge makes no sense. */
function alreadyInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true || !!window.stayHost || !!window.Capacitor?.isNativePlatform?.();
}

/** A quiet, dismissible card. Chromium offers the real install prompt; iOS Safari has none, so it gets the two-step hint. */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (alreadyInstalled() || recentlyDismissed()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) setIos(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // private mode: it will show again next visit
    }
    setEvent(null);
    setIos(false);
  };

  if (!event && !ios) return null;
  return (
    <aside className="card mb-4 flex items-center justify-between gap-3 px-4 py-3" aria-label="Install Stay" data-testid="install-prompt">
      <p className="text-[0.92rem] text-ink-2">
        {event ? 'Keep Stay on your home screen or desktop. It opens in one tap and works offline.' : 'To keep Stay on your home screen: tap Share, then Add to Home Screen.'}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        {event && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await event.prompt();
              await event.userChoice.catch(() => undefined);
              setEvent(null);
            }}
          >
            Install
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={dismiss}>
          Not now
        </button>
      </div>
    </aside>
  );
}
