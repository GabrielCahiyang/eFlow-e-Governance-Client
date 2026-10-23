import { pcmWave, VoiceActivity, VOICE_RMS_THRESHOLD } from './voiceActivity';
import type { MicrophoneSignal } from '../types';

const processor = `class EflowVoice extends AudioWorkletProcessor { process(inputs) { const data = inputs[0]?.[0]; if (data) { const copy = new Float32Array(data); this.port.postMessage(copy, [copy.buffer]); } return true; } } registerProcessor('eflow-voice', EflowVoice);`;
type Options = { deviceId?: string; silenceMs?: number; onPreview?: (audio: Blob) => void; onSignal?: (signal: MicrophoneSignal) => void };

export class HandsFreeMicrophone {
  private stream?: MediaStream;
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private node?: AudioWorkletNode | ScriptProcessorNode;
  private silence?: GainNode;
  private detector?: VoiceActivity;
  private monitor?: ReturnType<typeof setInterval>;
  private closed = false;
  private frames = 0;
  private lastVoice = 0;
  private lastMeter = 0;
  private level = 0;
  private speaking = false;
  private fallback = false;
  private label = '';
  private waves = new WeakMap<Float32Array, Blob>();
  private wave(samples: Float32Array) {
    let blob = this.waves.get(samples);
    if (!blob) { blob = pcmWave(samples, this.context!.sampleRate); this.waves.set(samples, blob); }
    return blob;
  }
  paused = false;
  constructor(private onTurn: (blob: Blob) => void, private onEnded: () => void, private options: Options = {}) {}
  private signal(warning = '') { this.options.onSignal?.({ level: this.paused ? 0 : this.level, receiving: this.frames > 0, label: this.label, warning, speaking: !this.paused && this.speaking, ending: !this.paused && !!this.detector?.ending }); }
  private feed = (data: Float32Array) => {
    if (this.closed || this.paused) return;
    const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    this.frames++; this.level = Math.min(1, rms * 40); this.speaking = rms >= VOICE_RMS_THRESHOLD;
    const now = performance.now();
    if (this.speaking) this.lastVoice = now;
    this.detector?.feed(new Float32Array(data));
    if (now - this.lastMeter >= 100 || this.frames === 1) { this.lastMeter = now; this.signal(); }
  };
  private compatibilityCapture() {
    if (this.closed || !this.context || !this.source || !this.silence) return;
    this.source.disconnect(); this.node?.disconnect(); this.fallback = true;
    const node = this.context.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = event => this.feed(event.inputBuffer.getChannelData(0)); this.node = node;
    this.source.connect(node).connect(this.silence);
  }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error('Voice requires a supported browser on HTTPS or localhost. Typed help is available.');
    // Resume in the actual click, before awaiting the microphone permission dialog.
    this.context = new AudioContext();
    const resumed = this.context.resume(); resumed.catch(() => {});
    const capture = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, ...(this.options.deviceId ? { deviceId: { exact: this.options.deviceId } } : {}) }, video: false });
    void capture.then(stream => { if (this.closed) stream.getTracks().forEach(track => track.stop()); }, () => {});
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      this.stream = await Promise.race([capture, new Promise<MediaStream>((_resolve, reject) => { deadline = setTimeout(() => reject(new Error('Microphone permission did not finish. Check the browser permission prompt and Windows microphone access, then try again.')), 30000); })]);
    } finally { clearTimeout(deadline); }
    if (this.closed) { this.stream.getTracks().forEach(track => track.stop()); return; }
    try { await Promise.race([resumed, new Promise<void>((_resolve, reject) => { deadline = setTimeout(() => reject(new Error('The browser paused audio capture. Click the mic again to resume it.')), 5000); })]); }
    finally { clearTimeout(deadline); }
    const track = this.stream.getAudioTracks()[0]; this.label = track?.label || 'System microphone'; this.lastVoice = performance.now();
    this.detector = new VoiceActivity(this.context.sampleRate,
      samples => { this.pause(true); this.onTurn(this.wave(samples)); },
      samples => this.options.onPreview?.(this.wave(samples)), this.options.silenceMs);
    this.source = this.context.createMediaStreamSource(this.stream);
    this.silence = this.context.createGain(); this.silence.gain.value = 0; this.silence.connect(this.context.destination);
    try {
      if (!this.context.audioWorklet || !window.AudioWorkletNode) throw new Error('AudioWorklet unavailable');
      const moduleUrl = URL.createObjectURL(new Blob([processor], { type: 'text/javascript' }));
      let moduleDeadline: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([this.context.audioWorklet.addModule(moduleUrl), new Promise<void>((_resolve, reject) => {
          moduleDeadline = setTimeout(() => reject(new Error('AudioWorklet startup timed out')), 5000);
        })]);
      } finally { clearTimeout(moduleDeadline); URL.revokeObjectURL(moduleUrl); }
      if (this.closed) return;
      const node = new AudioWorkletNode(this.context, 'eflow-voice'); this.node = node;
      node.onprocessorerror = () => { if (!this.closed) this.onEnded(); };
      node.port.onmessage = event => this.feed(event.data); this.source.connect(node).connect(this.silence);
    } catch (cause) {
      if (this.closed) return;
      if (!this.context.createScriptProcessor) throw cause;
      this.compatibilityCapture();
    }
    this.stream.getAudioTracks().forEach(input => input.addEventListener('ended', this.onEnded, { once: true }));
    this.signal();
    const started = performance.now();
    this.monitor = setInterval(() => {
      if (this.closed || this.paused) return;
      if (!this.frames && performance.now() - started > 3000 && !this.fallback && this.context?.createScriptProcessor) this.compatibilityCapture();
      this.signal(this.context?.state === 'suspended' ? 'The browser paused audio capture. Stop and restart the mic.' : !this.frames && performance.now() - started > 5000 ? 'No audio frames are arriving. Choose a different microphone or check browser microphone access.' : performance.now() - this.lastVoice > 6000 ? 'No audible input detected. Check that this microphone is not muted, or choose another input.' : '');
    }, 1000);
  }
  pause(value: boolean) { this.paused = value; this.level = 0; this.speaking = false; if (!value) this.lastVoice = performance.now(); this.detector?.reset(); this.signal(); }
  finish() { if (!this.closed && !this.paused) this.detector?.finish(); }
  stop() {
    this.closed = true; this.detector?.reset(); clearInterval(this.monitor);
    this.source?.disconnect(); this.node?.disconnect(); this.silence?.disconnect();
    this.stream?.getTracks().forEach(track => { track.removeEventListener('ended', this.onEnded); track.stop(); });
    if (this.context?.state !== 'closed') void this.context?.close();
  }
}
