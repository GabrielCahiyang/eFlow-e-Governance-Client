import { afterEach, describe, expect, it, vi } from 'vitest';
import { speechChunks } from '../../src/app/features/help-assistant/services/speechChunks';
const speak = vi.hoisted(() => vi.fn());
vi.mock('../../src/app/features/help-assistant/services/helpApi', () => ({ speakHelpPart: speak }));
afterEach(() => vi.resetAllMocks());
describe('prefetched speech playback', () => {
  it('delivers the first audio without waiting for the second and prefetches while it plays', async () => {
    const audio = new Blob(['one']); let finish!: (value: unknown) => void;
    speak.mockResolvedValueOnce({ audio, parts: 2 }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const chunks = speechChunks('reply', new AbortController().signal);
    expect((await chunks.next()).value).toBe(audio);
    expect(speak.mock.calls.map(call => call[2])).toEqual([0, 1]);
    const second = new Blob(['two']); finish({ audio: second, parts: 2 });
    expect((await chunks.next()).value).toBe(second);
    expect((await chunks.next()).done).toBe(true);
  });
  it('aborts prefetched work on interrupt or early completion without an unhandled rejection', async () => {
    speak.mockResolvedValueOnce({ audio: new Blob(['one']), parts: 2 }).mockRejectedValueOnce(new Error('Cancelled'));
    const chunks = speechChunks('reply', new AbortController().signal);
    await chunks.next(); await chunks.return();
    expect(speak.mock.calls[1][1].aborted).toBe(true);
  });
});
