/**
 * The last line of defence for what Stay shows and says. The prompt already asks for plain spoken words; a model still slips now and
 * then. Real-model hour, 3 Nov 2026 (189 turns): double quotes around a drafted sentence (12 turns), "[Name]" placeholders (3), a stray
 * "---" (1), and stock lines the prompt bans: "Need anything else?" (2), "I hear you." (1). Only these shapes are touched; ordinary words,
 * apostrophes and numbers are left alone, and a chunk is never emptied (it would leave the person in silence).
 */
const STOCK = [
  /\bneed anything else\??/gi,
  /\blet me know if you need anything else\.?/gi,
  /\bi hear you[.,!]?/gi,
  /\bi hear that[.,!]?/gi,
  /\bi'?m right here with you[.,!]?/gi,
  /\byou have my whole attention[.,!]?/gi,
];

export function cleanReply(text: string): string {
  const original = text;
  let t = text
    .replace(/[“”"]/g, '') // quotation marks are not spoken, and look like code on screen
    .replace(/\[([^\]\n]{1,60})\]/g, '$1') // "[Name]" -> "Name"
    .replace(/(^|\s)-{3,}(\s|$)/g, '$1$2'); // a markdown rule
  for (const re of STOCK) t = t.replace(re, ' ');
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  return t || original.replace(/[“”"]/g, '').trim() || original;
}
