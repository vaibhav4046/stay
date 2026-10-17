'use client';

import { useEffect, useRef } from 'react';

interface AssistantHardwareProps {
  isConnected: boolean;
  isHandsFreePaused: boolean;
  keepScreenAwake?: boolean;
  onToggleVoice: () => void;
  onToggleHandsFreeMute: () => void;
  onTriggerGrounding?: () => void;
  onStartTimer?: (minutes: number) => void;
}

/**
 * Connects Stay to mobile hardware controls:
 * - Media Session API (Bluetooth headset / earbud button / power-hold toggle)
 * - Screen Wake Lock (keeps screen alive during focus sprint body-doubling)
 * - URL parameter triggers (?voice=auto, ?timer=20, ?action=grounding)
 * - Keyboard shortcuts (Spacebar hold to speak, G for grounding, F for full screen)
 */
export function useAssistantHardware({
  isConnected,
  isHandsFreePaused,
  keepScreenAwake,
  onToggleVoice,
  onToggleHandsFreeMute,
  onTriggerGrounding,
  onStartTimer,
}: AssistantHardwareProps) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const shouldLock = Boolean(keepScreenAwake ?? isConnected);

  // 1. Screen Wake Lock API during active voice or focus timer sprint
  useEffect(() => {
    let released = false;
    const requestLock = async () => {
      if ('wakeLock' in navigator && shouldLock && !released) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          // Wake lock unavailable or denied
        }
      }
    };

    if (shouldLock) {
      void requestLock();
    } else {
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    }

    return () => {
      released = true;
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [shouldLock]);

  // 2. Mobile Media Session API for Bluetooth earbuds / lock screen / headset button hold
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: isConnected
        ? isHandsFreePaused
          ? 'Stay — Listening Paused'
          : 'Stay — Living Voice AGI Companion'
        : 'Stay — ADHD Voice Companion',
      artist: 'Stay ADHD System',
      album: 'Living 24/7 Companion',
      artwork: [
        { src: '/favicon.ico', sizes: '96x96', type: 'image/x-icon' },
      ],
    });

    const handleMediaToggle = () => {
      if (!isConnected) {
        onToggleVoice();
      } else {
        onToggleHandsFreeMute();
      }
    };

    try {
      navigator.mediaSession.setActionHandler('play', handleMediaToggle);
      navigator.mediaSession.setActionHandler('pause', handleMediaToggle);
      navigator.mediaSession.setActionHandler('stop', onToggleVoice);
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        onStartTimer?.(20);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        onTriggerGrounding?.();
      });
    } catch {
      // Some browsers don't support all action handlers
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      } catch {
        // ignore
      }
    };
  }, [isConnected, isHandsFreePaused, onToggleVoice, onToggleHandsFreeMute, onStartTimer, onTriggerGrounding]);

  // 3. Auto URL Query Parameter Handlers (?voice=auto, ?timer=20, ?action=grounding)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (params.get('voice') === 'auto' && !isConnected) {
      // Auto-initiate voice session when opened via Android shortcut or home gesture
      const timer = setTimeout(() => {
        onToggleVoice();
      }, 350);
      return () => clearTimeout(timer);
    }

    const timerParam = params.get('timer');
    if (timerParam) {
      const mins = parseInt(timerParam, 10);
      if (!isNaN(mins) && mins > 0 && mins <= 60) {
        onStartTimer?.(mins);
      }
    }

    if (params.get('action') === 'grounding') {
      onTriggerGrounding?.();
    }
  }, [isConnected, onToggleVoice, onStartTimer, onTriggerGrounding]);

  // 4. Keyboard Shortcuts for Quick Assistant Control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Spacebar toggles voice
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (!isConnected) {
          onToggleVoice();
        } else {
          onToggleHandsFreeMute();
        }
      }

      // 'g' or 'G' for instant Sensory Grounding
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        onTriggerGrounding?.();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isConnected, onToggleVoice, onToggleHandsFreeMute, onTriggerGrounding]);
}
