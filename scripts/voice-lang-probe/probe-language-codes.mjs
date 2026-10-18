// Which input.language_codes values does the live Voice Agent accept? Prints one line per code. Costs ~2 s of session each.
// Usage: node scripts/voice-lang-probe/probe-language-codes.mjs [codes,comma,separated]
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
const codes = (process.argv[2] || 'en,es,fr,de,it,pt,hi,ja,zh,ko,nl,ru,tr,pl,ar,sv,no,da,fi,el,cs,ro,hu,uk,vi,th,id,ms,he,bn,ta,te').split(',');

async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${KEY}` } });
  return (await r.json()).token;
}

function probe(code) {
  return new Promise(async (resolve) => {
    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(await mint())}`);
    const ev = [];
    let done = false;
    const end = (why) => {
      if (done) return;
      done = true;
      try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {}
      setTimeout(() => { try { ws.close(); } catch {} resolve(`${code.padEnd(3)} ${why} [${ev.join(' > ')}]`); }, 200);
    };
    const t = setTimeout(() => end('TIMEOUT'), 6000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You are Stay.', greeting: 'Hi.', input: { language_codes: [code] }, output: { voice: 'anna' } } }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      ev.push(m.type === 'session.error' ? `error:${m.code}:${String(m.message).slice(0, 70)}` : m.type);
      if (m.type === 'session.ready') { clearTimeout(t); setTimeout(() => end('ACCEPTED'), 700); }
      if (m.type === 'session.error') { clearTimeout(t); end('REJECTED'); }
    };
    ws.onclose = (e) => { ev.push(`close${e.code}`); clearTimeout(t); end(ev.some((x) => x.startsWith('error')) ? 'REJECTED' : 'CLOSED'); };
  });
}
for (const c of codes) console.log(await probe(c));
process.exit(0);
