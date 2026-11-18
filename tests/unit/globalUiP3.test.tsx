// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveReviewView, canOpenMembershipReview } from '../../src/app/features/reviews/reviewView';
import { ReviewKindSwitch } from '../../src/app/features/reviews/components/ReviewKindSwitch';
import { ProjectInvitationApprovalQueue } from '../../src/app/features/project-invitations/components/ProjectInvitationApprovalQueue';
import { destinationNavigationParameters } from '../../src/app/features/navigation/queryContext';

const mocks = vi.hoisted(() => ({ actor: { id: 'head-one', role: 'head' }, rpc: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));
vi.mock('../../src/app/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: mocks.actor.id }, userProfile: { role: mocks.actor.role } }) }));
vi.mock('../../src/app/features/project-invitations/components/ProjectInvitations', () => ({ ProjectInvitations: ({ project }: { project: string }) => <p>Existing invitation controls {project}</p> }));
beforeEach(() => { mocks.actor = { id: 'head-one', role: 'head' }; mocks.rpc.mockReset(); mocks.rpc.mockResolvedValue({ data: [], error: null }); });
afterEach(cleanup);

describe('P3 local review navigation', () => {
  it('retains active review views and falls back removed tabs to tasks', () => {
    for (const view of ['tasks', 'clearance', 'subtasks', 'budget']) expect(resolveReviewView(view, 'department', 'head')).toBe(view);
    for (const retired of ['workplans', 'governance', 'membership']) expect(resolveReviewView(retired, 'department', 'head')).toBe('tasks');
    expect(destinationNavigationParameters('reviews', { view: 'budget', project: 'private', token: 'secret' })).toEqual({ view: 'budget' });
    expect(resolveReviewView('membership', 'leading', 'head')).toBe('tasks');
    expect(resolveReviewView('membership', 'department', 'member')).toBe('tasks');
    expect(resolveReviewView('budget', 'department', 'member')).toBe('tasks');
    expect(resolveReviewView('budget', 'leading', 'member')).toBe('budget');
    expect(resolveReviewView('unknown', 'leading', 'member')).toBe('tasks');
    for (const role of ['head', 'member', 'admin', 'accounting_staff']) expect(canOpenMembershipReview('department', role)).toBe(false);
  });
  it('shows only Project Tasks, Ready to Complete, and Budget tabs without Work Plans, Governance & Approval, or Membership approvals', () => {
    const onChange = vi.fn(); const { rerender } = render(<ReviewKindSwitch active="tasks" onChange={onChange} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Project Tasks' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Ready to Complete' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Work Plans' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Governance & Approval' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Membership approvals' })).toBeNull();
    rerender(<ReviewKindSwitch active="budget" includeMembership includeBudget onChange={onChange} counts={{ tasks: 2, clearance: 1 }} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    fireEvent.click(screen.getByRole('tab', { name: 'Budget', exact: true }));
    expect(onChange).toHaveBeenCalledWith('budget');
    expect(screen.getByRole('tab', { name: 'Budget', exact: true }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('P3 existing Head membership queue', () => {
  it('does not read or render membership operations for an ineligible actor', () => {
    mocks.actor.role = 'member'; render(<ProjectInvitationApprovalQueue />);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(screen.queryByRole('region')).toBeNull();
  });
  it('reports empty, unavailable and retry states through the unchanged read RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Function missing' } });
    render(<ProjectInvitationApprovalQueue />);
    await screen.findByRole('alert'); expect(screen.queryByText('No membership approvals pending')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('No membership approvals pending');
    expect(mocks.rpc.mock.calls).toEqual([['r8_head_invitation_queue'], ['r8_head_invitation_queue']]);
  });
  it('keeps canonical project controls and distinguishes a missing notification target', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ project_id: 'project-one', title: 'Long project title for membership review' }], error: null });
    render(<ProjectInvitationApprovalQueue focusProjectId="project-one" />);
    await screen.findByText('Existing invitation controls project-one');
    expect(screen.getByText('Long project title for membership review').closest('details')?.open).toBe(true);
    cleanup(); render(<ProjectInvitationApprovalQueue focusProjectId="missing" />);
    await screen.findByText('Referenced membership request unavailable');
  });
  it('discards old actor results and older overlapping refreshes', async () => {
    let finishOld!: (value: unknown) => void;
    mocks.rpc.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    const { rerender } = render(<ProjectInvitationApprovalQueue />);
    mocks.actor.id = 'head-two'; rerender(<ProjectInvitationApprovalQueue />);
    await screen.findByText('No membership approvals pending');
    await act(async () => { finishOld({ data: [{ project_id: 'old', title: 'Old actor project' }], error: null }); });
    expect(screen.queryByText('Old actor project')).toBeNull();
    let finishRefresh!: (value: unknown) => void;
    mocks.rpc.mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
    fireEvent(window, new Event('focus')); fireEvent(window, new Event('focus'));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(4));
    await act(async () => { finishRefresh({ data: [{ project_id: 'stale', title: 'Stale refresh' }], error: null }); });
    expect(screen.queryByText('Stale refresh')).toBeNull();
  });
});
