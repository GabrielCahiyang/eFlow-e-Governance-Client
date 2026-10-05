// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineCreateRow } from '../../src/app/features/project-table/components/InlineCreateRow';

afterEach(cleanup);
const show = (onCreate = vi.fn().mockResolvedValue(undefined), onCreated?: () => Promise<void>) => {
  render(<><InlineCreateRow label="Add task" itemName="task" maxLength={300} onCreate={onCreate} onCreated={onCreated} /><button>Outside</button></>);
  const input = screen.getByRole('textbox', { name: 'Add task' }) as HTMLInputElement;
  input.focus();
  return { input, onCreate, outside: screen.getByRole('button', { name: 'Outside' }) };
};

describe('inline task and subitem creation', () => {
  it('has no Add button and ignores empty and whitespace-only drafts on blur', () => {
    const { input, onCreate, outside } = show();
    expect(screen.queryByRole('button', { name: 'Add', exact: true })).toBeNull();
    fireEvent.blur(input, { relatedTarget: outside });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input, { relatedTarget: outside });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('trims and saves on blur once despite simultaneous Enter, blur and submit events', async () => {
    let finish!: () => void;
    const create = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { input, outside } = show(create);
    fireEvent.change(input, { target: { value: '  Prepare agenda  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input, { relatedTarget: outside });
    fireEvent.submit(input.closest('form')!);
    expect(create).toHaveBeenCalledExactlyOnceWith('Prepare agenda');
    expect(input.readOnly).toBe(true);
    await act(async () => { finish(); });
    expect(input.value).toBe('');
    fireEvent.blur(input, { relatedTarget: outside });
    expect(create).toHaveBeenCalledOnce();
  });

  it('keeps the input focused after Shift+Enter for consecutive additions', async () => {
    const { input, onCreate } = show();
    fireEvent.change(input, { target: { value: 'First task' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    await waitFor(() => expect(input.value).toBe(''));
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Second task' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
    expect(onCreate).toHaveBeenLastCalledWith('Second task');
    expect(document.activeElement).toBe(input);
  });

  it('does not take focus back if the user leaves during a Shift+Enter save', async () => {
    let finish!: () => void;
    const create = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { input, outside } = show(create);
    fireEvent.change(input, { target: { value: 'Task' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    outside.focus();
    await act(async () => { finish(); });
    expect(document.activeElement).toBe(outside);
    expect(create).toHaveBeenCalledOnce();
  });

  it('saves on Enter and exits the input', async () => {
    const { input, onCreate } = show();
    fireEvent.change(input, { target: { value: 'Task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input.value).toBe(''));
    expect(document.activeElement).not.toBe(input);
    expect(onCreate).toHaveBeenCalledExactlyOnceWith('Task');
  });

  it('retains a failed draft and retries when focus leaves again', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('Save denied')).mockResolvedValue(undefined);
    const { input, outside } = show(create);
    fireEvent.change(input, { target: { value: 'Draft' } });
    fireEvent.blur(input, { relatedTarget: outside });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Save denied');
    expect(input.value).toBe('Draft');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.blur(input, { relatedTarget: outside });
    await waitFor(() => expect(input.value).toBe(''));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('clears a committed draft even if refreshing the list fails', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('Connection lost'));
    const { input, onCreate, outside } = show(undefined, refresh);
    fireEvent.change(input, { target: { value: 'Committed task' } });
    fireEvent.blur(input, { relatedTarget: outside });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Added, but could not refresh: Connection lost');
    expect(input.value).toBe('');
    fireEvent.blur(input, { relatedTarget: outside });
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('cancels an unsaved draft with Escape without creating a task', () => {
    const { input, onCreate } = show();
    fireEvent.change(input, { target: { value: 'Cancelled draft' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(onCreate).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
  });

  it('does not submit Enter used to confirm IME text', () => {
    const { input, onCreate } = show();
    fireEvent.change(input, { target: { value: '案' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onCreate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });
});
