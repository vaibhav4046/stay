'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

/** Chapter starts are the start times of the captions in public/demo/stay-demo.vtt (a unit test keeps them in step). */
export const CHAPTERS = [
  { t: 1.339, label: 'Hello' },
  { t: 11.746, label: 'Type it, see it' },
  { t: 25.106, label: 'Talk to it' },
  { t: 40.405, label: 'It waits' },
  { t: 79.664, label: 'Park it' },
  { t: 90.995, label: 'Brain dump' },
  { t: 105.481, label: 'Routines' },
  { t: 126.279, label: 'Measured' },
] as const;

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type FsDocument = Document & { webkitExitFullscreen?: () => Promise<void>; webkitFullscreenElement?: Element | null };
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export function DemoPlayer() {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(155.12);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [caption, setCaption] = useState('');
  const [full, setFull] = useState(false);
  const [error, setError] = useState(false);

  // Without script the browser's own controls stay; with it, ours replace them.
  useEffect(() => setEnhanced(true), []);

  // Captions are drawn by us (above the control bar) from the real <track>, so the file stays the single source.
  useEffect(() => {
    const v = video.current;
    const track = v?.textTracks[0];
    if (!v || !track) return;
    track.mode = 'hidden';
    const onCue = () => setCaption(Array.from(track.activeCues ?? []).map((c) => (c as VTTCue).text).join(' '));
    track.addEventListener('cuechange', onCue);
    return () => track.removeEventListener('cuechange', onCue);
  }, [enhanced]);

  useEffect(() => {
    const onFs = () => {
      const d = document as FsDocument;
      setFull(Boolean(document.fullscreenElement || d.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => setError(true));
    } else {
      v.pause();
    }
  }, []);

  const seek = useCallback((t: number, play = false) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
    setTime(v.currentTime);
    if (play) v.play().catch(() => setError(true));
  }, []);

  const goFull = useCallback(() => {
    const el = frame.current as FsElement | null;
    const v = video.current as IosVideo | null;
    const d = document as FsDocument;
    if (document.fullscreenElement || d.webkitFullscreenElement) {
      (document.exitFullscreen ?? d.webkitExitFullscreen)?.call(document);
    } else if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => undefined);
    } else if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else {
      v?.webkitEnterFullscreen?.(); // iPhone: the system player
    }
  }, []);

  const toggleCaptions = () => {
    setCaptionsOn((on) => !on);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'BUTTON') return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowRight') seek(time + 5);
    else if (e.key === 'ArrowLeft') seek(time - 5);
    else if (e.key === 'c') toggleCaptions();
    else if (e.key === 'f') goFull();
  };

  const active = CHAPTERS.reduce((n, c, i) => (time >= c.t - 0.05 ? i : n), -1);
  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div className="lp-player-wrap" data-testid="player">
      <div ref={frame} className="lp-player" data-playing={playing} data-started={started} data-fs={full} data-enhanced={enhanced} onKeyDown={onKey} tabIndex={-1}>
        <video
          ref={video}
          className="lp-video"
          controls={!enhanced}
          preload="none"
          playsInline
          poster="/demo/stay-demo-poster.jpg"
          aria-label="Stay demo video, two and a half minutes, with captions"
          onClick={enhanced ? toggle : undefined}
          onPlay={() => {
            setPlaying(true);
            setStarted(true);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
          onProgress={(e) => {
            const b = e.currentTarget.buffered;
            if (b.length) setBuffered(b.end(b.length - 1));
          }}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          onError={() => setError(true)}
        >
          <source src="/demo/stay-demo.mp4" type="video/mp4" />
          <track kind="captions" src="/demo/stay-demo.vtt" srcLang="en" label="English" default />
        </video>

        {enhanced && (
          <>
            {captionsOn && caption && (
              <p className="lp-caption" data-testid="player-caption" aria-hidden="true">
                {caption}
              </p>
            )}

            {!started && (
              <button type="button" className="lp-bigplay" onClick={toggle} data-testid="player-bigplay" aria-label="Play the demo">
                <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
                <span>Play the demo</span>
                <small className="tnum">{fmt(duration)}, captions on</small>
              </button>
            )}

            {error && <p className="lp-player-error" role="alert">The video could not load. The transcript below says the same thing.</p>}

            <div className="lp-bar" data-testid="player-bar">
              <button type="button" className="lp-ctl" onClick={toggle} data-testid="player-toggle" aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? (
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
                )}
              </button>
              <span className="lp-time tnum" aria-hidden="true">{fmt(time)} / {fmt(duration)}</span>

              <div className="lp-scrub" style={{ '--p': `${pct}%`, '--b': `${duration ? (buffered / duration) * 100 : 0}%` } as React.CSSProperties}>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={time}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Seek"
                  aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
                  data-testid="player-scrub"
                />
                {CHAPTERS.map((c) => (
                  <i key={c.t} className="lp-mark" style={{ left: `${(c.t / duration) * 100}%` }} aria-hidden="true" />
                ))}
              </div>

              <button type="button" className="lp-ctl" aria-pressed={captionsOn} onClick={toggleCaptions} data-testid="player-captions" aria-label="Captions">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M7.5 11.2c.4-1 1.2-1.5 2.1-1.5M7.5 15c.4 1 1.2 1.5 2.1 1.5M13.5 11.2c.4-1 1.2-1.5 2.1-1.5M13.5 15c.4 1 1.2 1.5 2.1 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" transform="translate(0 -1.4)" />
                </svg>
                {!captionsOn && <i className="lp-strike" aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="lp-ctl"
                aria-pressed={muted}
                onClick={() => {
                  const v = video.current;
                  if (v) v.muted = !v.muted;
                }}
                aria-label="Mute"
                data-testid="player-mute"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
                  {muted ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.8a7.6 7.6 0 0 1 0 10.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
                </svg>
              </button>
              <button type="button" className="lp-ctl" onClick={goFull} aria-label={full ? 'Exit full screen' : 'Full screen'} data-testid="player-full">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </>
        )}
      </div>

      {enhanced && (
        <div className="lp-chapters" role="group" aria-label="Chapters">
          {CHAPTERS.map((c, i) => (
            <button key={c.t} type="button" className="lp-chip" aria-current={active === i ? 'true' : undefined} data-testid="chapter" onClick={() => seek(c.t, true)}>
              <span className="tnum">{fmt(c.t)}</span>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
