'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type CognitiveGameId = 'simon' | 'gonogo' | 'wordrally';
export type GameDifficulty = 'easy' | 'medium' | 'hard';

interface OrbCognitiveGamesProps {
  activeGame?: CognitiveGameId;
  difficulty?: GameDifficulty;
  onSelectGame?: (game: CognitiveGameId) => void;
  onSelectDifficulty?: (diff: GameDifficulty) => void;
  onSpeak?: (text: string) => void;
  lastUserUtterance?: string;
  onClose?: () => void;
}

const SIMON_PADS = [
  { id: 0, name: 'Emerald', dir: 'North', freq: 392.0, color: '#10B981', glow: 'rgba(16,185,129,0.55)', label: '🟢 Emerald (1)' },
  { id: 1, name: 'Sapphire', dir: 'East', freq: 493.88, color: '#0EA5E9', glow: 'rgba(14,165,233,0.55)', label: '🔵 Sapphire (2)' },
  { id: 2, name: 'Amber', dir: 'South', freq: 587.33, color: '#F59E0B', glow: 'rgba(245,158,11,0.55)', label: '🟡 Amber (3)' },
  { id: 3, name: 'Violet', dir: 'West', freq: 659.25, color: '#8B5CF6', glow: 'rgba(139,92,246,0.55)', label: '🟣 Violet (4)' },
];

const RALLY_DICTIONARY: Record<string, string[]> = {
  a: ['anchor', 'aurora', 'action', 'align', 'atlas'],
  b: ['breathe', 'balance', 'beacon', 'bloom', 'breeze'],
  c: ['calm', 'clarity', 'crystal', 'cadence', 'cosmos'],
  d: ['dopamine', 'dream', 'dawn', 'drive', 'delta'],
  e: ['emerald', 'energy', 'ember', 'echo', 'ease'],
  f: ['focus', 'flow', 'feather', 'fluent', 'flame'],
  g: ['ground', 'gentle', 'glow', 'galaxy', 'grace'],
  h: ['harmony', 'horizon', 'haven', 'halo', 'heart'],
  i: ['ignite', 'insight', 'island', 'inspire', 'iris'],
  j: ['jade', 'journey', 'joy', 'jewel', 'jump'],
  k: ['kinetic', 'kindness', 'keynote', 'karma', 'kite'],
  l: ['lotus', 'light', 'lumen', 'lyric', 'leap'],
  m: ['momentum', 'mindful', 'meadow', 'melody', 'mirror'],
  n: ['nebula', 'nectar', 'north', 'noble', 'nova'],
  o: ['orbit', 'ocean', 'oasis', 'opal', 'origin'],
  p: ['pulse', 'peace', 'prism', 'petal', 'pioneer'],
  q: ['quiet', 'quantum', 'quartz', 'quest', 'quasar'],
  r: ['rhythm', 'radiant', 'ripple', 'river', 'rise'],
  s: ['serenity', 'spark', 'solstice', 'starlight', 'steady'],
  t: ['tranquil', 'tempo', 'tide', 'topaz', 'trust'],
  u: ['uplift', 'unity', 'universe', 'umber', 'ultra'],
  v: ['vivid', 'velvet', 'vortex', 'vision', 'voyage'],
  w: ['wave', 'warmth', 'whisper', 'wonder', 'wind'],
  x: ['xenon', 'xylophone'],
  y: ['zenith', 'yonder', 'yield'],
  z: ['zephyr', 'zen', 'zodiac', 'zeal'],
};

function playTone(freq: number, durationMs = 200) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
  } catch {
    // ignore audio errors in headless environments
  }
}

export function OrbCognitiveGames({
  activeGame = 'simon',
  difficulty = 'medium',
  onSelectGame,
  onSelectDifficulty,
  onSpeak,
  lastUserUtterance,
  onClose,
}: OrbCognitiveGamesProps) {
  const [game, setGame] = useState<CognitiveGameId>(activeGame);
  const [diff, setDiff] = useState<GameDifficulty>(difficulty);

  useEffect(() => {
    setGame(activeGame);
  }, [activeGame]);

  useEffect(() => {
    setDiff(difficulty);
  }, [difficulty]);

  const handleGameChange = (g: CognitiveGameId) => {
    setGame(g);
    onSelectGame?.(g);
  };

  const handleDiffChange = (d: GameDifficulty) => {
    setDiff(d);
    onSelectDifficulty?.(d);
    onSpeak?.(
      `Game difficulty set to ${d}. ${
        d === 'easy'
          ? 'Gentle pacing for a calm dopamine warm-up.'
          : d === 'medium'
          ? 'Balanced prefrontal working-memory pace.'
          : 'High-speed executive challenge activated! Let us play.'
      }`
    );
  };

  // --- GAME 1: HARMONIC SIMON PULSE (Working Memory) ---
  const [simonSeq, setSimonSeq] = useState<number[]>([0, 2]);
  const [userSeq, setUserSeq] = useState<number[]>([]);
  const [litPad, setLitPad] = useState<number | null>(null);
  const [simonStatus, setSimonStatus] = useState<'ready' | 'showing' | 'input' | 'won_round' | 'reset'>('ready');
  const [simonScore, setSimonScore] = useState(0);
  const [bestSpan, setBestSpan] = useState(2);

  const stepIntervalMs = diff === 'easy' ? 680 : diff === 'medium' ? 480 : 320;

  const playSimonSequence = useCallback(
    (seq: number[]) => {
      setSimonStatus('showing');
      setUserSeq([]);
      seq.forEach((padId, idx) => {
        setTimeout(() => {
          setLitPad(padId);
          playTone(SIMON_PADS[padId].freq, stepIntervalMs * 0.65);
          setTimeout(() => {
            setLitPad(null);
            if (idx === seq.length - 1) {
              setSimonStatus('input');
            }
          }, stepIntervalMs * 0.7);
        }, idx * stepIntervalMs);
      });
    },
    [stepIntervalMs]
  );

  const startSimonRound = useCallback(() => {
    const startLen = diff === 'easy' ? 2 : diff === 'medium' ? 3 : 4;
    const initial = Array.from({ length: startLen }, (_, i) => (i * 2 + 1) % 4);
    setSimonSeq(initial);
    setSimonScore(0);
    onSpeak?.(`Watch the Orb quadrants light up in ${diff} mode, then tap or say the colors in order!`);
    playSimonSequence(initial);
  }, [diff, onSpeak, playSimonSequence]);

  const handleSimonPadPress = useCallback(
    (padId: number) => {
      setLitPad(padId);
      playTone(SIMON_PADS[padId].freq, 180);
      setTimeout(() => setLitPad(null), 200);

      if (simonStatus !== 'input') {
        // Allow immediate play even if user taps directly before clicking "Start"
        setSimonScore((s) => s + 10);
        return;
      }

      const nextUser = [...userSeq, padId];
      setUserSeq(nextUser);
      const idx = nextUser.length - 1;

      if (simonSeq[idx] !== padId) {
        setSimonStatus('reset');
        onSpeak?.("No worries at all! ADHD working memory warms up with repetition. Let's try that sequence again.");
        setTimeout(() => playSimonSequence(simonSeq), 900);
        return;
      }

      if (nextUser.length === simonSeq.length) {
        const newScore = simonScore + simonSeq.length * 15;
        setSimonScore(newScore);
        const nextSeq = [...simonSeq, Math.floor(Math.random() * 4)];
        setSimonSeq(nextSeq);
        setBestSpan((prev) => Math.max(prev, nextSeq.length));
        setSimonStatus('won_round');
        onSpeak?.(`Awesome working memory! Span is now ${nextSeq.length} pulses.`);
        setTimeout(() => playSimonSequence(nextSeq), 850);
      }
    },
    [onSpeak, playSimonSequence, simonScore, simonSeq, simonStatus, userSeq]
  );

  // --- GAME 2: PREFRONTAL GO / NO-GO IMPULSE SHIELD ---
  const [goTarget, setGoTarget] = useState<'none' | 'go' | 'nogo'>('go');
  const [goScore, setGoScore] = useState(0);
  const [goHits, setGoHits] = useState(0);
  const [goMistakes, setGoMistakes] = useState(0);
  const [lastReactionMs, setLastReactionMs] = useState<number | null>(218);
  const [goRunning, setGoRunning] = useState(false);
  const targetSpawnTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!goRunning || game !== 'gonogo') return;
    const period = diff === 'easy' ? 1650 : diff === 'medium' ? 1200 : 850;
    const timer = setInterval(() => {
      const isNoGo = Math.random() < (diff === 'hard' ? 0.38 : 0.28);
      setGoTarget(isNoGo ? 'nogo' : 'go');
      targetSpawnTimeRef.current = performance.now();
    }, period);
    return () => clearInterval(timer);
  }, [diff, game, goRunning]);

  const handleGoNoGoTap = () => {
    const rt = Math.max(95, Math.min(890, Math.round(performance.now() - targetSpawnTimeRef.current)));
    if (goTarget === 'go') {
      playTone(587.33, 140);
      setLastReactionMs(rt);
      setGoHits((h) => h + 1);
      setGoScore((s) => s + (diff === 'hard' ? 25 : 15));
      setGoTarget('none');
      setTimeout(() => {
        setGoTarget(Math.random() < 0.25 ? 'nogo' : 'go');
        targetSpawnTimeRef.current = performance.now();
      }, 320);
    } else if (goTarget === 'nogo') {
      playTone(220.0, 220);
      setGoMistakes((m) => m + 1);
      onSpeak?.('Oops, that was a Crimson Hold decoy! Pause a split-second before tapping.');
      setGoTarget('go');
      targetSpawnTimeRef.current = performance.now();
    } else {
      setGoTarget('go');
      targetSpawnTimeRef.current = performance.now();
    }
  };

  // --- GAME 3: DOPAMINE WORD-CHAIN CO-OP RALLY ---
  const [rallyHistory, setRallyHistory] = useState<Array<{ speaker: 'user' | 'stay'; word: string }>>([
    { speaker: 'stay', word: 'focus' },
  ]);
  const [rallyInput, setRallyInput] = useState('');
  const [rallyStreak, setRallyStreak] = useState(1);

  const submitRallyWord = useCallback(
    (rawWord: string) => {
      const clean = rawWord.trim().toLowerCase().replace(/[^a-z]/g, '');
      if (!clean) return;
      const lastChar = clean[clean.length - 1] || 's';
      const candidates = RALLY_DICTIONARY[lastChar] || ['serenity', 'spark', 'steady'];
      const stayReply = candidates[rallyStreak % candidates.length];

      setRallyHistory((prev) => [
        ...prev.slice(-5),
        { speaker: 'user', word: clean },
        { speaker: 'stay', word: stayReply },
      ]);
      setRallyStreak((s) => s + 1);
      setRallyInput('');
      playTone(523.25, 150);
      onSpeak?.(`${stayReply}! Your turn with the letter ${stayReply[stayReply.length - 1].toUpperCase()}.`);
    },
    [onSpeak, rallyStreak]
  );

  // Voice utterance reactivity for hands-free game play
  const prevUtteranceRef = useRef<string>('');
  useEffect(() => {
    if (!lastUserUtterance || lastUserUtterance === prevUtteranceRef.current) return;
    prevUtteranceRef.current = lastUserUtterance;
    const clean = lastUserUtterance.toLowerCase();

    // 1. Game switching via voice
    if (/\b(?:simon|pulse|memory\s+game)\b/.test(clean)) {
      handleGameChange('simon');
      return;
    }
    if (/\b(?:go\s*no\s*go|impulse|shield|reflex)\b/.test(clean)) {
      handleGameChange('gonogo');
      return;
    }
    if (/\b(?:word\s+rally|word\s+chain|words)\b/.test(clean)) {
      handleGameChange('wordrally');
      return;
    }

    // 2. Difficulty switching via voice
    if (/\b(?:easy|gentle|beginner|slow)\b/.test(clean)) {
      handleDiffChange('easy');
      return;
    }
    if (/\b(?:medium|normal|standard)\b/.test(clean)) {
      handleDiffChange('medium');
      return;
    }
    if (/\b(?:hard|fast|expert|challenge|difficult)\b/.test(clean)) {
      handleDiffChange('hard');
      return;
    }

    // 3. In-game voice commands
    if (game === 'simon') {
      if (/\b(?:emerald|green|north|one|1)\b/.test(clean)) handleSimonPadPress(0);
      else if (/\b(?:sapphire|blue|east|two|2)\b/.test(clean)) handleSimonPadPress(1);
      else if (/\b(?:amber|gold|yellow|south|three|3)\b/.test(clean)) handleSimonPadPress(2);
      else if (/\b(?:violet|purple|west|four|4)\b/.test(clean)) handleSimonPadPress(3);
      else if (/\b(?:start|begin|go|play|new\s+round)\b/.test(clean)) startSimonRound();
    } else if (game === 'gonogo') {
      if (/\b(?:go|target|hit|now|catch|press|shield|tap|yes)\b/.test(clean)) {
        handleGoNoGoTap();
      }
    } else if (game === 'wordrally') {
      const tokens = clean.split(/\s+/).filter(Boolean);
      const candidate = tokens[tokens.length - 1];
      if (candidate && candidate.length >= 2 && !/^(?:play|game|word|rally)$/.test(candidate)) {
        submitRallyWord(candidate);
      }
    }
  }, [lastUserUtterance, game, handleSimonPadPress, submitRallyWord, handleGoNoGoTap, startSimonRound]);

  const inhibitionAccuracy =
    goHits + goMistakes > 0 ? Math.round((goHits / (goHits + goMistakes)) * 100) : 100;

  return (
    <div
      className="mt-4 w-full max-w-xl rounded-[26px] bg-white/95 backdrop-blur-2xl p-5 border border-black/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.09)] transition-all"
      data-testid="orb-cognitive-games-arena"
    >
      {/* Header + Difficulty Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3">
        <div>
          <span className="text-[0.68rem] font-bold uppercase tracking-widest text-[#006A67] block">
            🎮 Co-Op ADHD Prefrontal Game Arena · Stay &amp; You
          </span>
          <h3 className="text-sm font-bold text-ink">
            Play with the Living Orb (Voice or Touch)
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className="inline-flex items-center rounded-full bg-black/[0.05] p-0.5 border border-black/[0.06]"
            role="group"
            aria-label="Game difficulty"
            data-testid="game-difficulty-selector"
          >
            {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDiffChange(d)}
                data-testid={`game-diff-${d}`}
                aria-pressed={diff === d}
                className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold capitalize transition-all ${
                  diff === d
                    ? 'bg-[#006A67] text-white shadow-2xs'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[0.7rem] font-semibold text-ink hover:bg-black/[0.1]"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* 3 Game Mode Tabs */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => handleGameChange('simon')}
          data-testid="game-tab-simon"
          aria-pressed={game === 'simon'}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            game === 'simon'
              ? 'bg-[#006A67]/12 text-[#006A67] border border-[#006A67]/30'
              : 'bg-black/[0.04] text-ink-2 hover:text-ink'
          }`}
        >
          🎵 Harmonic Simon Pulse
        </button>
        <button
          type="button"
          onClick={() => handleGameChange('gonogo')}
          data-testid="game-tab-gonogo"
          aria-pressed={game === 'gonogo'}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            game === 'gonogo'
              ? 'bg-[#006A67]/12 text-[#006A67] border border-[#006A67]/30'
              : 'bg-black/[0.04] text-ink-2 hover:text-ink'
          }`}
        >
          🛡️ Impulse Shield (Go/No-Go)
        </button>
        <button
          type="button"
          onClick={() => handleGameChange('wordrally')}
          data-testid="game-tab-wordrally"
          aria-pressed={game === 'wordrally'}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            game === 'wordrally'
              ? 'bg-[#006A67]/12 text-[#006A67] border border-[#006A67]/30'
              : 'bg-black/[0.04] text-ink-2 hover:text-ink'
          }`}
        >
          ⚡ Dopamine Word Rally
        </button>
      </div>

      {/* GAME 1: SIMON PULSE */}
      {game === 'simon' && (
        <div className="mt-3.5 space-y-3" data-testid="game-panel-simon">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-2">
              Clinical Target: <strong>Visuospatial Working Memory (Klingberg)</strong>
            </span>
            <span className="font-mono font-bold text-[#006A67]" data-testid="simon-score">
              Score: {simonScore} · Span: {bestSpan}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {SIMON_PADS.map((pad) => {
              const isLit = litPad === pad.id;
              return (
                <button
                  key={pad.id}
                  type="button"
                  onClick={() => handleSimonPadPress(pad.id)}
                  data-testid={`simon-pad-${pad.id}`}
                  className="rounded-2xl p-3.5 text-left transition-all duration-150 border flex items-center justify-between cursor-pointer select-none"
                  style={{
                    backgroundColor: isLit ? pad.color : '#F7F6F2',
                    borderColor: isLit ? pad.color : 'rgba(0,0,0,0.08)',
                    boxShadow: isLit ? `0 0 24px ${pad.glow}` : 'none',
                    color: isLit ? '#FFFFFF' : '#141413',
                    transform: isLit ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <div>
                    <span className="text-xs font-bold block">{pad.label}</span>
                    <span className="text-[0.68rem] opacity-80">Say &ldquo;{pad.name}&rdquo; or Tap</span>
                  </div>
                  <span className="font-mono text-xs font-semibold">{Math.round(pad.freq)}Hz</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-ink-2">
              {simonStatus === 'showing'
                ? '👀 Watch the Orb sequence...'
                : simonStatus === 'input'
                ? `🎯 Your turn (${userSeq.length}/${simonSeq.length}) — tap or say color!`
                : simonStatus === 'won_round'
                ? '✨ Sequence complete! Leveling up...'
                : 'Ready — click Play Sequence or tap any quadrant'}
            </span>
            <button
              type="button"
              onClick={startSimonRound}
              data-testid="simon-start-btn"
              className="btn btn-primary py-1.5 px-3.5 text-xs rounded-full"
            >
              {simonStatus === 'ready' ? 'Play Sequence' : 'Replay Pulse'}
            </button>
          </div>
        </div>
      )}

      {/* GAME 2: PREFRONTAL GO / NO-GO IMPULSE SHIELD */}
      {game === 'gonogo' && (
        <div className="mt-3.5 space-y-3" data-testid="game-panel-gonogo">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-2">
              Clinical Target: <strong>Prefrontal Inhibitory Control (Barkley/Still)</strong>
            </span>
            <span className="font-mono font-bold text-[#006A67]" data-testid="gonogo-metrics">
              RT: {lastReactionMs ?? '--'}ms · Accuracy: {inhibitionAccuracy}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGoNoGoTap}
              data-testid="gonogo-target-btn"
              className={`flex-1 rounded-2xl p-4 text-center font-bold transition-all cursor-pointer border ${
                goTarget === 'go'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-[0_8px_28px_rgba(16,185,129,0.35)]'
                  : goTarget === 'nogo'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-[0_8px_28px_rgba(225,29,72,0.35)]'
                  : 'bg-[#F5F5F7] text-ink border-black/[0.08]'
              }`}
            >
              {goTarget === 'go' ? (
                <span>🟢 EMERALD SIGNAL — TAP NOW! (+15 pts)</span>
              ) : goTarget === 'nogo' ? (
                <span>🔴 CRIMSON DECOY — HOLD IMPULSE! (DO NOT TAP)</span>
              ) : (
                <span>⏳ Wait for next neural signal...</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setGoRunning((r) => !r)}
              data-testid="gonogo-toggle-auto"
              className="btn btn-secondary py-3 px-3.5 text-xs rounded-2xl shrink-0"
            >
              {goRunning ? 'Pause Stream' : 'Auto Stream'}
            </button>
          </div>

          <p className="text-[0.72rem] text-ink-2">
            Score: <strong>{goScore}</strong> · Hits: <strong>{goHits}</strong> · Impulse slips:{' '}
            <strong>{goMistakes}</strong>. Trains right-inferior frontal cortex braking before task sprints.
          </p>
        </div>
      )}

      {/* GAME 3: DOPAMINE WORD-CHAIN CO-OP RALLY */}
      {game === 'wordrally' && (
        <div className="mt-3.5 space-y-3" data-testid="game-panel-wordrally">
          <div className="flex items-center justify-between text-xs">
            <span className="text-ink-2">
              Clinical Target: <strong>Left-PFC Verbal Fluency &amp; Dopamine Ignition</strong>
            </span>
            <span className="font-mono font-bold text-[#006A67]" data-testid="wordrally-streak">
              Co-Op Rally Streak: {rallyStreak}x
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F5F5F7] p-3 border border-black/[0.06]">
            {rallyHistory.map((item, idx) => (
              <span
                key={`${item.word}-${idx}`}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  item.speaker === 'stay'
                    ? 'bg-[#006A67] text-white'
                    : 'bg-white text-ink border border-black/[0.08]'
                }`}
              >
                {item.speaker === 'stay' ? 'Stay: ' : 'You: '}
                {item.word}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={rallyInput}
              onChange={(e) => setRallyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitRallyWord(rallyInput);
                }
              }}
              data-testid="wordrally-input"
              placeholder={`Say or type a word starting with "${rallyHistory[rallyHistory.length - 1]?.word.slice(-1).toUpperCase() || 'S'}"...`}
              className="flex-1 rounded-full bg-[#F5F5F7] px-3.5 py-1.5 text-xs text-ink border border-black/[0.08] focus:outline-none focus:border-[#006A67]"
            />
            <button
              type="button"
              onClick={() => submitRallyWord(rallyInput || 'spark')}
              data-testid="wordrally-submit"
              className="btn btn-primary py-1.5 px-4 text-xs rounded-full"
            >
              Play Word
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
