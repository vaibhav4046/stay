import { describe, expect, it } from 'vitest';
import { HOLD_AFTER_SPEECH_MS, INITIAL_PRESENCE, nextPresence, togglePin, type PresenceInputs, type PresenceState } from '@/lib/orb/presence';

const step = (s: PresenceState, p: Partial<PresenceInputs>, now = 0) => nextPresence(s, { speaking: false, userTalking: false, topicKey: 'orb', now, ...p });

describe('when the orb becomes a person', () => {
  it('forms when Stay starts speaking and lingers briefly after she stops', () => {
    let s = step(INITIAL_PRESENCE, { speaking: true }, 1000);
    expect(s.on).toBe(true);
    s = step(s, { speaking: true }, 2000);
    expect(s.on).toBe(true);
    s = step(s, { speaking: false }, 3000); // speech ended
    expect(s.on).toBe(true);
    s = step(s, {}, 3000 + HOLD_AFTER_SPEECH_MS - 1);
    expect(s.on).toBe(true);
    s = step(s, {}, 3000 + HOLD_AFTER_SPEECH_MS + 1);
    expect(s.on).toBe(false);
  });

  it('a new reply during the linger keeps her there', () => {
    let s = step(INITIAL_PRESENCE, { speaking: true }, 0);
    s = step(s, {}, 1000);
    s = step(s, { speaking: true }, 1500);
    s = step(s, { speaking: true }, 20000);
    expect(s.on).toBe(true);
  });

  it('the user talking sends her back to the topical shape and releases a pin', () => {
    let s = togglePin(INITIAL_PRESENCE, 0);
    expect(s.on && s.pinned).toBe(true);
    s = step(s, { userTalking: true }, 10);
    expect(s.on).toBe(false);
    expect(s.pinned).toBe(false);
    let t = step(INITIAL_PRESENCE, { speaking: true }, 0);
    t = step(t, { speaking: true, userTalking: true }, 100); // barge-in
    expect(t.on).toBe(false);
  });

  it('speech never forms her while the user is talking', () => {
    const s = step(INITIAL_PRESENCE, { speaking: true, userTalking: true });
    expect(s.on).toBe(false);
  });

  it('a keyword shape firing wins, even mid-reply', () => {
    let s = step(INITIAL_PRESENCE, { speaking: true, topicKey: 'orb' }, 0);
    expect(s.on).toBe(true);
    s = step(s, { speaking: true, topicKey: 'lotus' }, 500);
    expect(s.on).toBe(false);
    s = step(s, { speaking: true, topicKey: 'lotus' }, 900); // still the same reply: she does not pop back in
    expect(s.on).toBe(false);
    s = step(s, { speaking: false, topicKey: 'lotus' }, 1500);
    s = step(s, { speaking: true, topicKey: 'lotus' }, 3000); // the next reply: she returns
    expect(s.on).toBe(true);
  });

  it('the topical shape resting back to the orb is not a keyword and does not evict her', () => {
    let s = step({ ...INITIAL_PRESENCE, topicKey: 'coin' }, { speaking: true, topicKey: 'coin' }, 0);
    expect(s.on).toBe(true);
    s = step(s, { speaking: true, topicKey: 'orb' }, 500);
    expect(s.on).toBe(true);
  });

  it('the face button pins her until pressed again, then she leaves when she is not speaking', () => {
    let s = togglePin(INITIAL_PRESENCE, 0);
    s = step(s, {}, 100000);
    expect(s.on).toBe(true); // pinned: no timeout
    s = togglePin(s, 100000);
    expect(s.pinned).toBe(false);
    s = step(s, {}, 100001);
    expect(s.on).toBe(false);
  });

  it('un-pinning while she is speaking lets her finish the sentence', () => {
    let s = togglePin(INITIAL_PRESENCE, 0);
    s = step(s, { speaking: true }, 10);
    s = togglePin(s, 20);
    expect(s.on).toBe(true);
  });
});
