import { describe, expect, it } from 'vitest';
import { detectTextLanguage } from '@/lib/voice/useVoiceAgent';

describe('detectTextLanguage never flips English speakers into another language', () => {
  const english = [
    "Um, I've been putting off filing my taxes for months, and now the deadline is close.",
    'Come on, I keep avoiding the email on my desktop.',
    'He said I should do it for her, but I just cannot start.',
    'I want to sort out the bins and the recycling for the flat.',
    'Can you help me start? I need to call the dentist on Monday.',
    'My mum and I are going to be late, so I should send the message now.',
    'It is about the die cast model I am building, per my brother.',
    'For me, starting is the hardest part.',
    'ok',
    'um',
  ];
  it.each(english)('English: %s', (t) => expect(detectTextLanguage(t, 'auto')).toBe('en-GB'));

  const other: Array<[string, string]> = [
    ['Quiero empezar la tarea pero no puedo, estoy muy cansado.', 'es-ES'],
    ['Je veux faire mon travail mais je suis très fatigué aujourd’hui.', 'fr-FR'],
    ['Ich habe heute keine Lust und ich muss das nicht machen, aber es ist wichtig.', 'de-DE'],
    ['Non ho voglia di fare questo, sono molto stanco e ho bisogno di aiuto.', 'it-IT'],
    ['Eu estou muito cansado e não consigo começar, preciso de ajuda.', 'pt-PT'],
    ['Bu işi yapmak istiyorum ama çok yorgunum ve başlayamıyorum.', 'tr-TR'],
    ['मुझे काम शुरू करना है', 'hi-IN'],
    ['仕事を始められない', 'ja-JP'],
    ['¿Puedes ayudarme?', 'es-ES'],
  ];
  it.each(other)('%s -> %s', (t, code) => expect(detectTextLanguage(t, 'auto')).toBe(code));

  it('a manual choice always wins', () => expect(detectTextLanguage('hello there', 'fr-FR')).toBe('fr-FR'));
});
