import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_CHARS, isImageDataUrl, isQuietReply, looksVisual, wantsToShow, withImage } from '@/lib/vision/image';
import { detectPanel, parseMultiIntentUtterance } from '@/lib/voice/voiceCommands';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';

describe('vision: what may be sent', () => {
  it('accepts a small jpeg, png or webp data URL and nothing else', () => {
    expect(isImageDataUrl(JPEG)).toBe(true);
    expect(isImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isImageDataUrl('data:image/webp;base64,UklGRg==')).toBe(true);
    for (const bad of ['', 'hello', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGgxPg==', 'https://example.com/a.jpg', 'data:image/jpeg;base64,<script>', null, 42]) {
      expect(isImageDataUrl(bad), String(bad)).toBe(false);
    }
  });

  it('rejects a picture over the size cap', () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(MAX_IMAGE_CHARS);
    expect(isImageDataUrl(big)).toBe(false);
  });

  it('turns only the last user message into text plus picture', () => {
    const out = withImage(
      [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'Hey.' },
        { role: 'user', content: 'what is wrong here?' },
      ],
      JPEG,
    );
    expect(out[0]).toEqual({ role: 'user', content: 'hi' });
    expect(out[1]).toEqual({ role: 'assistant', content: 'Hey.' });
    expect(out[2].content).toEqual([
      { type: 'text', text: 'what is wrong here?' },
      { type: 'image_url', image_url: { url: JPEG } },
    ]);
  });
});

describe('vision: when a shared screen is looked at', () => {
  it('pointing at something on the shared screen carries a frame too (field test: "it looks gimmick", Stay answered blind)', () => {
    for (const t of ['what do you think of this?', 'how do I fix this', 'which one should I pick', 'what should I write here?', 'what does this error mean', 'does this make sense', 'is this email okay to send', 'what should I click', 'this button does nothing', 'can you check this for me']) expect(looksVisual(t), t).toBe(true);
    for (const t of ['I can not start this', 'this is so hard', 'I hate this week', 'what do you think about procrastination', 'how do I stop avoiding things']) expect(looksVisual(t), t).toBe(false);
  });

  it('turns that point at the screen carry a frame; ordinary talk does not', () => {
    for (const t of ['what do you see', 'look at this', 'is this right?', 'read it for me', 'help me with this', "what's on my screen", 'what is wrong with this form']) expect(looksVisual(t), t).toBe(true);
    for (const t of ['I keep putting off the email', 'I feel overwhelmed', 'yes', 'start a five minute timer', 'I can not start this']) expect(looksVisual(t), t).toBe(false);
  });

  it('asking to share opens the Show Stay panel, by voice or typing', () => {
    for (const t of ['share my screen', 'can you look at my screen', 'what do you see', 'use the camera', 'let me show you my desk'.replace('let me show you my desk', 'I want to show you my desk')]) {
      expect(detectPanel(t), t).toBe('vision');
      expect(parseMultiIntentUtterance(t).commands.some((c) => c.type === 'show_panel' && c.panel === 'vision'), t).toBe(true);
    }
    for (const t of ['I can see why I avoid it', 'show my history', 'open brain dump']) expect(detectPanel(t) === 'vision', t).toBe(false);
  });

  it('a quiet glance reply is exactly OK', () => {
    expect(isQuietReply('OK')).toBe(true);
    expect(isQuietReply(' ok. ')).toBe(true);
    expect(isQuietReply('OK, but your timer ended.')).toBe(false);
  });
});
