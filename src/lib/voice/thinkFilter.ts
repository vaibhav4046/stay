/**
 * Some models write their reasoning between <think> and </think> (an empty block when reasoning is switched off). Real-model soak,
 * 3 Nov 2026: a reply began with a literal "<think></think>" in the chat bubble. Those blocks are never shown or spoken. The filter works
 * on a stream: a tag may arrive split across chunks, so a possible tag start is held back until the next chunk decides.
 */
const OPEN = '<think>';
const CLOSE = '</think>';

export interface ThinkFilter {
  push(chunk: string): string;
  /** the end of the stream: whatever was held back and is not part of a think block */
  end(): string;
}

export function makeThinkFilter(): ThinkFilter {
  let buf = '';
  let inThink = false;
  let startOfAnswer = true; // blank space right after a think block is dropped
  return {
    push(chunk) {
      buf += chunk;
      let out = '';
      for (;;) {
        if (inThink) {
          const i = buf.indexOf(CLOSE);
          if (i < 0) {
            buf = buf.slice(-(CLOSE.length - 1)); // keep a possible start of "</think>"
            return out;
          }
          buf = buf.slice(i + CLOSE.length);
          inThink = false;
          startOfAnswer = true;
          continue;
        }
        const i = buf.indexOf(OPEN);
        if (i >= 0) {
          out += buf.slice(0, i);
          buf = buf.slice(i + OPEN.length);
          inThink = true;
          continue;
        }
        const partial = /<(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/.exec(buf);
        const emit = partial ? buf.slice(0, partial.index) : buf;
        buf = partial ? buf.slice(partial.index) : '';
        out += emit;
        if (startOfAnswer) {
          out = out.replace(/^\s+/, '');
          if (out) startOfAnswer = false;
        }
        return out;
      }
    },
    end() {
      const rest = inThink ? '' : buf;
      buf = '';
      return startOfAnswer ? rest.replace(/^\s+/, '') : rest;
    },
  };
}

/** The whole text at once. */
export function stripThink(text: string): string {
  const f = makeThinkFilter();
  return (f.push(text) + f.end()).trim();
}
