// Paste into the console (or a javascript tool) of a voice product's tab BEFORE starting its voice session.
// 1. getUserMedia now returns a stream fed by pre-recorded simulated speakers (clips hosted in this repo).
// 2. The product's own reply audio is tapped (WebRTC tracks, media elements, anything connected to an AudioContext's
//    destination) with analysers, so reply timing is measured inside the page on the same clock as our speech events.
// Use: await __rig.run([['u1', 18000], ['u2', 18000]]); then JSON.stringify(__rig.report()).
(() => {
  if (window.__rig) return 'already';
  const BASE = location.hostname.endsWith('vercel.app') ? location.origin + '/rig/' : 'https://raw.githubusercontent.com/vaibhav4046/stay/master/scripts/voice-e2e/realmic/audio/';
  const END = { u1: 3.291, u2: 2.746, u3: 4.023, pause_a: 3.469, pause_b: 2.344, ask: 3.12, interrupt: 2.757, backchannel: 0.791, ask_long: 8.501 };
  const ctx = new AudioContext({ sampleRate: 48000 });
  const dest = ctx.createMediaStreamDestination();
  const cs = ctx.createConstantSource(); const g0 = ctx.createGain(); g0.gain.value = 0; cs.connect(g0).connect(dest); cs.start();
  const rig = { ctx, dest, log: [], gum: 0, voice: 'ryan_uk', els: {}, END, lv: [], an: [], t0: Date.now() };
  // ---- fake microphone
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    if (c && c.audio) { await ctx.resume(); rig.gum++; return new MediaStream(dest.stream.getAudioTracks().map((t) => t.clone())); }
    return orig(c);
  };
  rig.load = (name) => {
    const key = rig.voice + '_' + name + '_n';
    if (rig.els[key]) return rig.els[key];
    const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.src = BASE + key + '.mp3';
    ctx.createMediaElementSource(el).connect(dest); rig.els[key] = el; return el;
  };
  rig.play = (name) => new Promise((resolve) => {
    const el = rig.load(name); el.currentTime = 0;
    const ent = { name, voice: rig.voice };
    el.onplaying = () => { if (!ent.start) { ent.start = Date.now(); ent.speechEnd = ent.start + END[name] * 1000; } };
    el.onended = () => { ent.end = Date.now(); rig.log.push(ent); resolve(ent); };
    ctx.resume().then(() => el.play());
  });
  rig.run = async (seq) => { for (const [n, gap] of seq) { await rig.play(n); await new Promise((r) => setTimeout(r, gap)); } return rig.log.length; };
  // ---- tap the product's reply audio
  const tapNode = (c, node) => { const a = c.createAnalyser(); a.fftSize = 1024; oc.call(node, a); rig.an.push(a); };
  const oc = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) {
    const res = oc.call(this, d, ...r);
    try { if (d instanceof AudioDestinationNode && !this.__tap) { this.__tap = 1; tapNode(this.context, this); } } catch (e) { /* ignore */ }
    return res;
  };
  const tapStream = (s) => { try { const c = new AudioContext(); const a = c.createAnalyser(); a.fftSize = 1024; c.createMediaStreamSource(s).connect(a); rig.an.push(a); c.resume(); } catch (e) { /* ignore */ } };
  const op = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    try { if (this.srcObject && !this.__tap) { this.__tap = 1; tapStream(this.srcObject); } } catch (e) { /* ignore */ }
    return op.apply(this, a);
  };
  const OPC = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...a) {
    const pc = new OPC(...a);
    pc.addEventListener('track', (ev) => { if (ev.track.kind === 'audio') tapStream(new MediaStream([ev.track])); });
    return pc;
  };
  window.RTCPeerConnection.prototype = OPC.prototype; Object.setPrototypeOf(window.RTCPeerConnection, OPC);
  const buf = new Float32Array(1024);
  setInterval(() => {
    let m = 0;
    for (const a of rig.an) { a.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < 1024; i++) s += buf[i] * buf[i]; m = Math.max(m, Math.sqrt(s / 1024)); }
    rig.lv.push([Date.now(), m]);
  }, 20);
  rig.report = (thrMin = 0.004) => {
    const early = rig.lv.slice(0, 100).map((x) => x[1]).sort((a, b) => a - b);
    const floor = early.length ? early[Math.floor(early.length / 2)] : 0;
    const thr = Math.max(thrMin, floor * 5);
    const segs = []; let s = null, last = null;
    for (const [t, l] of rig.lv) {
      if (l > thr) { if (s === null) s = t; last = t; } else if (s !== null && t - last > 240) { if (last - s >= 250) segs.push([s, last]); s = null; }
    }
    if (s !== null && last - s >= 250) segs.push([s, last]);
    const t0 = rig.log.length ? rig.log[0].start : 0;
    return { floor, thr, taps: rig.an.length, gum: rig.gum, events: rig.log.map((e) => [e.name, Math.round(e.start - t0), Math.round(e.speechEnd - t0)]), segs: segs.map(([a, b]) => [Math.round(a - t0), Math.round(b - t0)]), maxLevel: Math.max(...rig.lv.map((x) => x[1])) };
  };
  ['u1', 'u2', 'u3', 'pause_a', 'pause_b', 'ask', 'interrupt', 'ask_long'].forEach(rig.load);
  window.__rig = rig;
  return 'ok';
})()
