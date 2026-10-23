import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressiveTranscription } from '../../src/app/features/help-assistant/services/progressiveTranscription';
const transcribe = vi.hoisted(() => vi.fn());
vi.mock('../../src/app/features/help-assistant/services/helpApi', () => ({ transcribeHelp: transcribe }));
afterEach(() => vi.resetAllMocks());
describe('progressive Parakeet snapshots', () => {
  it('reuses an in-flight endpoint preview when no new speech arrives', async () => {
    let finish!: (value: { text: string }) => void;
    transcribe.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const onFinal = vi.fn(), stream = new ProgressiveTranscription({ onText: vi.fn(), onFinal, onError: vi.fn() });
    const sameSpeech = new Blob(['all spoken words']);
    stream.push(sameSpeech, false); stream.push(sameSpeech, true);
    finish({ text: 'Open the project table.' }); await stream.finish();
    expect(transcribe).toHaveBeenCalledOnce();
    expect(onFinal).toHaveBeenCalledExactlyOnceWith('Open the project table.');
  });
  it('reuses a completed endpoint preview but never reuses it for another turn', async () => {
    transcribe.mockResolvedValue({ text: 'Check tasks.' });
    const onFinal = vi.fn(), stream = new ProgressiveTranscription({ onText: vi.fn(), onFinal, onError: vi.fn() }, true);
    const audio = new Blob(['words']);
    stream.push(audio, false); await stream.finish(); stream.push(audio, true); await stream.finish();
    expect(transcribe).toHaveBeenCalledOnce();
    stream.push(audio, true); await stream.finish();
    expect(transcribe).toHaveBeenCalledTimes(2);
    expect(onFinal).toHaveBeenCalledTimes(2);
  });
  it('coalesces previews, preserves final priority and replaces text without duplicate words', async () => {
    let finish!: (value: { text: string }) => void;
    transcribe.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ text: 'Open the project table.' });
    const onText = vi.fn(), onFinal = vi.fn();
    const stream = new ProgressiveTranscription({ onText, onFinal, onError: vi.fn() }, true);
    const first = new Blob(['first']), final = new Blob(['final']);
    stream.push(first, false); stream.push(new Blob(['old preview']), false); stream.push(final, true);
    finish({ text: 'Open the project' }); await stream.finish();
    expect(transcribe).toHaveBeenCalledTimes(2);
    expect(transcribe.mock.calls[1][0]).toBe(final);
    expect(onText.mock.calls.map(call => call[0])).toEqual(['Open the project', 'Open the project table.']);
    expect(onFinal).toHaveBeenCalledWith('Open the project table.');
  });
  it('joins completed dictation phrases and corrects the current preview only', async () => {
    transcribe.mockResolvedValueOnce({ text: 'First phrase.' }).mockResolvedValueOnce({ text: 'Second' }).mockResolvedValueOnce({ text: 'Second phrase.' });
    const onText = vi.fn(), stream = new ProgressiveTranscription({ onText, onError: vi.fn() }, true);
    stream.push(new Blob(['one']), true); await stream.finish();
    stream.push(new Blob(['two partial']), false); await stream.finish();
    expect(onText).toHaveBeenLastCalledWith('First phrase. Second');
    stream.push(new Blob(['two final']), true); await stream.finish();
    expect(onText).toHaveBeenLastCalledWith('First phrase. Second phrase.');
  });
  it('does not publish a result after cancellation or reset', async () => {
    let finish!: (value: { text: string }) => void;
    transcribe.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const onText = vi.fn(), stream = new ProgressiveTranscription({ onText, onError: vi.fn() });
    stream.push(new Blob(['private']), false); stream.cancel(); finish({ text: 'Old question' });
    await Promise.resolve();
    expect(onText).not.toHaveBeenCalled();
    expect(transcribe.mock.calls[0][1].aborted).toBe(true);
  });
});
