// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandsFreeMicrophone } from '../../src/app/features/help-assistant/services/handsFreeMicrophone';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('actual capture startup and silent-worklet recovery', () => {
  it('reports a pending permission deadline and releases a late microphone grant', async () => {
    vi.useFakeTimers();
    let grant!: (stream: MediaStream) => void;
    const stop = vi.fn(), contextClosed = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => new Promise(resolve => { grant = resolve; }) } });
    vi.stubGlobal('AudioContext', class { state = 'running'; async resume() {} async close() { contextClosed(); } });
    const mic = new HandsFreeMicrophone(vi.fn(), vi.fn());
    const pending = expect(mic.start()).rejects.toThrow('Microphone permission did not finish');
    await vi.advanceTimersByTimeAsync(30001); await pending;
    mic.stop();
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await Promise.resolve();
    expect(stop).toHaveBeenCalled(); expect(contextClosed).toHaveBeenCalled();
  });
  it.each([false, true])('recovers missing frames or stalled module startup (module pending: %s) and reports quiet input', async stalledModule => {
    vi.useFakeTimers();
    const connection = { connect() { return this; }, disconnect: vi.fn() };
    const script = { ...connection, onaudioprocess: null as null | ((event: { inputBuffer: { getChannelData: () => Float32Array } }) => void) };
    const createScriptProcessor = vi.fn(() => script), onSignal = vi.fn(), track = { label: 'QA quiet microphone', stop: vi.fn(), addEventListener() {}, removeEventListener() {} };
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:processor', revokeObjectURL: vi.fn() });
    vi.stubGlobal('AudioContext', class {
      state = 'running'; sampleRate = 16000; destination = {}; audioWorklet = { addModule: () => stalledModule ? new Promise<void>(() => {}) : Promise.resolve() };
      async resume() {} async close() {}
      createMediaStreamSource() { return connection; }
      createGain() { return { ...connection, gain: { value: 0 } }; }
      createScriptProcessor = createScriptProcessor;
    });
    vi.stubGlobal('AudioWorkletNode', class { port = { onmessage: null }; connect() { return connection; } disconnect() {} });
    const mic = new HandsFreeMicrophone(vi.fn(), vi.fn(), { onSignal });
    const startup = mic.start();
    if (stalledModule) await vi.advanceTimersByTimeAsync(5001);
    await startup;
    if (!stalledModule) await vi.advanceTimersByTimeAsync(4000);
    expect(createScriptProcessor).toHaveBeenCalledOnce();
    script.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(2048).fill(.00001) } });
    await vi.advanceTimersByTimeAsync(3000);
    expect(onSignal.mock.calls.at(-1)?.[0]).toMatchObject({ receiving: true, label: 'QA quiet microphone', warning: expect.stringContaining('No audible input') });
    mic.stop(); expect(track.stop).toHaveBeenCalledOnce();
  });
});
