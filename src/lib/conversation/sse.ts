/** Do these complete SSE lines carry words or a tool call? Parsed, so empty-content and reasoning-only chunks do not count as an answer. */
export function carriesAnswer(lines: string[]): boolean {
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta;
      if ((typeof delta?.content === 'string' && delta.content.trim()) || (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0)) return true;
    } catch {
      // not JSON (a comment or a keep-alive): not an answer
    }
  }
  return false;
}
