// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineCreateRow } from '../../src/app/features/project-table/components/InlineCreateRow';
import { InlineTaskRejected } from '../../src/app/features/project-table/services/workspaceService';
import { installNavigationConfirmation, requestNavigation } from '../../src/app/shared/navigationGuard';

afterEach(() => { cleanup(); sessionStorage.clear(); });
const show = (onCreate = vi.fn().mockResolvedValue(undefined), onCreated?: () => Promise<void>, details?: ReactNode, recoveryKey?: string) => {
  const view = render(<><InlineCreateRow label="Add task" itemName="task" maxLength={300} onCreate={onCreate} onCreated={onCreated} extraFields={() => details} recoveryKey={recoveryKey} /><button>Outside</button></>);
  const input = screen.getByRole('textbox', { name: 'Add task' }) as HTMLInputElement;
  input.focus();
  return { input, onCreate, outside: screen.getByRole('button', { name: 'Outside' }), unmount: view.unmount };
};

describe('inline task and subtask creation', () => {
  it.each(['task','subitem'] as const)('retains a failed %s during canceled navigation and discards only after acceptance', async itemName => {
    const create=vi.fn().mockRejectedValue(new Error('Temporary failure'));
    render(<InlineCreateRow label="Draft" itemName={itemName} maxLength={300} onCreate={create} />);
    const input=screen.getByRole('textbox',{name:'Draft'});
    fireEvent.change(input,{target:{value:'Retained draft'}}); fireEvent.keyDown(input,{key:'Enter'});
    expect((await screen.findByRole('alert')).textContent).toContain('Temporary failure');
    let accepted=false; const uninstall=installNavigationConfirmation(async()=>accepted); const navigate=vi.fn();
    await act(async()=>{expect(await requestNavigation(navigate)).toBe(false);});
    expect(input).toHaveProperty('value','Retained draft'); expect(navigate).not.toHaveBeenCalled();
    accepted=true; await act(async()=>{expect(await requestNavigation(navigate)).toBe(true);});
    expect(input).toHaveProperty('value',''); expect(navigate).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledOnce(); uninstall();
  });
  it('ignores empty titles and saves a valid draft when focus leaves', async () => {
    const { input, onCreate, outside } = show();
    fireEvent.blur(input, { relatedTarget: outside });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input, { relatedTarget: outside });
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Save this draft' } });
    outside.focus();
    await waitFor(() => expect(input.value).toBe(''));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith('Save this draft', expect.objectContaining({ verifyFirst: false }));
  });

  it('keeps internal field, dropdown, and date interactions in the draft', async () => {
    const { input, onCreate, outside } = show(undefined, undefined, <>
      <select aria-label="Priority"><option>Medium</option><option>High</option></select>
      <input type="date" aria-label="Due date" />
      <button type="button">Row control</button>
    </>);
    fireEvent.change(input, { target: { value: 'Draft with details' } });
    const priority = screen.getByRole('combobox', { name: 'Priority' });
    priority.focus(); fireEvent.click(priority); fireEvent.change(priority, { target: { value: 'High' } });
    const date = screen.getByLabelText('Due date');
    date.focus(); fireEvent.click(date); fireEvent.blur(date, { relatedTarget: null });
    fireEvent.change(date, { target: { value: '2026-12-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Row control' }));
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(outside);
    await waitFor(() => expect(input.value).toBe(''));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('trims and saves once despite simultaneous Enter, blur and submit events', async () => {
    let finish!: () => void;
    const create = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { input, outside } = show(create);
    fireEvent.change(input, { target: { value: '  Prepare agenda  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input, { relatedTarget: outside });
    fireEvent.click(outside);
    fireEvent.submit(input.closest('form')!);
    expect(create).toHaveBeenCalledExactlyOnceWith('Prepare agenda', expect.objectContaining({ verifyFirst: false }));
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
    expect(onCreate).toHaveBeenLastCalledWith('Second task', expect.objectContaining({ verifyFirst: false }));
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
    expect(onCreate).toHaveBeenCalledExactlyOnceWith('Task', expect.objectContaining({ verifyFirst: false }));
  });

  it('retains a failed draft and retries only after another explicit action', async () => {
    const create = vi.fn().mockRejectedValueOnce(new InlineTaskRejected('Save denied')).mockResolvedValue(undefined);
    const { input, outside } = show(create);
    fireEvent.change(input, { target: { value: 'Draft' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect((await screen.findByRole('alert')).textContent).toContain('Save denied');
    expect(input.value).toBe('Draft');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.blur(input, { relatedTarget: outside });
    fireEvent.click(outside);
    expect(create).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry task creation' }));
    await waitFor(() => expect(input.value).toBe(''));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('recovers an editable rejected draft after the row is reopened', async () => {
    const create = vi.fn().mockRejectedValueOnce(new InlineTaskRejected('Save denied'));
    const key = 'inline-task-rejected';
    const first = show(create, undefined, undefined, key);
    fireEvent.change(first.input, { target: { value: 'Retained task' } });
    fireEvent.click(first.outside);
    await screen.findByRole('alert');
    first.unmount();

    const { input } = show(create, undefined, undefined, key);
    expect(input.value).toBe('Retained task');
    expect(input.readOnly).toBe(false);
    expect(screen.getByRole('alert').textContent).toContain('Save denied');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(create).toHaveBeenCalledOnce();
  });

  it('retains an uncertain request and verifies the same key after remounting', async () => {
    const create = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue(undefined);
    const key = 'inline-task-test';
    const first = show(create, undefined, undefined, key);
    fireEvent.change(first.input, { target: { value: 'Unconfirmed task' } });
    fireEvent.click(first.outside);
    await screen.findByRole('alert');
    const { id } = create.mock.calls[0][1];
    expect(first.input.readOnly).toBe(true);
    first.unmount();

    const { input, outside } = show(create, undefined, undefined, key);
    expect(input.value).toBe('Unconfirmed task');
    fireEvent.click(outside);
    expect(create).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry task creation' }));
    await waitFor(() => expect(input.value).toBe(''));
    expect(create).toHaveBeenLastCalledWith('Unconfirmed task', { id, verifyFirst: true });
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('clears a committed draft even if refreshing the list fails', async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue(undefined);
    const { input, onCreate, outside } = show(undefined, refresh);
    fireEvent.change(input, { target: { value: 'Committed task' } });
    fireEvent.click(outside);
    expect((await screen.findByRole('alert')).textContent).toContain('Added, but could not refresh: Connection lost');
    expect(input.value).toBe('');
    fireEvent.blur(input, { relatedTarget: outside });
    expect(onCreate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Retry refresh' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(refresh).toHaveBeenCalledTimes(2);
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
