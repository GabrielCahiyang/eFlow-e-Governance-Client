// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installNavigationConfirmation, requestNavigation } from '../../src/app/shared/navigationGuard';
import type { UserProfile } from '../../src/app/types';
import type { Task } from '../../src/app/features/tasks';
import type { ProjectOffice } from '../../src/app/features/project-offices';
const calls = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn(), confirm: vi.fn() }));
vi.mock('../../src/app/features/project-offices/services/projectOfficeService', () => ({ selectProjectOfficeMembers: calls.save }));
vi.mock('../../src/app/features/project-offices/services/staffingAuthority', () => ({ readStaffingAuthority: calls.read }));
vi.mock('../../src/app/components/ui/useConfirmation', () => ({ useConfirmation: () => ({ confirm: calls.confirm, dialog: null }) }));
import { OfficeMembersEditor } from '../../src/app/features/project-offices/components/OfficeMembersEditor';
const office = { id: 'participation', project_id: 'project', office_id: 'own' } as ProjectOffice;
const profiles = [{ id: 'm', org_id: 'own', full_name: 'Maria', email: 'm@example.test', role: 'member', is_active: true }, { id: 'a', org_id: 'own', full_name: 'Ana', email: 'a@example.test', role: 'accounting_staff', is_active: true }, { id: 'f', org_id: 'foreign', full_name: 'Foreign', is_active: true }, { id: 'admin', org_id: 'own', full_name: 'Admin', role: 'admin', is_active: true }] as UserProfile[];
const base = { office, profiles, members: [], tasks: [], actorId: 'head', disabledReason: '', onCancel: vi.fn(), onSaved: vi.fn() };
let uninstall: (() => void) | undefined;
beforeEach(() => { vi.clearAllMocks(); calls.confirm.mockResolvedValue(true); calls.read.mockResolvedValue([]); }); afterEach(() => { cleanup(); uninstall?.(); });
describe('Phase 14 project membership editor', () => {
 it('limits candidates to active own-Office non-Admins and guards cancellation while dirty', async () => {
  const close=vi.fn(),decision=vi.fn().mockResolvedValue(false); uninstall=installNavigationConfirmation(decision); render(<OfficeMembersEditor {...base} onCancel={close}/>);
  expect(screen.queryByText('Foreign')).toBeNull(); expect(screen.queryByText('Admin')).toBeNull(); fireEvent.click(screen.getByRole('checkbox',{name:/Maria/})); fireEvent.click(screen.getByRole('button',{name:'Cancel'})); await waitFor(()=>expect(decision).toHaveBeenCalledOnce()); expect(close).not.toHaveBeenCalled();
  decision.mockResolvedValue(true); await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Cancel'}))); expect(close).toHaveBeenCalledOnce();
 });
 it('shows unfinished-work removal blockers including archived tasks and offers a task inspector handoff', () => {
  const open=vi.fn(); render(<OfficeMembersEditor {...base} members={[{project_office_id:office.id,user_id:'m'}]} tasks={[{id:'t',title:'Unfinished field work',linkedProjectId:'project',orgId:'own',status:'in_progress',archivedAt:1,teamMemberIds:['m']} as Task]} onOpenTask={open}/>);
  fireEvent.click(screen.getByRole('checkbox',{name:/Maria/})); expect(screen.getByRole('alert').textContent).toContain('Reassign active work'); expect(screen.getByRole('button',{name:'Save project team'}).matches(':disabled')).toBe(true); expect(screen.getByRole('button',{name:'Unfinished field work'})).toBeTruthy(); expect(calls.save).not.toHaveBeenCalled();
 });
 it('retains denied selections, rechecks authority on retry and never repeats a committed write after refresh failure', async () => {
  const reload=vi.fn().mockRejectedValue(new Error('Refresh failed')); calls.save.mockRejectedValueOnce(new Error('Server denied')).mockResolvedValue(undefined); render(<OfficeMembersEditor {...base} onSaved={reload}/>);
  const person=screen.getByRole('checkbox',{name:/Maria/}); fireEvent.click(person); fireEvent.click(screen.getByRole('button',{name:'Save project team'})); await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Server denied')); expect((person as HTMLInputElement).checked).toBe(true); expect(calls.read).toHaveBeenCalledTimes(2);
  calls.read.mockRejectedValueOnce(new Error('Authority revoked')); fireEvent.click(screen.getByRole('button',{name:'Save project team'})); await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Authority revoked')); expect(calls.save).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Save project team'})); await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Project team saved')); expect(screen.queryByRole('button',{name:'Save project team'})).toBeNull(); expect(screen.getByRole('button',{name:'Retry loading'})).toBeTruthy(); expect(calls.save).toHaveBeenCalledTimes(2);
 });
 it('blocks navigation during reads and rejects stale membership instead of overwriting it', async () => {
  let finish!:(ids:string[])=>void; calls.read.mockImplementation(()=>new Promise(r=>{finish=r;})); render(<OfficeMembersEditor {...base}/>); fireEvent.click(screen.getByRole('checkbox',{name:/Maria/})); const save=screen.getByRole('button',{name:'Save project team'}); fireEvent.click(save); fireEvent.click(save); expect(calls.read).toHaveBeenCalledOnce(); expect(await requestNavigation(vi.fn())).toBe(false);
  await act(async()=>finish(['a'])); expect(screen.getByRole('alert').textContent).toContain('membership changed'); expect(calls.save).not.toHaveBeenCalled(); expect((screen.getByRole('checkbox',{name:/Maria/}) as HTMLInputElement).checked).toBe(true);
 });
 it('keeps the existing draft visible but disabled when authority changes', () => {
  const view=render(<OfficeMembersEditor {...base}/>); const person=screen.getByRole('checkbox',{name:/Maria/}); fireEvent.click(person); view.rerender(<OfficeMembersEditor {...base} disabledReason="Office is now an observer"/>); expect((person as HTMLInputElement).checked).toBe(true); expect(person.matches(':disabled')).toBe(true); expect(screen.getByRole('status').textContent).toContain('observer');
 });
});
