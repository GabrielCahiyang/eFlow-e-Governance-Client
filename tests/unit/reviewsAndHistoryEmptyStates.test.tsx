// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  role: 'head' as 'head' | 'member',
  scope: 'all',
  queryTasks: vi.fn(),
  reviewDrafts: vi.fn(),
  subtaskReviews: vi.fn(),
  myTasks: vi.fn(),
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'actor-1' },
    userProfile: { id: 'actor-1', role: mocks.role, org_id: 'org-1', departmentId: 'org-1' },
    can: () => true,
  }),
}));

vi.mock('../../src/app/features/personal-work/hooks/useWorkFeed', () => ({
  useWorkFeed: () => ({
    data: { rows: [], issues: [], workspaces: [], unavailable: [] },
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../src/app/features/personal-work/components/WorkInspector', () => ({
  WorkInspector: () => null,
  useWorkInspector: () => ({ selection: null, open: vi.fn(), close: vi.fn() }),
}));

vi.mock('../../src/app/features/personal-work/services/assignedSubtaskReviews', () => ({
  fetchAssignedSubtaskReviews: mocks.subtaskReviews,
}));

vi.mock('../../src/app/features/notifications', () => ({
  fetchNotificationSubitem: vi.fn(),
  queueNotificationNavigationIntent: vi.fn(),
  useNotificationNavigationIntent: vi.fn(),
}));

vi.mock('../../src/app/shared/workChanges', () => ({
  subscribeWorkChanges: () => () => {},
}));

vi.mock('../../src/app/features/subtasks', () => ({
  SubtaskWorkDrawer: () => null,
}));

vi.mock('../../src/app/features/members/components/core-work/useMyTasks', () => ({
  useMyTasks: mocks.myTasks,
}));

vi.mock('../../src/app/features/task-inspector', () => ({
  TaskDetailDrawer: () => null,
}));

vi.mock('../../src/app/hooks/useFirebaseData', () => ({
  useTasks: mocks.queryTasks,
}));

vi.mock('../../src/app/hooks/useSupabaseData', () => ({
  useProjectsData: () => ({ projects: [], loading: false }),
  useScopedOrgIds: () => ({ includeAllAccessibleWork: false }),
  useOrgs: () => ({ orgs: [{ id: 'org-1', name: 'Operations' }] }),
}));

vi.mock('../../src/app/features/interdepartment-collaboration', () => ({
  useCollaborationDrafts: mocks.reviewDrafts,
  isActiveCollaborationDraft: () => true,
}));

vi.mock('../../src/app/features/reviews/services/reviewService', () => ({
  fetchDecidedSubmissionIds: vi.fn().mockResolvedValue(new Set<string>()),
}));

vi.mock('../../src/app/features/budget', () => ({
  BudgetReviewInbox: () => <div>Budget reviews</div>,
}));

vi.mock('../../src/app/features/project-invitations', () => ({
  ProjectInvitationApprovalQueue: () => <div>Membership approvals</div>,
}));

import { PersonalWorkWorkspace } from '../../src/app/features/personal-work/components/PersonalWorkWorkspace';
import { AssignedSubtaskReviews } from '../../src/app/features/personal-work/components/AssignedSubtaskReviews';
import { EmployeeTaskHistory } from '../../src/app/features/members/components/core-work/EmployeeTaskHistory';
import { ForReviewInbox } from '../../src/app/features/reviews/components/ForReviewInbox';
import { WorkPlanReviewInbox } from '../../src/app/features/reviews/components/WorkPlanReviewInbox';
import { GovernanceReviewInbox } from '../../src/app/features/reviews/components/GovernanceReviewInbox';
import { getSidebarContent } from '../../src/app/features/navigation/sidebarContent';

beforeEach(() => {
  mocks.role = 'head';
  mocks.subtaskReviews.mockResolvedValue([]);
  mocks.myTasks.mockReturnValue({ mine: [], loading: false });
  mocks.queryTasks.mockReturnValue({ tasks: [], loading: false });
  mocks.reviewDrafts.mockReturnValue({ drafts: [], membershipOrgIds: [], loading: false });
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('Reviews and History menu-aligned empty states', () => {
  it('shows history-specific empty states on My Work -> History instead of active task copy', () => {
    render(<PersonalWorkWorkspace page="History" />);
    expect(screen.getByText('No work history yet')).toBeVisible();
    expect(
      screen.getByText('Completed, cancelled, and archived work records across your workspaces will appear here.'),
    ).toBeVisible();
    expect(screen.queryByText(/Assigned tasks and subitems will appear here/i)).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search personal work' }), {
      target: { value: 'missing-record' },
    });
    expect(screen.getByText('No matching work history')).toBeVisible();
  });

  it('aligns Leading and Subtasks empty states in My Work with their menu destinations', () => {
    const view = render(<PersonalWorkWorkspace page="Leading" />);
    expect(screen.getByText('No led work yet')).toBeVisible();
    expect(
      screen.getByText('Tasks and subtasks you lead or supervise across your workspaces will appear here.'),
    ).toBeVisible();

    view.rerender(<PersonalWorkWorkspace page="Subtasks" />);
    expect(screen.getByText('No assigned subtasks yet')).toBeVisible();
    expect(
      screen.getByText('Subtask steps assigned to you across projects and tasks will appear here.'),
    ).toBeVisible();
  });

  it('aligns My Work -> Reviews empty state description to review decisions awaiting action', async () => {
    render(<AssignedSubtaskReviews actor="actor-1" />);
    expect(await screen.findByText('No reviews waiting')).toBeVisible();
    expect(screen.getByText(/Subtask completion submissions and progress check-ins awaiting your decision/i)).toBeVisible();
  });

  it('replaces generic "history bucket" copy on Task History across all four history tabs', () => {
    render(<EmployeeTaskHistory />);
    expect(screen.getByText('No completed tasks yet')).toBeVisible();
    expect(screen.queryByText(/history bucket/i)).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /Needs changes/ }));
    expect(screen.getByText('No tasks needing changes')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: /Reopened/ }));
    expect(screen.getByText('No reopened tasks')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: /Archived/ }));
    expect(screen.getByText('No archived tasks')).toBeVisible();
  });

  it('aligns For Review / Leader Reviews Project Tasks empty state instead of saying "Inbox zero" and removes retired tabs', () => {
    window.history.replaceState({}, '', '/reviews?view=tasks');
    const dept = render(<ForReviewInbox scope="department" />);
    expect(screen.getByText('No task submissions awaiting review')).toBeVisible();
    expect(screen.queryByText('Inbox zero')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Project Tasks' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Ready to Complete' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Budget' })).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Work Plans' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Governance & Approval' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Membership approvals' })).toBeNull();
    dept.unmount();

    mocks.role = 'member';
    window.history.replaceState({}, '', '/reviews?view=tasks');
    render(<ForReviewInbox scope="leading" />);
    expect(screen.getByText('No task reviews waiting')).toBeVisible();
    expect(screen.queryByText('Inbox zero')).toBeNull();
  });

  it('distinguishes empty search results from clear queues in Work Plans and Governance review tabs', async () => {
    const plans = render(<WorkPlanReviewInbox />);
    expect(screen.getByText('All work plans reviewed')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Search work plan reviews'), { target: { value: 'annual' } });
    await waitFor(() => expect(screen.getByText('No matching work plans')).toBeVisible());
    plans.unmount();

    render(<GovernanceReviewInbox />);
    expect(screen.getByText('Governance queue clear')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Search governance reviews'), { target: { value: 'charter' } });
    await waitFor(() => expect(screen.getByText('No matching governance items')).toBeVisible());
  });

  it('removes Reviews from My Work menu and Needs action from Inbox menu', () => {
    const myWorkItems = getSidebarContent('head', 'personal_work').sections.flatMap((s) => s.items.map((i) => i.label));
    expect(myWorkItems).toEqual(['Assigned work', 'Leading', 'Subtasks', 'History']);
    expect(myWorkItems).not.toContain('Reviews');

    const inboxItems = getSidebarContent('head', 'inbox').sections.flatMap((s) => s.items.map((i) => i.label));
    expect(inboxItems).toEqual(['Notifications', 'Messages']);
    expect(inboxItems).not.toContain('Needs action');
  });
});
