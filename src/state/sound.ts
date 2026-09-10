/**
 * Tiny synthesised sound effects (no audio files).
 *
 * A wooden *clack* for moves, a harder double hit for captures, a bell for
 * check, and a chord for the end of a game — all generated with oscillators and
 * a short noise burst so the app stays asset-free.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function noiseBurst(ac: AudioContext, dest: GainNode, when: number, dur: number, hp: number, gain: number) {
  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const env = Math.pow(1 - i / frames, 2.6);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(dest);
  src.start(when);
  src.stop(when + dur + 0.02);
}

function tone(ac: AudioContext, dest: GainNode, when: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g).connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.03);
}

export type SoundName = 'select' | 'move' | 'capture' | 'castle' | 'check' | 'promote' | 'end-win' | 'end-draw' | 'end-resign' | 'end-time' | 'ui' | 'error';

export function play(name: SoundName) {
  if (!enabled) return;
  const ac = ensure();
  const out = master;
  if (!ac || !out) return;
  const t = ac.currentTime + 0.001;
  switch (name) {
    case 'select':
      tone(ac, out, t, 880, 0.05, 0.035, 'triangle');
      break;
    case 'ui':
      tone(ac, out, t, 520, 0.04, 0.03, 'sine');
      break;
    case 'error':
      tone(ac, out, t, 180, 0.14, 0.05, 'sawtooth');
      break;
    case 'move':
      tone(ac, out, t, 210, 0.09, 0.09, 'sine');
      tone(ac, out, t, 320, 0.05, 0.04, 'triangle');
      noiseBurst(ac, out, t, 0.05, 1400, 0.16);
      break;
    case 'castle':
      tone(ac, out, t, 200, 0.08, 0.08, 'sine');
      tone(ac, out, t + 0.08, 240, 0.08, 0.07, 'sine');
      noiseBurst(ac, out, t, 0.05, 1200, 0.14);
      noiseBurst(ac, out, t + 0.08, 0.05, 1200, 0.12);
      break;
    case 'capture':
      tone(ac, out, t, 130, 0.16, 0.13, 'sine');
      tone(ac, out, t, 320, 0.07, 0.06, 'square');
      noiseBurst(ac, out, t, 0.13, 700, 0.3);
      break;
    case 'check':
      tone(ac, out, t, 1180, 0.22, 0.06, 'sine');
      tone(ac, out, t + 0.03, 1580, 0.2, 0.035, 'sine');
      break;
    case 'promote':
      [660, 880, 1320].forEach((f, i) => tone(ac, out, t + i * 0.05, f, 0.22, 0.05, 'triangle'));
      break;
    case 'end-win':
      [523, 659, 784, 1046].forEach((f, i) => tone(ac, out, t + i * 0.09, f, 0.5, 0.06, 'triangle'));
      break;
    case 'end-draw':
      [440, 415, 392].forEach((f, i) => tone(ac, out, t + i * 0.11, f, 0.4, 0.05, 'sine'));
      break;
    case 'end-resign':
    case 'end-time':
      [392, 330, 262].forEach((f, i) => tone(ac, out, t + i * 0.12, f, 0.45, 0.055, 'sine'));
      break;
  }
}

/** Resume the audio context on the first user gesture (browser autoplay policy). */
export function primeAudio() {
  ensure();
}
