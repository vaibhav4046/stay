import { describe, expect, it } from 'vitest';
import { isSmallTalk } from '@/lib/voice/smallTalk';
describe('isSmallTalk', () => {
  it.each(['Hi, how are you?', 'hello', 'Hey Stay', 'good morning', 'can you hear me', 'namaste'])('chat: %s', (s) => expect(isSmallTalk(s)).toBe(true));
  it.each(['hi, help me start my taxes', 'I need to write an email', 'I feel overwhelmed', 'turn into a rocket and start timer'])('task: %s', (s) => expect(isSmallTalk(s)).toBe(false));
});
