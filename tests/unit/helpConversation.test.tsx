// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHelpConversation } from '../../src/app/features/help-assistant/hooks/useHelpConversation';
const mocks = vi.hoisted(() => ({ ask: vi.fn(), transcribe: vi.fn(), speak: vi.fn(), start: vi.fn(), stop: vi.fn(), pause: vi.fn(), turn: null as null | ((blob: Blob) => void), preview: null as null | ((blob: Blob) => void) }));
vi.mock('../../src/app/features/help-assistant/services/helpApi', () => ({ askHelp: mocks.ask, transcribeHelp: mocks.transcribe, speakHelpPart: async (...args: unknown[]) => ({ audio: await mocks.speak(...args), parts: 1 }) }));
vi.mock('../../src/app/features/help-assistant/services/handsFreeMicrophone', () => ({ HandsFreeMicrophone: class { constructor(turn: (blob: Blob) => void, _ended: unknown, options: { onPreview: (blob: Blob) => void }) { mocks.turn = turn; mocks.preview = options.onPreview; } start = mocks.start; stop = mocks.stop; pause = mocks.pause; } }));
const reply = { answer: 'Check the task owner and pending review.', sources: [], notice: 'AI can make mistakes.', model: 'qwen3.5:2b', grounded: true, replyId: 'reply', observedAt: 1, knowledgeVersion: '2026-10-22' };
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.start.mockReset(); vi.unstubAllGlobals(); });
describe('read-only help conversation lifecycle', () => {
  it('can pause and resume input during a preview without getting stuck or submitting that preview', async () => {
    let finish!: (value: { text: string }) => void;
    mocks.start.mockResolvedValue(undefined);
    mocks.transcribe.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.start(); });
    act(() => mocks.preview?.(new Blob(['unfinished preview'])));
    act(() => view.result.current.pause());
    expect(view.result.current.stage).toBe('idle');
    await act(async () => { await view.result.current.start(); });
    expect(view.result.current.stage).toBe('listening');
    expect(mocks.pause).toHaveBeenLastCalledWith(false);
    await act(async () => finish({ text: 'An unfinished question' }));
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(mocks.start).toHaveBeenCalledOnce();
  });
  it('pauses only input while synthesis completes and resumes without restarting capture', async () => {
    let finish!: (audio: Blob) => void;
    const played = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:reply', revokeObjectURL: vi.fn() });
    vi.stubGlobal('Audio', class { onended: null | (() => void) = null; onerror = null; src = ''; pause() {} async play() { played(); queueMicrotask(() => this.onended?.()); } });
    mocks.start.mockResolvedValue(undefined); mocks.ask.mockResolvedValue(reply);
    mocks.speak.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.start(); });
    let pending!: Promise<void>;
    act(() => { pending = view.result.current.send('How do reviews work?'); });
    await waitFor(() => expect(view.result.current.stage).toBe('preparing'));
    act(() => view.result.current.pause());
    expect(mocks.speak.mock.calls.at(-1)[1].aborted).toBe(false);
    expect(mocks.stop).not.toHaveBeenCalled();
    await act(async () => { finish(new Blob(['wav'])); await pending; });
    expect(played).toHaveBeenCalledOnce();
    expect(view.result.current.stage).toBe('idle');
    expect(view.result.current.listening).toBe(false);
    expect(mocks.pause).toHaveBeenLastCalledWith(true);
    await act(async () => { await view.result.current.start(); });
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(mocks.pause).toHaveBeenLastCalledWith(false);
    expect(view.result.current.stage).toBe('listening');
  });
  it('finishes an accepted answer when paused during thinking and keeps input paused after interrupt', async () => {
    let finish!: (value: typeof reply) => void;
    mocks.start.mockResolvedValue(undefined);
    mocks.ask.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mocks.speak.mockImplementation(() => new Promise(() => {}));
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.start(); });
    act(() => { void view.result.current.send('Who needs review?'); });
    act(() => view.result.current.pause());
    expect(mocks.ask.mock.calls.at(-1)[3].aborted).toBe(false);
    await act(async () => finish(reply));
    await waitFor(() => expect(mocks.speak).toHaveBeenCalled());
    act(() => view.result.current.interrupt());
    expect(mocks.speak.mock.calls.at(-1)[1].aborted).toBe(true);
    expect(mocks.pause).toHaveBeenLastCalledWith(true);
    expect(view.result.current.stage).toBe('idle');
  });
  it('keeps typed answers and bounded question history without requiring a microphone', async () => {
    mocks.ask.mockResolvedValue(reply);
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.send('Why is the project waiting?'); });
    expect(view.result.current.messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.speak).not.toHaveBeenCalled();
    expect(mocks.ask.mock.calls[0][1]).toBe('project');
    expect(mocks.ask.mock.calls[0][4]).toBe('chat');
    await act(async () => { await view.result.current.send('Who should follow up?'); });
    expect(mocks.ask.mock.calls[1][2]).toEqual(['Why is the project waiting?']);
  });
  it('discards a pending answer after the project or account scope changes', async () => {
    let finish!: (value: typeof reply) => void;
    mocks.ask.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = renderHook(({ scope }) => useHelpConversation(scope, 'project'), { initialProps: { scope: 'one:office' } });
    let pending!: Promise<void>;
    act(() => { pending = view.result.current.send('Who is assigned?'); });
    view.rerender({ scope: 'two:office' });
    await act(async () => { finish(reply); await pending; });
    expect(view.result.current.messages).toEqual([]);
    expect(mocks.ask.mock.calls[0][3].aborted).toBe(true);
  });
  it('handles microphone denial and still permits typed help', async () => {
    mocks.start.mockRejectedValue(new Error('Microphone permission denied'));
    mocks.ask.mockResolvedValue(reply);
    const view = renderHook(() => useHelpConversation('user:office', ''));
    await act(async () => { await view.result.current.start(); });
    expect(view.result.current.listening).toBe(false);
    expect(view.result.current.error).toContain('permission denied');
    await act(async () => { await view.result.current.send('How do reviews work?'); });
    expect(view.result.current.messages.at(-1)?.text).toBe(reply.answer);
  });
  it('automatically transcribes a completed turn and resumes listening when replies are muted', async () => {
    mocks.start.mockResolvedValue(undefined); mocks.transcribe.mockResolvedValue({ text: 'Which task is overdue?' }); mocks.ask.mockResolvedValue(reply);
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    act(() => view.result.current.toggleMute());
    await act(async () => { await view.result.current.start(); });
    act(() => mocks.turn?.(new Blob(['audio'])));
    await waitFor(() => expect(view.result.current.stage).toBe('listening'));
    expect(mocks.transcribe).toHaveBeenCalledOnce();
    expect(mocks.ask.mock.calls[0][0]).toBe('Which task is overdue?');
    expect(mocks.ask.mock.calls[0][4]).toBe('live');
    expect(mocks.speak).not.toHaveBeenCalled();
    act(() => view.result.current.stop());
    expect(mocks.stop).toHaveBeenCalled(); expect(view.result.current.listening).toBe(false);
  });
  it('plays a spoken answer after a voice turn and automatically listens again', async () => {
    const played = vi.fn(), revoked = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:spoken-reply', revokeObjectURL: revoked });
    vi.stubGlobal('Audio', class {
      onended: null | (() => void) = null;
      onerror = null;
      src = '';
      pause() {}
      async play() { played(); queueMicrotask(() => this.onended?.()); }
    });
    mocks.start.mockResolvedValue(undefined); mocks.transcribe.mockResolvedValue({ text: 'Which task needs review?' });
    mocks.ask.mockResolvedValue(reply); mocks.speak.mockResolvedValue(new Blob(['wav'], { type: 'audio/wav' }));
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.start(); });
    act(() => mocks.turn?.(new Blob(['microphone'])));
    await waitFor(() => expect(played).toHaveBeenCalledOnce());
    await waitFor(() => expect(view.result.current.stage).toBe('listening'));
    expect(mocks.speak.mock.calls[0][0]).toBe('reply');
    expect(mocks.pause).toHaveBeenLastCalledWith(false);
    expect(revoked).toHaveBeenCalledWith('blob:spoken-reply');
    act(() => view.result.current.stop());
    expect(mocks.stop).toHaveBeenCalled();
  });
  it('keeps Live listening after a failed turn rather than ending the conversation', async () => {
    mocks.start.mockResolvedValue(undefined); mocks.transcribe.mockRejectedValue(new Error('The AI server is reconnecting.'));
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.start(); });
    act(() => mocks.turn?.(new Blob(['microphone'])));
    await waitFor(() => expect(view.result.current.error).toContain('reconnecting'));
    expect(view.result.current.listening).toBe(true);
    expect(view.result.current.stage).toBe('listening');
    expect(mocks.stop).not.toHaveBeenCalled();
  });
  it('interrupts a pending reply and ignores its stale result while continuing Live', async () => {
    let finish!: (value: typeof reply) => void;
    mocks.start.mockResolvedValue(undefined);
    mocks.transcribe.mockResolvedValue({ text: 'Why is this project stalled?' });
    mocks.ask.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.start(); });
    act(() => mocks.turn?.(new Blob(['microphone'])));
    await waitFor(() => expect(view.result.current.stage).toBe('thinking'));
    act(() => view.result.current.interrupt());
    await act(async () => finish(reply));
    expect(view.result.current.listening).toBe(true);
    expect(view.result.current.stage).toBe('listening');
    expect(view.result.current.messages.filter(message => message.role === 'assistant')).toEqual([]);
    expect(mocks.ask.mock.calls.at(-1)[3].aborted).toBe(true);
  });
  it('keeps Live available when replaying a transcript answer fails', async () => {
    mocks.start.mockResolvedValue(undefined); mocks.speak.mockRejectedValue(new Error('Speech is temporarily unavailable.'));
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.start(); await view.result.current.replay(reply); });
    expect(view.result.current.error).toContain('temporarily unavailable');
    expect(view.result.current.stage).toBe('listening');
    expect(view.result.current.listening).toBe(true);
    expect(mocks.stop).not.toHaveBeenCalled();
  });
  it('interrupts spoken playback and resumes the existing Live microphone', async () => {
    const paused = vi.fn(), revoked = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:live-reply', revokeObjectURL: revoked });
    vi.stubGlobal('Audio', class {
      onended = null; onerror = null; src = '';
      pause = paused;
      async play() {}
    });
    mocks.start.mockResolvedValue(undefined); mocks.ask.mockResolvedValue(reply);
    mocks.transcribe.mockResolvedValue({ text: 'Who needs a follow-up?' });
    mocks.speak.mockResolvedValue(new Blob(['wav'], { type: 'audio/wav' }));
    const view = renderHook(() => useHelpConversation('user:office', 'project'));
    await act(async () => { await view.result.current.start(); });
    act(() => mocks.turn?.(new Blob(['microphone'])));
    await waitFor(() => expect(view.result.current.stage).toBe('speaking'));
    await act(async () => { view.result.current.interrupt(); });
    expect(paused).toHaveBeenCalled();
    expect(revoked).toHaveBeenCalledWith('blob:live-reply');
    expect(view.result.current.stage).toBe('listening');
    expect(view.result.current.listening).toBe(true);
    expect(mocks.pause).toHaveBeenLastCalledWith(false);
    expect(mocks.stop).not.toHaveBeenCalled();
  });
});
