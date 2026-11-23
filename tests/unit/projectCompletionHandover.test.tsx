// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../src/app/features/projects/services/types';
import { effectiveProjectLifecycleStatus } from '../../src/app/features/projects/services/projectMappers';

const authState = vi.hoisted(() => ({
  userProfile: {
    id: 'lead-member',
    full_name: 'Maria Lead',
    email: 'lead@test',
    role: 'member',
    org_id: 'office-1',
    is_active: true,
  } as any,
}));

const lifecycleApi = vi.hoisted(() => ({
  fetchProjectCompletionReadiness: vi.fn(),
  completeProject: vi.fn(),
  requestProjectCompletionReview: vi.fn(),
  returnProjectCompletionReview: vi.fn(),
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({ userProfile: authState.userProfile }),
}));
vi.mock('../../src/app/shared/actionActor', () => ({
  assertActionActor: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/app/features/projects/services/projectLifecycleService', () => lifecycleApi);
vi.mock('../../src/app/features/project-readiness', () => ({
  subscribeProjectChecks: () => () => {},
  ProjectReadinessPanel: () => null,
}));
vi.mock('../../src/app/shared/navigationGuard', () => ({
  useNavigationBlocker: vi.fn(),
  requestNavigation: (fn: () => void) => fn(),
}));

import { ProjectCompleteDialog } from '../../src/app/features/projects/components/ProjectCompleteDialog';
import { ProjectSetupFields } from '../../src/app/features/project-setup/components/ProjectSetupFields';

const baseProject: Project = {
  id: 'proj-1',
  orgId: 'office-1',
  title: 'Community Water System',
  description: 'Deliver clean water access.',
  status: 'active',
  priority: 'medium',
  projectLeadId: 'lead-member',
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('Project lifecycle: Pending status, Project Lead selector & Head completion handover', () => {
  it('marks planning projects as pending when funding approval is awaiting Head or Accounting', () => {
    expect(effectiveProjectLifecycleStatus({ status: 'planning', fundingApprovalStatus: 'pending_head' })).toBe('pending');
    expect(effectiveProjectLifecycleStatus({ status: 'planning', fundingApprovalStatus: 'pending_accounting' })).toBe('pending');
    expect(effectiveProjectLifecycleStatus({ status: 'planning', fundingApprovalStatus: 'approved' })).toBe('planning');
    expect(effectiveProjectLifecycleStatus({ status: 'planning', fundingApprovalStatus: 'none' })).toBe('planning');
    expect(effectiveProjectLifecycleStatus({ status: 'active', fundingApprovalStatus: 'pending_accounting' })).toBe('active');
  });

  it('renders an alphabetical Project Lead dropdown with Office Head tagged and dynamic handover help copy', () => {
    const update = vi.fn();
    const profiles: any[] = [
      { id: 'u-zoe', full_name: 'Zoe Mendoza', email: 'z@test', role: 'member', org_id: 'office-1', is_active: true },
      { id: 'u-head', full_name: 'Cheryl Gallo', email: 'h@test', role: 'head', org_id: 'office-1', is_active: true },
      { id: 'u-ana', full_name: 'Ana Reyes', email: 'a@test', role: 'member', org_id: 'office-1', is_active: true },
    ];

    const { rerender } = render(
      <ProjectSetupFields
        step={0}
        draft={{ title: '', description: '', scope: '', lead: 'u-head', start: '', end: '', noFunding: false }}
        update={update}
        profiles={profiles}
        officeHeadId="u-head"
        disabled={false}
      />,
    );

    const select = screen.getByLabelText('Project Lead *') as HTMLSelectElement;
    expect(select.value).toBe('u-head');
    const optionTexts = Array.from(select.options).map((opt) => opt.textContent);
    expect(optionTexts).toEqual([
      'Select Project Lead',
      'Ana Reyes',
      'Cheryl Gallo (Office Head)',
      'Zoe Mendoza',
    ]);
    expect(screen.getByText(/Office Head can mark this project complete directly/)).toBeVisible();

    fireEvent.change(select, { target: { value: 'u-ana' } });
    expect(update).toHaveBeenCalledWith('lead', 'u-ana');

    rerender(
      <ProjectSetupFields
        step={0}
        draft={{ title: '', description: '', scope: '', lead: 'u-ana', start: '', end: '', noFunding: false }}
        update={update}
        profiles={profiles}
        officeHeadId="u-head"
        disabled={false}
      />,
    );
    expect(screen.getByText(/Project Lead must request final review from the Office Head/)).toBeVisible();
  });

  it('allows a non-Head Project Lead to submit a project for Head final completion review once work blockers are clear', async () => {
    authState.userProfile = {
      id: 'lead-member',
      full_name: 'Maria Lead',
      email: 'lead@test',
      role: 'member',
      org_id: 'office-1',
      is_active: true,
    };
    lifecycleApi.fetchProjectCompletionReadiness.mockResolvedValue({
      projectId: 'proj-1',
      title: 'Community Water System',
      status: 'active',
      canComplete: false,
      workBlockersCount: 0,
      requiresHeadCompletionReview: true,
      completionReviewStatus: 'none',
      canRequestCompletionReview: true,
      projectLeadId: 'lead-member',
      projectLeadName: 'Maria Lead',
      blockers: [
        {
          kind: 'lead_review',
          id: 'proj-1',
          title: 'Project Lead completion review required',
          status: 'none',
          detail: 'Maria Lead must submit this project for final completion review.',
        },
      ],
    });
    lifecycleApi.requestProjectCompletionReview.mockResolvedValue({});

    render(
      <ProjectCompleteDialog
        projectId="proj-1"
        projectTitle="Community Water System"
        project={baseProject}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenGovernance={vi.fn()}
      />,
    );

    const submitBtn = await screen.findByRole('button', { name: 'Submit for Head completion review' });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    expect(screen.queryByRole('button', { name: /Confirm completion|Approve & mark complete/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Handover summary for Office Head (optional)'), {
      target: { value: 'All deliverables verified and settled.' },
    });
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(lifecycleApi.requestProjectCompletionReview).toHaveBeenCalledWith(
        'proj-1',
        'All deliverables verified and settled.',
      ),
    );
  });

  it('lets the Office Head approve & mark complete or request changes on a Project Lead submission', async () => {
    authState.userProfile = {
      id: 'head-1',
      full_name: 'Office Head',
      email: 'head@test',
      role: 'head',
      org_id: 'office-1',
      is_active: true,
    };
    lifecycleApi.fetchProjectCompletionReadiness.mockResolvedValue({
      projectId: 'proj-1',
      title: 'Community Water System',
      status: 'active',
      canComplete: true,
      workBlockersCount: 0,
      requiresHeadCompletionReview: true,
      completionReviewStatus: 'requested',
      completionRequestedByName: 'Maria Lead',
      completionRequestedAt: '2026-11-22T00:30:00Z',
      completionRequestNote: 'All field tasks approved.',
      canApproveCompletion: true,
      blockers: [],
    });
    lifecycleApi.returnProjectCompletionReview.mockResolvedValue({});

    render(
      <ProjectCompleteDialog
        projectId="proj-1"
        projectTitle="Community Water System"
        project={{ ...baseProject, completionReviewStatus: 'requested' }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenGovernance={vi.fn()}
      />,
    );

    expect(await screen.findByText(/All field tasks approved/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Approve & mark complete' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Request changes' }));
    fireEvent.change(screen.getByLabelText('Changes requested for Project Lead *'), {
      target: { value: 'Attach the final inspection certificate first.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send change request' }));

    await waitFor(() =>
      expect(lifecycleApi.returnProjectCompletionReview).toHaveBeenCalledWith(
        'proj-1',
        'Attach the final inspection certificate first.',
      ),
    );
  });

  it('lets the Office Head mark a project complete directly when the Head is the Project Lead', async () => {
    authState.userProfile = {
      id: 'head-1',
      full_name: 'Office Head',
      email: 'head@test',
      role: 'head',
      org_id: 'office-1',
      is_active: true,
    };
    lifecycleApi.fetchProjectCompletionReadiness.mockResolvedValue({
      projectId: 'proj-1',
      title: 'Community Water System',
      status: 'active',
      canComplete: true,
      workBlockersCount: 0,
      requiresHeadCompletionReview: false,
      completionReviewStatus: 'none',
      canApproveCompletion: true,
      blockers: [],
    });
    lifecycleApi.completeProject.mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    render(
      <ProjectCompleteDialog
        projectId="proj-1"
        projectTitle="Community Water System"
        project={{ ...baseProject, projectLeadId: 'head-1' }}
        onClose={vi.fn()}
        onSuccess={onSuccess}
        onOpenTask={vi.fn()}
        onOpenGovernance={vi.fn()}
      />,
    );

    const confirmBtn = await screen.findByRole('button', { name: 'Confirm completion' });
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    expect(screen.queryByRole('button', { name: 'Request changes' })).toBeNull();

    fireEvent.click(confirmBtn);
    await waitFor(() => expect(lifecycleApi.completeProject).toHaveBeenCalledWith('proj-1', ''));
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
