// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { StatusDefinition } from '../../src/app/features/work-status';

let definitionsState: StatusDefinition[] = [];
const saveSpy = vi.fn<(next: StatusDefinition) => Promise<void>>();

vi.mock('../../src/app/features/work-status', async () => {
  const actual = await vi.importActual<typeof import('../../src/app/features/work-status')>(
    '../../src/app/features/work-status',
  );
  return {
    ...actual,
    useWorkStatuses: () => {
      const [defs, setDefs] = useState<StatusDefinition[]>(definitionsState);
      return {
        definitions: defs,
        ready: true,
        error: '',
        save: async (next: StatusDefinition) => {
          await saveSpy(next);
          definitionsState = [...definitionsState.filter(item => item.id !== next.id), next];
          setDefs(definitionsState);
        },
      };
    },
  };
});

import { StatusMaintenance } from '../../src/app/features/administration/configuration/StatusMaintenance';

afterEach(() => {
  cleanup();
  definitionsState = [];
  saveSpy.mockReset();
});

describe('StatusMaintenance edit dialog and restore default', () => {
  it('opens editing in a modal dialog when Edit is clicked and cancels cleanly', () => {
    render(<StatusMaintenance embedded />);

    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Unassigned' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Status name')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /Back to default/i })).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  }, 15_000);

  it('restores a customized built-in status back to default inside the dialog', async () => {
    definitionsState = [
      { id: 'todo', label: 'To Do jjj', color: '#6a1212', position: 20, scope: 'builtin', retired: false },
    ];
    saveSpy.mockResolvedValue(undefined);

    render(<StatusMaintenance embedded />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit To Do jjj' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Built-in · To Do')).toBeTruthy();
    expect((within(dialog).getByLabelText('Status name') as HTMLInputElement).value).toBe('To Do jjj');

    const restoreButton = within(dialog).getByRole('button', { name: /Back to default/i });
    fireEvent.click(restoreButton);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith({
        id: 'todo',
        label: 'To Do',
        color: null,
        position: 20,
        scope: 'builtin',
        retired: false,
      });
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Edit To Do' })).toBeTruthy();
    expect(screen.getByText('Restored “To Do” to default.')).toBeTruthy();
  }, 15_000);

  it('shows Back to default after editing and saving a status', async () => {
    saveSpy.mockResolvedValue(undefined);

    render(<StatusMaintenance embedded />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit To Do' }));
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Status name'), { target: { value: 'Queued' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save status' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Edit Queued' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Queued' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Back to default/i })).toBeTruthy();
  });
});
