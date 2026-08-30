/**
 * SOUND ENGINE
 * -----------------------------------------------------------------------------
 * Every sound is synthesised with the Web Audio API — no asset downloads, zero
 * latency, and each camera gets a mechanically distinct voice. Sounds are short,
 * dry, and designed to land on the same frame as the matching animation.
 */

type Voice =
  | "polaroid-shutter"
  | "polaroid-motor"
  | "polaroid-eject"
  | "film35-shutter"
  | "film35-advance"
  | "disposable-shutter"
  | "disposable-charge"
  | "ccd-focus"
  | "ccd-shutter"
  | "ccd-confirm"
  | "ccd-recharge"
  | "switch"
  | "click";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let shutterEnabled = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export const soundEngine = {
  unlock() {
    ac();
  },
  configure(opts: { sound?: boolean; shutter?: boolean }) {
    if (opts.sound !== undefined) enabled = opts.sound;
    if (opts.shutter !== undefined) shutterEnabled = opts.shutter;
  },
  play(voice: Voice, when = 0) {
    if (!enabled) return;
    if (!shutterEnabled && voice.includes("shutter")) return;
    const c = ac();
    if (!c || !master) return;
    const t = c.currentTime + when;
    VOICES[voice](c, master, t);
  },
};

/* ---------- primitives ---------------------------------------------------- */

function noiseBuffer(c: AudioContext, seconds: number) {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noise(
  c: AudioContext,
  out: AudioNode,
  t: number,
  {
    dur,
    gain = 0.3,
    freq = 2000,
    q = 1,
    type = "bandpass" as BiquadFilterType,
    attack = 0.002,
    sweepTo,
  }: {
    dur: number;
    gain?: number;
    freq?: number;
    q?: number;
    type?: BiquadFilterType;
    attack?: number;
    sweepTo?: number;
  },
) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.02);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tone(
  c: AudioContext,
  out: AudioNode,
  t: number,
  {
    freq,
    dur,
    gain = 0.16,
    type = "square" as OscillatorType,
    to,
  }: { freq: number; dur: number; gain?: number; type?: OscillatorType; to?: number },
) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Mechanical clack: short body resonance + transient. */
function clack(c: AudioContext, out: AudioNode, t: number, freq: number, gain = 0.35) {
  noise(c, out, t, { dur: 0.045, gain, freq, q: 2.5, attack: 0.001 });
  tone(c, out, t, { freq: freq * 0.5, dur: 0.05, gain: gain * 0.4, type: "triangle", to: freq * 0.3 });
}

/** Small DC motor: filtered noise with a wobble. */
function motor(c: AudioContext, out: AudioNode, t: number, dur: number, gain = 0.16) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.05);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 620;
  f.Q.value = 1.6;
  const lfo = c.createOscillator();
  lfo.frequency.value = 46;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(f.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
  g.gain.setValueAtTime(gain, t + dur - 0.09);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  lfo.start(t);
  src.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

/* ---------- camera voices ------------------------------------------------- */

const VOICES: Record<Voice, (c: AudioContext, out: AudioNode, t: number) => void> = {
  "polaroid-shutter": (c, o, t) => {
    clack(c, o, t, 1700, 0.4);
    clack(c, o, t + 0.055, 1150, 0.26);
  },
  "polaroid-motor": (c, o, t) => motor(c, o, t, 0.85, 0.15),
  "polaroid-eject": (c, o, t) => {
    // rollers gripping, then paper sliding out
    noise(c, o, t, { dur: 0.5, gain: 0.1, freq: 3200, q: 0.7, type: "highpass", sweepTo: 900 });
    noise(c, o, t + 0.35, { dur: 0.3, gain: 0.07, freq: 5200, q: 0.5, type: "highpass" });
    clack(c, o, t + 0.66, 900, 0.14);
  },
  "film35-shutter": (c, o, t) => {
    clack(c, o, t, 2400, 0.34);
    clack(c, o, t + 0.028, 1500, 0.2);
  },
  "film35-advance": (c, o, t) => {
    // ratchet: a burst of tiny clicks
    for (let i = 0; i < 7; i++) {
      noise(c, o, t + i * 0.033, { dur: 0.02, gain: 0.16 - i * 0.012, freq: 3600, q: 4 });
    }
    clack(c, o, t + 0.26, 1050, 0.16);
  },
  "disposable-shutter": (c, o, t) => {
    clack(c, o, t, 2900, 0.3);
    noise(c, o, t + 0.03, { dur: 0.06, gain: 0.1, freq: 1400, q: 1.4 });
  },
  "disposable-charge": (c, o, t) => {
    // capacitor whine climbing then cutting off
    tone(c, o, t, { freq: 1500, to: 7200, dur: 1.5, gain: 0.045, type: "sawtooth" });
    noise(c, o, t + 1.5, { dur: 0.05, gain: 0.06, freq: 5000, q: 2 });
  },
  "ccd-focus": (c, o, t) => {
    tone(c, o, t, { freq: 1860, dur: 0.05, gain: 0.09, type: "sine" });
    noise(c, o, t, { dur: 0.14, gain: 0.035, freq: 520, q: 1.2 });
  },
  "ccd-shutter": (c, o, t) => {
    noise(c, o, t, { dur: 0.03, gain: 0.2, freq: 4200, q: 3 });
    tone(c, o, t + 0.01, { freq: 900, to: 420, dur: 0.09, gain: 0.1, type: "square" });
  },
  "ccd-confirm": (c, o, t) => {
    tone(c, o, t, { freq: 1560, dur: 0.06, gain: 0.09, type: "sine" });
    tone(c, o, t + 0.085, { freq: 2340, dur: 0.08, gain: 0.09, type: "sine" });
  },
  "ccd-recharge": (c, o, t) => tone(c, o, t, { freq: 2200, to: 8000, dur: 1.1, gain: 0.03, type: "sawtooth" }),
  switch: (c, o, t) => {
    noise(c, o, t, { dur: 0.09, gain: 0.14, freq: 700, q: 1.1, sweepTo: 260 });
    clack(c, o, t + 0.02, 1200, 0.12);
  },
  click: (c, o, t) => noise(c, o, t, { dur: 0.018, gain: 0.12, freq: 3000, q: 3 }),
};

export type SoundVoice = Voice;
