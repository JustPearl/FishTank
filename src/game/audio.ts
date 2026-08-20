// Tiny WebAudio synth — all SFX are generated, no assets.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let lastPop = 0;
let lastCoin = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === "suspended") void ctx.resume(); return; }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.24;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}

export function setMuted(m: boolean) { muted = m; if (master) master.gain.value = m ? 0 : 0.24; }
export function isMuted() { return muted; }

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 1, delay = 0) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur: number, vol = 1, freq = 1200, delay = 0) {
  if (!ctx || !master || !noiseBuf || muted) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.05);
}

export const sfx = {
  ui: () => tone("square", 620, 880, 0.06, 0.25),
  buy: () => { tone("triangle", 520, 240, 0.14, 0.5); noise(0.16, 0.3, 900); },
  splash: () => { noise(0.28, 0.55, 1600); tone("sine", 340, 90, 0.24, 0.4, 0.02); },
  plop: () => tone("sine", 300, 110, 0.13, 0.45),
  pop: () => { const n = performance.now(); if (n - lastPop < 120) return; lastPop = n; tone("sine", 560, 720, 0.05, 0.18); },
  coin: () => { const n = performance.now(); if (n - lastCoin < 260) return; lastCoin = n; tone("sine", 920, 920, 0.06, 0.16); tone("sine", 1380, 1380, 0.09, 0.14, 0.055); },
  clean: () => { noise(0.5, 0.5, 2600); tone("sine", 200, 520, 0.4, 0.12); },
  error: () => tone("sawtooth", 150, 90, 0.16, 0.4),
  milestone: () => { [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.16, 0.3, i * 0.09)); },
  win: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone("triangle", f, f, 0.22, 0.3, i * 0.12)); },
  die: () => tone("sine", 240, 90, 0.5, 0.4),
  warn: () => { tone("square", 330, 330, 0.09, 0.1, 0); tone("square", 247, 247, 0.14, 0.1, 0.11); },
  bubble: () => tone("sine", 700 + Math.random() * 400, 900, 0.04, 0.05),
};
