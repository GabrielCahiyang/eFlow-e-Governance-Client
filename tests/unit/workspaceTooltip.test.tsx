// @vitest-environment jsdom
import { createRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceTooltip } from '../../src/app/components/ui/workspace/WorkspaceTooltip';
import { ActionMenu } from '../../src/app/components/ui/workspace/ActionMenu';
import { WorkspacePopover } from '../../src/app/components/ui/workspace/WorkspacePopover';
import { TableColumnResizer } from '../../src/app/components/ui/workspace/TableColumnResizer';
import { FeatureDialog } from '../../src/app/components/ui/FeatureDialog';

afterEach(cleanup);
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class {
  observe() {} unobserve() {} disconnect() {}
};

describe('workspace tooltip interactions', () => {
  it('associates focus help with its trigger, preserves existing descriptions and dismisses on Escape', async () => {
    const ref = createRef<HTMLButtonElement>();
    const click = vi.fn();
    render(<><p id="existing-help">Existing guidance</p><WorkspaceTooltip content="Column options">
      <button ref={ref} type="button" aria-label="Options for Task column" aria-describedby="existing-help" onClick={click}>…</button>
    </WorkspaceTooltip></>);
    const button = screen.getByRole('button', { name: 'Options for Task column' });
    expect(ref.current).toBe(button);
    expect(button.getAttribute('aria-describedby')).toBe('existing-help');
    act(() => button.focus());
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe('Column options');
    expect(button.getAttribute('aria-describedby')?.split(' ')).toContain(tooltip.id);
    expect(button.getAttribute('aria-describedby')?.split(' ')).toContain('existing-help');
    fireEvent.keyUp(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('keeps native disabled actions disabled', async () => {
    const click = vi.fn();
    render(<WorkspaceTooltip content="Remove receipt"><button disabled type="button" aria-label="Remove receipt 1" onClick={click}>×</button></WorkspaceTooltip>);
    const button = screen.getByRole('button', { name: 'Remove receipt 1' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });

  it('dismisses the tooltip before allowing Escape to close its containing dialog', async () => {
    const close = vi.fn();
    render(<FeatureDialog title="Task details" onClose={close} showCloseButton={false}>
      <WorkspaceTooltip content="Task actions"><button type="button" aria-label="Actions for Road repair">…</button></WorkspaceTooltip>
    </FeatureDialog>);
    const button = screen.getByRole('button', { name: 'Actions for Road repair' });
    act(() => button.focus());
    await screen.findByRole('tooltip');
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyUp(button, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    await waitFor(() => expect(button.getAttribute('aria-describedby')).toBeNull());
    fireEvent.keyDown(button, { key: 'Escape' });
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it('preserves menu activation, selection and focus return while hiding its tooltip', async () => {
    const select = vi.fn();
    render(<ActionMenu tooltip="Project actions" trigger={<button type="button" aria-label="Actions for Road repair">…</button>}
      actions={[{ id: 'open', label: 'Open project', onSelect: select }]} />);
    const button = screen.getByRole('button', { name: 'Actions for Road repair' });
    act(() => button.focus());
    expect((await screen.findByRole('tooltip')).textContent).toBe('Project actions');
    fireEvent.keyDown(button, { key: 'Enter' });
    const action = await screen.findByRole('menuitem', { name: 'Open project' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    fireEvent.click(action);
    expect(select).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('preserves controlled popover callbacks and its trigger identity', async () => {
    const changed = vi.fn();
    function Fixture() {
      const [open, setOpen] = useState(false);
      return <WorkspacePopover tooltip="Choose people" open={open} onOpenChange={next => { changed(next); setOpen(next); }}
        trigger={<button type="button" aria-label="People for task">+</button>}><button type="button">Jordan Diaz</button></WorkspacePopover>;
    }
    render(<Fixture />);
    const button = screen.getByRole('button', { name: 'People for task' });
    fireEvent.click(button);
    expect(await screen.findByRole('button', { name: 'Jordan Diaz' })).toBeTruthy();
    expect(changed).toHaveBeenCalledWith(true);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Jordan Diaz' }), { key: 'Escape' });
    await waitFor(() => expect(changed).toHaveBeenCalledWith(false));
    expect(screen.getByRole('button', { name: 'People for task' })).toBe(button);
  });

  it('preserves keyboard resizing and reset while naming the handle', () => {
    const resize = vi.fn();
    render(<TableColumnResizer label="Task" width={300} defaultWidth={280} min={180} max={500} onResize={resize} />);
    const handle = screen.getByRole('separator', { name: 'Resize Task column' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(resize).toHaveBeenLastCalledWith(316);
    fireEvent.keyDown(handle, { key: 'End' });
    expect(resize).toHaveBeenLastCalledWith(500);
    fireEvent.doubleClick(handle);
    expect(resize).toHaveBeenLastCalledWith(280);
    expect(handle.getAttribute('aria-description')).toContain('Arrow keys');
  });
});
