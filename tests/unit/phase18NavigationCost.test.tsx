// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { hasDirtyNavigation, requestNavigation, useNavigationBlocker } from '../../src/app/shared/navigationGuard';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Editor({ dirty = false, pendingCheck = () => false }: { dirty?: boolean; pendingCheck?: () => boolean }) {
  useNavigationBlocker({ label: 'Planning draft', dirty, pendingCheck, onDiscard: () => {} });
  return null;
}

describe('navigation protection for large planning tables', () => {
  it('shares unload protection while retaining a dirty editor as other rows disappear', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const rows = render(<>{Array.from({ length: 100 }, (_, i) => <Editor key={i} />)}</>);
    const draft = render(<Editor dirty />);
    expect(add.mock.calls.filter(([name]) => name === 'beforeunload')).toHaveLength(1);
    rows.unmount();
    expect(remove.mock.calls.filter(([name]) => name === 'beforeunload')).toHaveLength(0);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(hasDirtyNavigation()).toBe(true);
    draft.unmount();
    expect(remove.mock.calls.filter(([name]) => name === 'beforeunload')).toHaveLength(1);
    expect(hasDirtyNavigation()).toBe(false);
  });

  it('reads the latest draft and synchronous pending state without replacing listeners', async () => {
    let pending = false;
    const editor = render(<Editor pendingCheck={() => pending} />);
    const action = vi.fn();
    pending = true;
    expect(await requestNavigation(action)).toBe(false);
    const busy = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(busy);
    expect(busy.defaultPrevented).toBe(true);
    pending = false;
    editor.rerender(<Editor dirty />);
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    editor.rerender(<Editor />);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    expect(await requestNavigation(action)).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });
});
