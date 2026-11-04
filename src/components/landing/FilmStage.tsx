'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The film, as a stage and not a player: it plays by itself, muted and looping while it is on screen, and stops when it is not.
 * One button turns the sound on (browsers only allow sound after a tap); one turns the captions on or off. No scrubber, no chapters.
 * With "reduce motion" set it does not start by itself: the first frame waits with a play button.
 */
export const FILM = { mp4: '/demo/stay-pix-film-web.mp4', vtt: '/demo/stay-pix-film-v2.vtt', poster: '/demo/stay-pix-film-v2-poster.jpg' } as const;

export function FilmStage() {
  const video = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [still, setStill] = useState(false); // reduce motion: wait for a tap
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const wanted = useRef(true); // false while reduce-motion is waiting for a tap: scrolling into view must not start it

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setStill(reduce);
    wanted.current = !reduce;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && wanted.current) v.play().catch(() => undefined);
        else v.pause(); // off screen, or still waiting for a tap
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const t = video.current?.textTracks[0];
    if (t) t.mode = captions ? 'showing' : 'hidden';
  }, [captions]);

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = sound;
    setSound(!sound);
    if (!sound && v.paused) {
      wanted.current = true;
      setStill(false); // pressing Sound is also asking to play: the play overlay goes
      v.play().catch(() => undefined);
    }
  };

  const start = () => {
    wanted.current = true;
    setStill(false);
    video.current?.play().catch(() => setFailed(true));
  };

  return (
    <div className="lp-film-wrap" data-testid="film-stage" data-playing={playing}>
      <div className="lp-film">
        <video
          ref={video}
          className="lp-film-video"
          muted
          loop
          playsInline
          preload="none" // nothing is downloaded until the film is on screen (it is below the fold; the observer starts it)
          poster={FILM.poster}
          aria-label="Stay film: Pix has a paper due and gets started in one call. Captions are available."
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
        >
          <source src={FILM.mp4} type="video/mp4" />
          <track kind="captions" src={FILM.vtt} srcLang="en" label="English" default />
        </video>
        <div className="lp-film-shade" aria-hidden="true" />

        {still && !failed && (
          <button type="button" className="lp-film-start" onClick={start} data-testid="film-start">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
            Play the film
          </button>
        )}
        {failed && <p className="lp-film-error" role="alert">The film could not load. The transcript below says the same thing.</p>}
      </div>

      <div className="lp-film-bar">
        <button type="button" className="lp-film-btn" aria-pressed={sound} onClick={toggleSound} data-testid="film-sound">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
            {sound ? (
              <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.8a7.6 7.6 0 0 1 0 10.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
          {sound ? 'Sound on' : 'Sound off'}
        </button>
        <button type="button" className="lp-film-btn" aria-pressed={captions} onClick={() => setCaptions((c) => !c)} data-testid="film-captions">
          Captions {captions ? 'on' : 'off'}
        </button>
      </div>
    </div>
  );
}
