// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { LIVE_TURN_SILENCE_MS, VoiceActivity, pcmWave } from '../../src/app/features/help-assistant/services/voiceActivity';

describe('hands-free speech turns', () => {
  it('ends Live locally at two seconds of silence while preview recognition is unresolved', () => {
    const turn = vi.fn(), preview = vi.fn(() => new Promise(() => {}));
    const detector = new VoiceActivity(1000, turn, preview, LIVE_TURN_SILENCE_MS);
    for (let i = 0; i < 5; i++) detector.feed(new Float32Array(100).fill(.004));
    for (let i = 0; i < 19; i++) detector.feed(new Float32Array(100));
    expect(preview).toHaveBeenCalledOnce();
    expect(detector.ending).toBe(true);
    expect(turn).not.toHaveBeenCalled();
    detector.feed(new Float32Array(100));
    expect(turn).toHaveBeenCalledOnce();
    expect(turn.mock.calls[0][0]).toBe(preview.mock.calls[0][0]);
    expect(turn.mock.calls[0][0]).toHaveLength(500);
    expect(detector.ending).toBe(false);
  });
  it('restarts Live silence detection if speech resumes before two seconds', () => {
    const turn = vi.fn(), detector = new VoiceActivity(1000, turn, undefined, LIVE_TURN_SILENCE_MS);
    const voice = new Float32Array(100).fill(.004), quiet = new Float32Array(100);
    for (let i = 0; i < 5; i++) detector.feed(voice);
    for (let i = 0; i < 19; i++) detector.feed(quiet);
    detector.feed(voice);
    expect(detector.ending).toBe(false);
    for (let i = 0; i < 19; i++) detector.feed(quiet);
    expect(turn).not.toHaveBeenCalled();
    detector.feed(quiet);
    expect(turn).toHaveBeenCalledOnce();
  });
  it('starts endpoint recognition during silence and shares its exact audio with the final turn', () => {
    const turn = vi.fn(), preview = vi.fn(), detector = new VoiceActivity(1000, turn, preview);
    for (let i = 0; i < 7; i++) detector.feed(new Float32Array(100).fill(.05));
    for (let i = 0; i < 3; i++) detector.feed(new Float32Array(100));
    expect(preview).toHaveBeenCalledOnce(); expect(turn).not.toHaveBeenCalled();
    for (let i = 0; i < 6; i++) detector.feed(new Float32Array(100));
    expect(turn).toHaveBeenCalledOnce();
    expect(turn.mock.calls[0][0]).toBe(preview.mock.calls[0][0]);
    expect(turn.mock.calls[0][0]).toHaveLength(700);
  });
  it('replaces the endpoint preview if the speaker continues after a short pause', () => {
    const turn = vi.fn(), preview = vi.fn(), detector = new VoiceActivity(1000, turn, preview);
    for (let i = 0; i < 6; i++) detector.feed(new Float32Array(100).fill(.05));
    for (let i = 0; i < 3; i++) detector.feed(new Float32Array(100));
    detector.feed(new Float32Array(100).fill(.05));
    for (let i = 0; i < 9; i++) detector.feed(new Float32Array(100));
    expect(preview).toHaveBeenCalledTimes(2);
    expect(turn.mock.calls[0][0]).toBe(preview.mock.calls[1][0]);
    expect(turn.mock.calls[0][0]).not.toBe(preview.mock.calls[0][0]);
  });
  it('ignores silence and short clicks, then sends a spoken turn after a pause', () => {
    const turn = vi.fn(), detector = new VoiceActivity(1000, turn);
    const quiet = new Float32Array(100), voice = new Float32Array(100).fill(.1);
    for (let index = 0; index < 20; index++) detector.feed(quiet);
    detector.feed(voice);
    for (let index = 0; index < 10; index++) detector.feed(quiet);
    expect(turn).not.toHaveBeenCalled();
    for (let index = 0; index < 4; index++) detector.feed(voice);
    for (let index = 0; index < 8; index++) detector.feed(quiet);
    expect(turn).not.toHaveBeenCalled();
    detector.feed(quiet);
    expect(turn).toHaveBeenCalledOnce();
    for (let index = 0; index < 30; index++) detector.feed(quiet);
    expect(turn).toHaveBeenCalledOnce();
  });
  it('bounds long turns and drops buffered audio when paused or stopped', () => {
    const turn = vi.fn(), detector = new VoiceActivity(1000, turn), frame = new Float32Array(100).fill(.1);
    for (let index = 0; index < 201; index++) detector.feed(frame);
    expect(turn).toHaveBeenCalledOnce();
    expect(turn.mock.calls[0][0].length).toBeLessThanOrEqual(20_000);
    detector.reset();
    for (let index = 0; index < 20; index++) detector.feed(new Float32Array(100));
    expect(turn).toHaveBeenCalledOnce();
  });
  it('lets the user finish dictation without waiting for silence and emits once', () => {
    const turn = vi.fn(), detector = new VoiceActivity(1000, turn);
    for (let index = 0; index < 4; index++) detector.feed(new Float32Array(100).fill(.1));
    detector.finish(); detector.finish();
    expect(turn).toHaveBeenCalledOnce();
    expect(turn.mock.calls[0][0].length).toBe(400);
  });
  it('encodes actual mono 16 kHz PCM with bounded sample values', async () => {
    const blob = pcmWave(new Float32Array(4800).fill(2), 48000);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
    const wav = new DataView(buffer);
    expect(wav.getUint16(22, true)).toBe(1);
    expect(wav.getUint32(24, true)).toBe(16000);
    expect(wav.getUint32(40, true)).toBe(3200);
    expect(wav.getInt16(44, true)).toBe(32767);
    expect(blob.type).toBe('audio/wav');
  });
  it('previews quiet speech before a pause and finishes the same turn once', () => {
    const turn = vi.fn(), preview = vi.fn(), detector = new VoiceActivity(1000, turn, preview);
    for (let index = 0; index < 22; index++) detector.feed(new Float32Array(100).fill(.004));
    expect(preview).toHaveBeenCalledOnce();
    expect(turn).not.toHaveBeenCalled();
    detector.finish();
    expect(turn).toHaveBeenCalledOnce();
    expect(turn.mock.calls[0][0]).toHaveLength(2200);
  });
});
