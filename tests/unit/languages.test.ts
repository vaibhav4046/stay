import { describe, it, expect } from 'vitest';
import { detectTextLanguage, SUPPORTED_LANGUAGES, AVAILABLE_VOICES } from '@/lib/voice/useVoiceAgent';
import { detectVoiceCommand } from '@/lib/voice/voiceCommands';

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

  it('accurately classifies distinct non-Latin script families without latency', () => {
    // Hindi (Devanagari)
    expect(detectTextLanguage('नमस्ते मुझे काम शुरू करने में मदद चाहिए')).toBe('hi-IN');
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
    // Korean
    expect(detectTextLanguage('지금 이 작업을 시작하고 싶어요')).toBe('ko-KR');
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

  it('verifies available voice personas and metadata', () => {
    expect(AVAILABLE_VOICES.length).toBeGreaterThanOrEqual(6);
    const ids = AVAILABLE_VOICES.map((v) => v.id);
    expect(ids).toContain('anna');
    expect(ids).toContain('oliver');
    expect(ids).toContain('amanda');
    expect(ids).toContain('charles');
    expect(ids).toContain('rachel');
    expect(ids).toContain('josh');

    const anna = AVAILABLE_VOICES.find((v) => v.id === 'anna');
    expect(anna?.gender).toBe('female');
    const oliver = AVAILABLE_VOICES.find((v) => v.id === 'oliver');
    expect(oliver?.gender).toBe('male');
  });
});
