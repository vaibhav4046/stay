// Does the request Stay sends (streaming chat + one tool, no vendor-only parameters) work on other providers?
// Usage: node scripts/voice-e2e/provider-dialect.mjs <baseUrl> <model> [apiKey]
//   e.g. node scripts/voice-e2e/provider-dialect.mjs http://localhost:20128/v1 "cloudflare-ai/@cf/mistralai/mistral-small-3.1-24b-instruct"
//        node scripts/voice-e2e/provider-dialect.mjs https://api.mistral.ai/v1 mistral-small-latest $MISTRAL_API_KEY
// Checks: (1) plain streamed reply, first token time; (2) a tool call is streamed back with parsable arguments.
const [baseUrl, model, key] = process.argv.slice(2);
if (!baseUrl || !model) { console.error('usage: provider-dialect.mjs <baseUrl> <model> [apiKey]'); process.exit(1); }

const TOOL = { type: 'function', function: { name: 'app', description: 'Control the Stay app. For park, value is the thought to set aside.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['open', 'park', 'timer_start', 'memory_show'] }, value: { type: 'string' }, minutes: { type: 'number' } }, required: ['action'] } } };

async function run(messages, withTools) {
  const t0 = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.4, max_tokens: 220, ...(withTools ? { tools: [TOOL], tool_choice: 'auto' } : {}) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return { error: `http ${res.status} ${(await res.text()).slice(0, 160)}` };
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = '', first = 0, text = ''; const calls = new Map();
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      let d; try { d = JSON.parse(line.slice(6)).choices?.[0]?.delta; } catch { continue; }
      if (d?.content) { if (!first) first = Date.now() - t0; text += d.content; }
      for (const tc of d?.tool_calls || []) { const c = calls.get(tc.index ?? 0) || { name: '', args: '' }; calls.set(tc.index ?? 0, { name: tc.function?.name || c.name, args: c.args + (tc.function?.arguments || '') }); if (!first) first = Date.now() - t0; }
    }
  }
  return { first, total: Date.now() - t0, text: text.trim(), calls: [...calls.values()] };
}

const sys = { role: 'system', content: 'You are Stay, a calm friend who helps an adult with ADHD start tasks. Reply in at most 15 words. Use the app tool when asked to park a thought.' };
const a = await run([sys, { role: 'user', content: 'I keep avoiding replying to my landlord.' }], true);
console.log('plain reply  :', a.error || `first token ${a.first} ms, total ${a.total} ms, "${a.text.slice(0, 90)}"`);
const b = await run([sys, { role: 'user', content: 'Park it: call the dentist.' }], true);
if (b.error) console.log('tool call    :', b.error);
else {
  const c = b.calls[0]; let args = null; try { args = c ? JSON.parse(c.args) : null; } catch {}
  console.log('tool call    :', c ? `${c.name} ${JSON.stringify(args)} (first chunk ${b.first} ms)` : `NO TOOL CALL, said "${b.text.slice(0, 80)}"`);
  console.log('verdict      :', args && args.action === 'park' && /dentist/i.test(args.value || '') ? 'PASS' : 'FAIL');
}
