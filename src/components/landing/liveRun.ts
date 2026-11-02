/**
 * Numbers from one recorded call (scripts/real-voice-e2e.mjs): real AssemblyAI speech, a synthetic speaker standing in for
 * the microphone, Chromium on one machine. Read from the committed evidence file; nothing here is typed in by hand.
 * To refresh: re-run the script, then point the import below at the new file.
 */
import run from '../../../docs/evidence/real-e2e/run-ba6a337.json';

interface Step {
  step: string;
  endOfSpeechToStaySpeakingMs?: number;
  endOfSpeechToFirstAudioMs?: number;
  speakStartToStayStoppedMs?: number;
  wasSpeakingBefore?: boolean;
  appMarksAfterEndOfSpeech?: string[];
  micToSocket?: { frameIntervalMs: { p50: number } };
}
const steps = run.steps as Step[];
const task = steps.find((s) => s.step === 'task');
const barge = steps.find((s) => s.step === 'barge-in');
const spanish = steps.find((s) => s.step === 'spanish');
const mark = (name: string): number | null => {
  const m = task?.appMarksAfterEndOfSpeech?.find((x) => x.startsWith(`${name}@`));
  const n = m ? /\+(-?\d+)ms/.exec(m) : null;
  return n ? Number(n[1]) : null;
};

export const LIVE = {
  sha: run.gitSha.slice(0, 7),
  file: `docs/evidence/real-e2e/run-${run.gitSha.slice(0, 7)}.json`,
  /** the moments after the speaker stops, in ms */
  endOfTurn: mark('eot'),
  firstWord: mark('tok1'),
  firstSound: mark('aud1'),
  toSpeaking: task?.endOfSpeechToStaySpeakingMs ?? null,
  bargeInStop: barge?.wasSpeakingBefore ? (barge.speakStartToStayStoppedMs ?? null) : null,
  spanishFirstSound: spanish?.endOfSpeechToFirstAudioMs ?? null,
  underflows: (run as { playback?: { underflows?: number } }).playback?.underflows ?? null,
  frameEveryMs: task?.micToSocket?.frameIntervalMs.p50 ?? null,
};
