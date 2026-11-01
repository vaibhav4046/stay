import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachGuardHeaders, guardPaidRoute, readBoundedJson } from '@/lib/security/apiGuard';
import { callLlm, llmHeaders } from '@/lib/llm/provider';

const TranslateBodySchema = z.object({
  text: z.string().min(1).max(2000),
  sourceLanguage: z.string().max(32).optional(),
  targetLanguage: z.string().min(2).max(32),
});

const DICTIONARY_MAP: Record<string, Record<string, string>> = {
  es: {
    'i feel overwhelmed': 'Me siento abrumado',
    'help me start': 'Ayúdame a empezar',
    'open the document': 'Abre el documento',
    'take one breath': 'Respira hondo',
  },
  fr: {
    'i feel overwhelmed': 'Je me sens dépassé',
    'help me start': 'Aide-moi à commencer',
    'open the document': 'Ouvre le document',
    'take one breath': 'Prends une respiration',
  },
  de: {
    'i feel overwhelmed': 'Ich fühle mich überwältigt',
    'help me start': 'Hilf mir anzufangen',
    'open the document': 'Öffne das Dokument',
    'take one breath': 'Atme einmal tief durch',
  },
  hi: {
    'i feel overwhelmed': 'मैं बहुत अभिभूत महसूस कर रहा हूँ',
    'help me start': 'मुझे शुरू करने में मदद करें',
    'open the document': 'दस्तावेज़ खोलें',
    'take one breath': 'एक गहरी सांस लें',
  },
};

export async function POST(req: NextRequest) {
  const guard = guardPaidRoute(req, 'chat');
  if (!guard.ok && guard.response) return guard.response;

  const bodyResult = await readBoundedJson(req, 32_768);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = TranslateBodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return attachGuardHeaders(
      NextResponse.json({ error: 'invalid_payload', details: parsed.error.issues }, { status: 400 }),
      guard
    );
  }

  const { text, targetLanguage } = parsed.data;
  const targetLower = targetLanguage.toLowerCase().slice(0, 2);

  // Quick dictionary lookup
  const cleanKey = text.trim().toLowerCase();
  const dictHit = DICTIONARY_MAP[targetLower]?.[cleanKey];
  if (dictHit) {
    return attachGuardHeaders(
      NextResponse.json({
        translatedText: dictHit,
        targetLanguage,
        source: 'dictionary',
      }),
      guard
    );
  }

  // Real translation only. If no provider answers, say so — never echo the input
  // back dressed up as a translation.
  let llmRes = null;
  try {
    llmRes = await callLlm(req, {
      messages: [
        {
          role: 'system',
          content: `You are a real-time speech translator. Translate the given text into language ${targetLanguage}. Return ONLY the direct translation. Do not include quotes, greetings, or explanations.`,
        },
        { role: 'user', content: text },
      ],
      maxTokens: 300,
      temperature: 0.1,
      serverModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      timeoutMs: 8000,
    });
  } catch {
    llmRes = null;
  }

  if (llmRes?.ok && llmRes.text.trim()) {
    return attachGuardHeaders(
      NextResponse.json(
        {
          translatedText: llmRes.text.trim(),
          targetLanguage,
          source: llmRes.source,
        },
        { headers: llmHeaders(llmRes) }
      ),
      guard
    );
  }

  return attachGuardHeaders(
    NextResponse.json(
      {
        error: 'translation_unavailable',
        message: 'No translation provider answered. Nothing was translated.',
        targetLanguage,
        source: 'unavailable',
        reason: llmRes?.error ?? 'unreachable',
      },
      { status: 503, headers: llmHeaders(llmRes) }
    ),
    guard
  );
}
