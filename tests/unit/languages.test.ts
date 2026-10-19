import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  detectTextLanguage,
  buildLocalizedStayResponse,
  SUPPORTED_LANGUAGES,
  AVAILABLE_VOICES, isAgentVerifiedLanguage, AGENT_VERIFIED_LANGS,
} from '@/lib/voice/useVoiceAgent';
import { detectVoiceCommand } from '@/lib/voice/voiceCommands';
import { buildDeterministicCoachPlan } from '@/lib/coach/strategies';
import {
  CompliantKeyRotationPool,
  compressPromptForTokenEfficiency,
} from '@/lib/voice/tokenOptimizer';

describe('Stay 32-Language Universal Voice Engine & Detection', () => {
  it('supports at least 32 distinct world languages plus universal auto mode', () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(33); // 32 languages + auto
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('auto');
    expect(codes).toContain('en-GB');
    expect(codes).toContain('hi-IN');
    expect(codes).toContain('es-ES');
    expect(codes).toContain('fr-FR');
    expect(codes).toContain('de-DE');
    expect(codes).toContain('ja-JP');
    expect(codes).toContain('zh-CN');
    expect(codes).toContain('ar-SA');
    expect(codes).toContain('ru-RU');
    expect(codes).toContain('pt-PT');
    expect(codes).toContain('it-IT');
    expect(codes).toContain('ko-KR');
    expect(codes).toContain('tr-TR');
    expect(codes).toContain('pl-PL');
    expect(codes).toContain('vi-VN');
    expect(codes).toContain('th-TH');
  });

  it('accurately classifies distinct non-Latin script families AND Romanized Hinglish / Romanized Korean without latency', () => {
    // Hindi (Devanagari)
    expect(detectTextLanguage('नमस्ते मुझे काम शुरू करने में मदद चाहिए')).toBe('hi-IN');
    // Hindi (Romanized Hinglish)
    expect(detectTextLanguage('mujhe kaam shuru karne mein madad chahiye')).toBe('hi-IN');
    expect(detectTextLanguage('namaste mera dimag thak gaya hai')).toBe('hi-IN');
    // Korean (Hangul)
    expect(detectTextLanguage('지금 이 작업을 시작하고 싶어요')).toBe('ko-KR');
    // Korean (Romanized)
    expect(detectTextLanguage('annyeonghaseyo jigeum dowajuseyo')).toBe('ko-KR');
    // Bengali
    expect(detectTextLanguage('আমি এই কাজটি শুরু করতে চাই')).toBe('bn-BD');
    // Tamil
    expect(detectTextLanguage('நான் இந்த வேலையை தொடங்க விரும்புகிறேன்')).toBe('ta-IN');
    // Telugu
    expect(detectTextLanguage('నేను ఈ పనిని ప్రారంభించాలనుకుంటున్నాను')).toBe('te-IN');
    // Arabic
    expect(detectTextLanguage('أريد أن أبدأ العمل على المشروع')).toBe('ar-SA');
    // Hebrew
    expect(detectTextLanguage('אני רוצה להתחיל לעבוד עכשיו')).toBe('he-IL');
    // Japanese
    expect(detectTextLanguage('レポートの作成を始めたいです')).toBe('ja-JP');
    // Chinese
    expect(detectTextLanguage('我想开始写这个报告')).toBe('zh-CN');
    // Greek
    expect(detectTextLanguage('Θέλω να ξεκινήσω τη δουλειά μου τώρα')).toBe('el-GR');
    // Thai
    expect(detectTextLanguage('ฉันต้องการเริ่มทำงานนี้ตอนนี้')).toBe('th-TH');
    // Cyrillic Ukrainian
    expect(detectTextLanguage('Я хочу почати робити цей звіт')).toBe('uk-UA');
    // Cyrillic Russian
    expect(detectTextLanguage('Я хочу начать делать этот отчет')).toBe('ru-RU');
  });

  it('generates native Hindi (हिन्दी), Korean (한국어), and multilingual reactions in buildLocalizedStayResponse', () => {
    const mockPlan = buildDeterministicCoachPlan({
      taskText: 'Open the document for 60 seconds.',
      barrierType: 'overwhelm',
    });
    const hiReply = buildLocalizedStayResponse('मुझे ध्यान केंद्रित करने में मदद करो', 'hi-IN', mockPlan);
    expect(hiReply).toContain('नमस्ते');
    expect(hiReply).toContain('मैं यहीं आपके साथ हूँ');

    const koReply = buildLocalizedStayResponse('집중할 수 있게 도와줘', 'ko-KR', mockPlan);
    expect(koReply).toContain('안녕하세요');
    expect(koReply).toContain('함께할게요');

    const esReply = buildLocalizedStayResponse('Ayúdame a concentrarme', 'es-ES', mockPlan);
    expect(esReply).toContain('Estoy aquí contigo');
  });

  it('accurately classifies characteristic Western and Latin scripts', () => {
    // Spanish
    expect(detectTextLanguage('¿Cómo puedo empezar esta tarea?')).toBe('es-ES');
    // French
    expect(detectTextLanguage('Je veux préparer mon mémoire pour demain')).toBe('fr-FR');
    // German
    expect(detectTextLanguage('Ich möchte die Steuererklärung machen')).toBe('de-DE');
    // Portuguese
    expect(detectTextLanguage('Não consigo começar a fazer isso agora')).toBe('pt-PT');
    // Vietnamese
    expect(detectTextLanguage('Tôi muốn bắt đầu làm việc ngay bây giờ')).toBe('vi-VN');
    // Polish
    expect(detectTextLanguage('Nie mogę zacząć pisać tej pracy')).toBe('pl-PL');
    // Czech
    expect(detectTextLanguage('Chtěl bych začít dělat tento úkol')).toBe('cs-CZ');
    // Hungarian
    expect(detectTextLanguage('Nem tudom elkezdeni ezt a feladatot')).toBe('hu-HU');
  });

  it('detects voice commands for switching languages in natural speech', () => {
    expect(detectVoiceCommand('switch to Spanish')).toEqual({
      type: 'change_language',
      langCode: 'es-ES',
      langName: 'Spanish',
    });

    expect(detectVoiceCommand('speak in Hindi')).toEqual({
      type: 'change_language',
      langCode: 'hi-IN',
      langName: 'Hindi',
    });

    expect(detectVoiceCommand('parle en français')).toEqual({
      type: 'change_language',
      langCode: 'fr-FR',
      langName: 'French',
    });

    expect(detectVoiceCommand('sprich deutsch')).toEqual({
      type: 'change_language',
      langCode: 'de-DE',
      langName: 'German',
    });

    expect(detectVoiceCommand('habla en español')).toEqual({
      type: 'change_language',
      langCode: 'es-ES',
      langName: 'Spanish',
    });

    expect(detectVoiceCommand('switch to Japanese')).toEqual({
      type: 'change_language',
      langCode: 'ja-JP',
      langName: 'Japanese',
    });

    expect(detectVoiceCommand('auto detect language')).toEqual({
      type: 'change_language',
      langCode: 'auto',
      langName: 'Auto Detect',
    });
  });

  it('only offers voice ids the AssemblyAI Voice Agent API documents', () => {
    const DOCUMENTED = ['alba', 'eve', 'george', 'jane', 'jean', 'mary', 'michael', 'anna', 'charles', 'paul', 'vera', 'giovanni', 'lola', 'juergen', 'rafael', 'estelle'];
    for (const v of AVAILABLE_VOICES) expect(DOCUMENTED).toContain(v.id);
    expect(AVAILABLE_VOICES.some((v) => v.gender === 'male')).toBe(true);
    expect(AVAILABLE_VOICES.some((v) => v.gender === 'female')).toBe(true);
    expect(AVAILABLE_VOICES.find((v) => v.id === 'charles')?.gender).toBe('male');
  });

  it('routes verified languages to the live agent and the rest to the browser engine', () => {
    for (const c of ['en-GB', 'es-ES', 'pt-PT', 'hi-IN', 'ja-JP', 'zh-CN', 'ko-KR', 'ar-SA', 'no-NO', 'he-IL', 'vi-VN']) expect(isAgentVerifiedLanguage(c), c).toBe(true);
    // measured failures: misheard on auto-detect and silent when pinned
    for (const c of ['pl-PL', 'el-GR', 'hu-HU', 'uk-UA', 'bn-BD', 'ta-IN', 'te-IN', 'th-TH']) expect(isAgentVerifiedLanguage(c), c).toBe(false);
    expect(AGENT_VERIFIED_LANGS.length).toBe(23);
  });

  it('keeps the live voice protocol on the documented contract (regression guard)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../src/lib/voice/useVoiceAgent.ts'), 'utf8');
    expect(src).not.toContain('UpdateConfiguration'); // not a protocol event -> invalid_format -> double engine
    expect(src).not.toContain('instructions: instruction'); // no such session field
    expect(src).not.toContain('!shouldTransmitPcmFrame'); // dropping frames starves server turn detection
    expect(src).not.toContain('speech_model: u3Config'); // undocumented session field
    expect(src).toContain('FATAL_SESSION_ERRORS'); // non-fatal session.error must not start a second engine
  });

  it('rotates shared keys away from a rate-limited one, and the prompt helper only collapses whitespace', () => {
    const pool = new CompliantKeyRotationPool('assemblyai', ['key_A,key_B,key_C']);
    expect(pool.getStatus().totalKeysConfigured).toBe(3);
    const k1 = pool.getNextHealthyKey();
    const k2 = pool.getNextHealthyKey();
    expect(k1).toBe('key_A');
    expect(k2).toBe('key_B');
    pool.reportRateLimitOrError('key_C', 60000);
    // Next healthy key should skip key_C during cooldown
    expect(pool.getNextHealthyKey()).toBe('key_A');

    const compressed = compressPromptForTokenEfficiency('Please   help   me   with   this   task   now');
    expect(compressed).toBe('Please help me with this task now');

  });
});

