/** Local pause detection with bounded replacement previews while speech continues. */
export const VOICE_RMS_THRESHOLD = .003;
export const LIVE_TURN_SILENCE_MS = 2000;

export class VoiceActivity {
  private preRoll: Float32Array[] = [];
  private frames: Float32Array[] = [];
  private total = 0;
  private voiced = 0;
  private quiet = 0;
  private previewAt = 0;
  private speechEnd = 0;
  private cached?: { end: number; samples: Float32Array };
  constructor(private sampleRate: number, private onTurn: (audio: Float32Array) => void, private onPreview?: (audio: Float32Array) => void, private silenceMs = 900) {}
  get ending() { return this.voiced >= this.sampleRate * .25 && this.quiet >= this.sampleRate * .25; }
  reset() { this.preRoll = []; this.frames = []; this.total = this.voiced = this.quiet = this.previewAt = this.speechEnd = 0; this.cached = undefined; }
  private snapshot() {
    if (this.cached?.end === this.speechEnd) return this.cached.samples;
    const complete = new Float32Array(this.speechEnd);
    let offset = 0;
    for (const part of this.frames) {
      const count = Math.min(part.length, complete.length - offset);
      if (count <= 0) break;
      complete.set(part.subarray(0, count), offset); offset += count;
    }
    this.cached = { end: this.speechEnd, samples: complete };
    return complete;
  }
  finish() {
    const complete = this.snapshot();
    const enoughSpeech = this.voiced >= this.sampleRate * .25;
    this.reset();
    if (enoughSpeech) this.onTurn(complete);
  }
  feed(frame: Float32Array) {
    const rms = Math.sqrt(frame.reduce((sum, value) => sum + value * value, 0) / frame.length);
    const speech = rms >= VOICE_RMS_THRESHOLD;
    if (!this.frames.length && !speech) {
      this.preRoll.push(frame);
      while (this.preRoll.reduce((sum, part) => sum + part.length, 0) > this.sampleRate * .25) this.preRoll.shift();
      return;
    }
    if (!this.frames.length) {
      this.frames.push(...this.preRoll); this.total = this.preRoll.reduce((sum, part) => sum + part.length, 0); this.preRoll = [];
    }
    this.frames.push(frame); this.total += frame.length;
    if (speech) { this.voiced += frame.length; this.quiet = 0; this.speechEnd = this.total; } else this.quiet += frame.length;
    if (this.quiet >= this.sampleRate * this.silenceMs / 1000 || this.total >= this.sampleRate * 20) {
      this.finish();
    } else if (this.onPreview && this.voiced >= this.sampleRate * .25 && this.previewAt !== this.speechEnd &&
      (this.quiet >= this.sampleRate * .25 || this.total - this.previewAt >= this.sampleRate * 2)) {
      this.previewAt = this.speechEnd;
      this.onPreview(this.snapshot());
    }
  }
}

export function pcmWave(samples: Float32Array, sampleRate: number): Blob {
  const length = Math.floor(samples.length * 16000 / sampleRate);
  const buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
  const text = (at: number, value: string) => [...value].forEach((letter, index) => view.setUint8(at + index, letter.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, length * 2, true);
  for (let index = 0; index < length; index++) {
    const start = Math.floor(index * sampleRate / 16000), end = Math.max(start + 1, Math.floor((index + 1) * sampleRate / 16000));
    let value = 0;
    for (let cursor = start; cursor < end; cursor++) value += samples[cursor] || 0;
    value = Math.max(-1, Math.min(1, value / (end - start)));
    view.setInt16(44 + index * 2, value * (value < 0 ? 32768 : 32767), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
