// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHelpDictation } from '../../src/app/features/help-assistant/hooks/useHelpDictation';
const mocks = vi.hoisted(() => ({ transcribe: vi.fn(), start: vi.fn(), stop: vi.fn(), turn: null as null | ((blob: Blob) => void), preview: null as null | ((blob: Blob) => void) }));
vi.mock('../../src/app/features/help-assistant/services/helpApi', () => ({ transcribeHelp: mocks.transcribe }));
vi.mock('../../src/app/features/help-assistant/services/handsFreeMicrophone', () => ({ HandsFreeMicrophone: class {
  constructor(turn: (blob: Blob) => void, _ended: unknown, options: { onPreview: (blob: Blob) => void }) { mocks.turn = turn; mocks.preview = options.onPreview; }
  start = mocks.start; stop = mocks.stop;
  pause() {}
  finish() { mocks.turn?.(new Blob(['spoken words'])); }
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('microphone dictation into a draft', () => {
  it('returns recognized text to the draft and closes the mic without sending a chat', async () => {
    mocks.start.mockResolvedValue(undefined); mocks.transcribe.mockResolvedValue({ text: 'How do I submit evidence?' });
    const draft = vi.fn(), view = renderHook(() => useHelpDictation('user:project:chat', draft));
    await act(async () => { await view.result.current.start(); });
    expect(view.result.current.stage).toBe('recording');
    await act(async () => { await view.result.current.finish(); });
    await waitFor(() => expect(draft).toHaveBeenCalledWith('How do I submit evidence?'));
    expect(view.result.current.stage).toBe('idle');
    expect(mocks.stop).toHaveBeenCalled();
  });
  it('replaces partial text while the microphone remains recording, then commits the complete phrase', async () => {
    mocks.start.mockResolvedValue(undefined);
    mocks.transcribe.mockResolvedValueOnce({ text: 'Open the project' }).mockResolvedValueOnce({ text: 'Open the project table.' });
    const draft = vi.fn(), view = renderHook(() => useHelpDictation('user:project:chat', draft));
    await act(async () => { await view.result.current.start(); });
    act(() => mocks.preview?.(new Blob(['partial'])));
    await waitFor(() => expect(draft).toHaveBeenLastCalledWith('Open the project'));
    expect(view.result.current.stage).toBe('recording');
    expect(mocks.stop).not.toHaveBeenCalled();
    act(() => mocks.turn?.(new Blob(['complete'])));
    await waitFor(() => expect(draft).toHaveBeenLastCalledWith('Open the project table.'));
    expect(view.result.current.stage).toBe('recording');
  });
  it('discards transcription after scope changes', async () => {
    let finish!: (value: { text: string }) => void;
    mocks.start.mockResolvedValue(undefined); mocks.transcribe.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const draft = vi.fn(), view = renderHook(({ scope }) => useHelpDictation(scope, draft), { initialProps: { scope: 'one' } });
    await act(async () => { await view.result.current.start(); });
    act(() => mocks.turn?.(new Blob(['words'])));
    expect(view.result.current.stage).toBe('recording');
    expect(view.result.current.recognizing).toBe(true);
    view.rerender({ scope: 'two' });
    await act(async () => finish({ text: 'Old private question' }));
    expect(draft).not.toHaveBeenCalled();
    expect(mocks.transcribe.mock.calls[0][1].aborted).toBe(true);
  });
  it('preserves the real server failure when finishing instead of reporting an inaudible microphone', async () => {
    mocks.start.mockResolvedValue(undefined); mocks.transcribe.mockRejectedValue(new Error('The speech runtime could not start. Typed help is available.'));
    const view = renderHook(() => useHelpDictation('user:project:chat', vi.fn()));
    await act(async () => { await view.result.current.start(); });
    await act(async () => { await view.result.current.finish(); });
    expect(view.result.current.error).toContain('runtime could not start');
    expect(view.result.current.error).not.toContain('No speech was recognized');
  });
});
