import { transcribeHelp } from './helpApi';

type Snapshot = { turn: number; audio: Blob; final: boolean };
type Events = { onText: (text: string) => void; onFinal?: (text: string) => void; onError: (message: string, final: boolean) => void; onBusy?: (busy: boolean) => void };

/** Serialize ASR, keep only the latest preview, and never discard a final turn. */
export class ProgressiveTranscription {
  private turn = 0;
  private finals: Snapshot[] = [];
  private preview?: Snapshot;
  private committed: string[] = [];
  private controller?: AbortController;
  private activeSnapshot?: Snapshot;
  private generation = 0;
  private running = false;
  private closed = false;
  private recognized?: { turn: number; audio: Blob; text: string };
  get busy() { return this.running; }
  private idle: (() => void)[] = [];
  constructor(private events: Events, private accumulate = false) {}
  push(audio: Blob, final: boolean) {
    if (this.closed) return;
    const snapshot = { turn: this.turn, audio, final };
    if (final) {
      if (this.finals.length >= 3) { this.events.onError('Transcription cannot keep up. Stop the mic and let the current words finish.', true); return; }
      this.finals.push(snapshot); this.turn++; this.preview = undefined;
      // A final supersedes an older preview, but an identical endpoint blob
      // can reuse that preview's result. Accepted final turns are never aborted.
      if (this.activeSnapshot && !this.activeSnapshot.final &&
        (this.activeSnapshot.turn !== snapshot.turn || this.activeSnapshot.audio !== audio)) this.controller?.abort();
    } else this.preview = snapshot;
    void this.drain();
  }
  private async drain() {
    if (this.running || this.closed) return;
    const generation = this.generation;
    this.running = true; this.events.onBusy?.(true);
    try {
      while (!this.closed && generation === this.generation) {
        const snapshot = this.finals.shift() || this.preview;
        if (!snapshot) break;
        if (!snapshot.final) this.preview = undefined;
        const controller = new AbortController(); this.controller = controller;
        this.activeSnapshot = snapshot;
        try {
          const previous = this.recognized;
          const result = previous?.turn === snapshot.turn && previous.audio === snapshot.audio
            ? { text: previous.text } : await transcribeHelp(snapshot.audio, controller.signal);
          if (this.closed || generation !== this.generation) return;
          // Some transports complete despite abort. Never publish/cache stale text.
          if (controller.signal.aborted) continue;
          const text = result.text.trim();
          this.recognized = { turn: snapshot.turn, audio: snapshot.audio, text };
          if (snapshot.final) {
            if (this.accumulate && text) this.committed = [[...this.committed, text].join(' ').slice(0, 2000)];
            this.events.onText(this.accumulate ? this.committed.join(' ').slice(0, 2000) : text);
            this.events.onFinal?.(text);
          } else if (text) this.events.onText((this.accumulate ? [...this.committed, text].join(' ') : text).slice(0, 2000));
        } catch (cause) {
          if (!controller.signal.aborted && generation === this.generation && !this.closed)
            this.events.onError(cause instanceof Error ? cause.message : 'Transcription failed. Try the mic again.', snapshot.final);
        } finally {
          if (this.controller === controller) {
            this.controller = undefined; this.activeSnapshot = undefined;
          }
        }
      }
    } finally {
      if (generation === this.generation) {
        this.running = false; this.controller = undefined; this.events.onBusy?.(false);
        this.idle.splice(0).forEach(resolve => resolve());
      }
    }
  }
  async finish() { if (this.running) await new Promise<void>(resolve => this.idle.push(resolve)); }
  reset() {
    this.generation++; this.controller?.abort(); this.controller = undefined;
    this.activeSnapshot = undefined;
    this.running = false; this.finals = []; this.preview = undefined; this.committed = []; this.turn = 0; this.recognized = undefined;
    this.idle.splice(0).forEach(resolve => resolve()); this.events.onBusy?.(false);
  }
  cancel() { this.closed = true; this.reset(); }
}
