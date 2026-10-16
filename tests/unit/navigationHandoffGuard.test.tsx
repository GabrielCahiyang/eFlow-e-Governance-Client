// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installNavigationConfirmation, useNavigationBlocker } from '../../src/app/shared/navigationGuard';
import { useRoleNavigationState } from '../../src/app/features/navigation';

vi.mock('../../src/app/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor' }, userProfile: { role: 'member' }, can: () => true }) }));
vi.mock('../../src/app/features/personal-work/hooks/useWorkFeed', () => ({ useWorkFeed: () => ({ data: { rows: [], issues: [], workspaces: [], unavailable: [] }, loading: false, refresh: vi.fn() }) }));
vi.mock('../../src/app/features/personal-work/components/WorkInspector', () => ({ WorkInspector: () => null, useWorkInspector: () => ({ selection: null, close: vi.fn() }) }));
vi.mock('../../src/app/features/permissions', () => ({ RoleDefaultsTab: () => null, UserAccessTab: ({ selectedUserId }: { selectedUserId: string }) => <p>Selected account {selectedUserId}</p> }));
vi.mock('../../src/app/features/administration/components/user-management/UsersTab', () => ({ UsersTab: ({ onOpenAccess }: { onOpenAccess: (id: string) => void }) => <button onClick={() => onOpenAccess('account-1')}>Open synthetic account</button> }));
vi.mock('../../src/app/features/administration/components/user-management/LockedAccountsTab', () => ({ LockedAccountsTab: () => null }));
vi.mock('../../src/app/components/ui/workspace', () => ({
  WorkspaceHeader: ({ title, actions }: any) => <header><h1>{title}</h1>{actions}</header>,
  ActionMenu: ({ actions }: any) => <div>{actions.map((action: any) => <button key={action.id} onClick={action.onSelect}>{action.label}</button>)}</div>,
  WorkspacePopover: ({ trigger }: any) => trigger,
}));
import { PersonalWorkWorkspace } from '../../src/app/features/personal-work/components/PersonalWorkWorkspace';
import { UserManagement } from '../../src/app/features/administration/components/user-management/UserManagement';
let uninstall: (() => void) | undefined;
afterEach(() => { cleanup(); uninstall?.(); window.history.replaceState({}, '', '/'); });
function Draft({ pending = false }: { pending?: boolean }) {
  useNavigationBlocker({ dirty: true, pending, label: 'Existing draft', onDiscard: vi.fn() });
  return null;
}
function WorkHost({ pending = false }: { pending?: boolean }) {
  const route = useRoleNavigationState('member', () => 'Assigned work');
  return <><Draft pending={pending} /><PersonalWorkWorkspace onNavigate={(section, page) => void route.selectPageAsync(section, page)} /></>;
}

describe('P1 record and retained-tool handoffs', () => {
  it('accepts a dirty My Work handoff through one guard and preserves canceled navigation', async () => {
    window.history.replaceState({}, '', '/my-work?page=Assigned+work');
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    uninstall = installNavigationConfirmation(confirm);
    render(<WorkHost />);
    fireEvent.click(screen.getByText('More work tools'));
    fireEvent.click(screen.getByRole('button', { name: 'Deadline calendar' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe('/my-work');
    fireEvent.click(screen.getByRole('button', { name: 'Deadline calendar' }));
    await waitFor(() => expect(window.location.pathname).toBe('/deadlines'));
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it('blocks a pending My Work handoff without asking to discard', async () => {
    window.history.replaceState({}, '', '/my-work?page=Assigned+work');
    const confirm = vi.fn().mockResolvedValue(true); uninstall = installNavigationConfirmation(confirm);
    render(<WorkHost pending />); fireEvent.click(screen.getByText('More work tools')); fireEvent.click(screen.getByRole('button', { name: 'Deadline calendar' }));
    await Promise.resolve(); expect(window.location.pathname).toBe('/my-work'); expect(confirm).not.toHaveBeenCalled();
  });
  it('does not change account selection or URL until the dirty handoff is accepted', async () => {
    window.history.replaceState({}, '', '/users?page=All+Users');
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true); uninstall = installNavigationConfirmation(confirm);
    render(<><Draft /><UserManagement /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Open synthetic account' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(new URLSearchParams(window.location.search).get('page')).toBe('All Users');
    expect(screen.queryByText('Selected account account-1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open synthetic account' }));
    await waitFor(() => expect(screen.getByText('Selected account account-1')).toBeTruthy());
    expect(new URLSearchParams(window.location.search).get('page')).toBe('User Access');
  });
});
