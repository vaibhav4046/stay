import { describe, it, expect } from 'vitest';
import { PlaybackEpoch } from '@/lib/voice/playback/epochs';

describe('PlaybackEpoch & Barge-In Invalidation', () => {
  it('starts at session 1, reply 1', () => {
    const tracker = new PlaybackEpoch();
    expect(tracker.sessionEpoch).toBe(1);
    expect(tracker.replyEpoch).toBe(1);
    expect(tracker.isValid(1, 1)).toBe(true);
  });

  it('increments reply epoch on nextReply()', () => {
    const tracker = new PlaybackEpoch();
    const r2 = tracker.nextReply();
    expect(r2).toBe(2);
    expect(tracker.isValid(1, 1)).toBe(false); // old reply is dead
    expect(tracker.isValid(1, 2)).toBe(true);  // new reply is active
  });

  it('cancelReply immediately invalidates active turn', () => {
    const tracker = new PlaybackEpoch();
    expect(tracker.isValid(1, 1)).toBe(true);
    
    // User interrupts
    const canceledEpoch = tracker.cancelReply();
    expect(canceledEpoch).toBe(2);
    
    // In-flight chunk with replyEpoch 1 must be rejected
    expect(tracker.isValid(1, 1)).toBe(false);
  });

  it('nextSession resets reply epoch and increments session epoch', () => {
    const tracker = new PlaybackEpoch();
    tracker.nextReply(); // reply 2
    tracker.nextReply(); // reply 3

    const { sessionEpoch, replyEpoch } = tracker.nextSession();
    expect(sessionEpoch).toBe(2);
    expect(replyEpoch).toBe(1);
    expect(tracker.isValid(1, 3)).toBe(false); // old session dead
    expect(tracker.isValid(2, 1)).toBe(true);
  });
});
