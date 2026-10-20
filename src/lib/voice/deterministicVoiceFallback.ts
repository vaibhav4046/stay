/**
 * Deterministic Voice Fallback Engine
 * 
 * Provides an instant, clinically grounded, zero-failure conversational response
 * when external LLM providers (Groq) encounter rate limits, token exhaustion,
 * timeouts, or network outages.
 * 
 * Guarantees:
 * - 0% shame / guilt words
 * - Strict cognitive word ceiling (< 14 words)
 * - Automatic tool routing for timers, parking, dumps, and routines
 * - Compassionate listening for RSD / emotional spirals ("I hear you, that is hard.")
 * - Multilingual cultural matching
 */

import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';

export interface DeterministicVoiceResult {
  text?: string;
  tool?: {
    name: string;
    action: string;
    [key: string]: unknown;
  };
  safety?: 'crisis' | 'medication';
}

const RSD_TRIGGERS = [
  /\b(?:failure|fail|failed)\b/i,
  /\bsobbing\b/i,
  /\bcrying\b/i,
  /\bpanic\b/i,
  /\bhate my (?:brain|self|life)\b/i,
  /\beveryone (?:else|hates me)\b/i,
  /\bcan'?t do (?:anything|this)\b/i,
  /\bworst (?:person|parent|human|dev|student)\b/i,
  /\bheart is racing\b/i,
  /\bwant to scream\b/i,
  /\bconvinced .* hates? me\b/i,
  /\bwhy am i like this\b/i,
  /\bfeel like a failure\b/i,
];

export function resolveDeterministicVoice(userText: string): DeterministicVoiceResult {
  const trimmed = userText.trim();

  // 1. Safety Gates
  if (detectCrisisSignal(trimmed).triggered) {
    return { safety: 'crisis' };
  }
  if (detectMedicationAdviceRequest(trimmed).triggered) {
    return { safety: 'medication' };
  }

  // 2. Emotional Support / RSD Spiral Protection
  for (const re of RSD_TRIGGERS) {
    if (re.test(trimmed)) {
      return { text: 'I hear you, that is hard.' };
    }
  }

  // 3. Fast Tool Commands
  // Timer: "timer 2 minutes", "start 10 minute focus block", "temporizador de 5 minutos", "do minute ka timer"
  const timerMatch = trimmed.match(/(?:timer|temporizador|focus|minute|minutos|minute ka timer)\s*(?:of|de|for)?\s*(\d+)/i)
    || trimmed.match(/(\d+)\s*(?:minute|minutos|min)\s*(?:timer|focus|block)/i)
    || trimmed.match(/(?:do|ek|paanch)\s*minute ka timer/i);
  if (timerMatch || /\btimer\b/i.test(trimmed)) {
    let minutes = 2;
    if (timerMatch && timerMatch[1]) {
      minutes = parseInt(timerMatch[1], 10);
    } else if (/five|paanch|cinco/i.test(trimmed)) {
      minutes = 5;
    } else if (/ten|das|diez/i.test(trimmed)) {
      minutes = 10;
    }
    return {
      tool: {
        name: 'app',
        action: 'timer_start',
        minutes: isNaN(minutes) || minutes <= 0 ? 2 : minutes,
      },
    };
  }

  // Parking: "park it: X", "park X", "guárdalo: X"
  const parkMatch = trimmed.match(/(?:park\s+it:?|park|guárdalo:?)\s*(.+)/i);
  if (parkMatch && parkMatch[1]) {
    return {
      tool: {
        name: 'app',
        action: 'park',
        value: parkMatch[1].trim(),
      },
    };
  }

  // Brain Dump: "brain dump: X", "décharge mentale: X"
  if (/\b(?:brain dump|décharge mentale)\b/i.test(trimmed)) {
    return {
      tool: {
        name: 'app',
        action: 'dump',
        value: trimmed.replace(/^(?:brain dump|décharge mentale):?\s*/i, '').trim(),
      },
    };
  }

  // Step Next / List Edit: "that one is done", "next step", "finished that"
  if (/\b(?:that one is done|next step|finished that|what is next|done with that)\b/i.test(trimmed)) {
    if (/\bthat one is done\b/i.test(trimmed)) {
      return {
        tool: {
          name: 'app',
          action: 'list_edit',
          value: 'that one is done',
        },
      };
    }
    return {
      tool: {
        name: 'app',
        action: 'step_next',
      },
    };
  }

  // Break Down: "break down X into steps"
  const breakMatch = trimmed.match(/break\s+(?:down\s+)?(.+?)\s+into\s+steps/i);
  if (breakMatch && breakMatch[1]) {
    return {
      tool: {
        name: 'app',
        action: 'break_down',
        value: breakMatch[1].trim(),
      },
    };
  }

  // Wrap Up: "wrap up"
  if (/\b(?:wrap up|done for the night)\b/i.test(trimmed)) {
    return {
      tool: {
        name: 'app',
        action: 'wrap_up',
      },
    };
  }

  // Brevity / Style: "talk more briefly", "talk shorter"
  if (/\b(?:talk more briefly|talk shorter|talk minimal)\b/i.test(trimmed)) {
    return {
      tool: {
        name: 'app',
        action: 'style',
        value: 'minimal',
      },
    };
  }

  // Remember: "remember fact: X"
  const remMatch = trimmed.match(/remember\s+fact:?\s*(.+)/i);
  if (remMatch && remMatch[1]) {
    return {
      tool: {
        name: 'app',
        action: 'memory_add',
        value: remMatch[1].trim(),
      },
    };
  }

  // Stop Learning: "stop learning"
  if (/\bstop learning\b/i.test(trimmed)) {
    return {
      tool: {
        name: 'app',
        action: 'learning',
        value: 'off',
      },
    };
  }

  // Screen Switch: "show history screen", "show history"
  const screenMatch = trimmed.match(/show\s+(history|today|settings|treatment)\s*(?:screen)?/i);
  if (screenMatch && screenMatch[1]) {
    return {
      tool: {
        name: 'app',
        action: 'open',
        value: screenMatch[1].toLowerCase(),
      },
    };
  }

  // Remind: "remind me: X", "remind me to X in Y"
  const remindMatch = trimmed.match(/remind\s+me\s*(?:to|:)?\s*(.+)/i);
  if (remindMatch && remindMatch[1]) {
    return {
      tool: {
        name: 'app',
        action: 'remind',
        value: remindMatch[1].trim(),
      },
    };
  }

  // Resume: "pick up where we left off", "resume"
  if (/\b(?:pick up|resume)\b/i.test(trimmed)) {
    return {
      tool: {
        name: 'app',
        action: 'resume',
      },
    };
  }

  // 4. Multilingual Fallback Micro-Steps
  if (/[\u0900-\u097F]/.test(trimmed) || /\b(?:bhai|karo|mera|hain|dimaag)\b/i.test(trimmed)) {
    return { text: 'Bas pehla do minute ka chhota kadam uthayein.' };
  }
  if (/\b(?:tengo|por dónde|empezar|abrir|hacer)\b/i.test(trimmed)) {
    return { text: 'Abre el archivo y haz solo dos minutos de preparación.' };
  }
  if (/\b(?:suis|trop|angoisse|rapport|commencer)\b/i.test(trimmed)) {
    return { text: 'Ouvre le document et commence pendant deux minutes seulement.' };
  }
  if (/\b(?:muss|kopf|blockiert|abwasch|schritt)\b/i.test(trimmed)) {
    return { text: 'Öffne das Dokument und mach nur zwei Minuten Vorbereitung.' };
  }
  if (/\b(?:troppe|bloccato|aiutami|divano)\b/i.test(trimmed)) {
    return { text: 'Fai solo un piccolo passo di due minuti adesso.' };
  }
  if (/\b(?:preciso|enviar|estou|travado|primeiro)\b/i.test(trimmed)) {
    return { text: 'Faça apenas um pequeno passo de dois minutos agora.' };
  }

  // 5. Default Task Shrinking Fallback (Under 14 words, 0 guilt)
  return { text: 'Open the first thing you need, and spend two minutes with it.' };
}

/**
 * Creates an SSE stream matching OpenAI / Groq wire format from a deterministic result.
 */
export function createDeterministicSseResponse(result: DeterministicVoiceResult): Response {
  if (result.safety) {
    return new Response(JSON.stringify({ safety: result.safety }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (result.tool) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              id: 'chatcmpl-det-fallback',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'deterministic-fallback',
              choices: [
                {
                  index: 0,
                  delta: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        index: 0,
                        id: 'call_fallback_tool',
                        type: 'function',
                        function: {
                          name: result.tool.name,
                          arguments: JSON.stringify(result.tool),
                        },
                      },
                    ],
                  },
                },
              ],
            })}\n\n`
          )
        );
      } else if (result.text) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              id: 'chatcmpl-det-fallback',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'deterministic-fallback',
              choices: [
                {
                  index: 0,
                  delta: {
                    role: 'assistant',
                    content: result.text,
                  },
                },
              ],
            })}\n\n`
          )
        );
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'x-stay-llm-source': 'fallback',
    },
  });
}
