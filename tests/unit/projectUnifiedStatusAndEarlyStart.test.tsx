// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userProfile: {
    id: 'head-1',
    full_name: 'Office Head',
    email: 'head@lgu.gov.ph',
    role: 'head',
    org_id: 'org-1',
    is_active: true,
  } as any,
}));

const decideNonHeadProjectApprovalMock = vi.hoisted(() => vi.fn());
const resubmitProjectForHeadApprovalMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({ userProfile: authState.userProfile }),
}));
vi.mock('../../src/app/features/projects/services/projectLifecycleService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/app/features/projects/services/projectLifecycleService')>();
  return {
    ...actual,
    decideNonHeadProjectApproval: (...args: unknown[]) => decideNonHeadProjectApprovalMock(...args),
    resubmitProjectForHeadApproval: (...args: unknown[]) => resubmitProjectForHeadApprovalMock(...args),
  };
});
vi.mock('../../src/app/features/project-publication', () => ({
  ProjectPublicationAction: () => null,
}));
vi.mock('../../src/app/components/ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import {
  effectiveProjectLifecycleStatus,
  type Project,
} from '../../src/app/features/projects/services/projectService';
import {
  formatProjectTargetDateSubtext,
  resolveUnifiedProjectStatus,
} from '../../src/app/features/projects/presentation/projectPresentation';
import { ProjectsPortfolioTable } from '../../src/app/features/projects/components/ProjectsPortfolioTable';
import { ProjectHeader } from '../../src/app/features/projects/components/project-command/ProjectHeader';
import {
  EarlyStartConfirmModal,
  getEarlyStartConfig,
} from '../../src/app/features/project-readiness';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    orgId: 'org-1',
    title: 'Road Lighting Rehabilitation',
    description: 'Upgrade barangay streetlights.',
    status: 'planning',
    priority: 'medium',
    ownerId: 'head-1',
    projectLeadId: 'lead-1',
    startDate: '2026-12-01',
    targetDate: '2026-12-20',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('Unified Project Status Model (Single Badge + Approval -> Waiting for activation)', () => {
  it('never shows Due soon or No scheduled work on incomplete Planning projects', () => {
    const draft = makeProject({
      status: 'planning',
      setupCompletedAt: undefined,
      startDate: '2026-11-23',
      targetDate: '2026-11-24',
    });
    const info = resolveUnifiedProjectStatus(draft, 'due_soon', '2026-11-22');
    expect(info.effectiveStatus).toBe('planning');
    expect(info.label).toBe('Planning');
    expect(info.sublabel).toBe('Setup incomplete');
    expect(formatProjectTargetDateSubtext(draft, undefined, '2026-11-22')?.text).toBe('Starts 11/23/2026');
  });

  it('shows Pending approval for funded and non-Head no-funding projects awaiting approval', () => {
    const nonHeadFunded = makeProject({
      fundingApprovalStatus: 'pending_head',
      setupCompletedAt: '2026-11-22T01:00:00Z',
    });
    expect(effectiveProjectLifecycleStatus(nonHeadFunded)).toBe('pending');
    expect(resolveUnifiedProjectStatus(nonHeadFunded, 'on_track', '2026-11-22')).toMatchObject({
      label: 'Pending approval',
      sublabel: 'Awaiting Office Head & Accounting approval',
    });

    const headFunded = makeProject({
      fundingApprovalStatus: 'pending_accounting',
      setupCompletedAt: '2026-11-22T01:00:00Z',
    });
    expect(resolveUnifiedProjectStatus(headFunded, 'on_track', '2026-11-22')).toMatchObject({
      label: 'Pending approval',
      sublabel: 'Awaiting Accounting certification',
    });

    const nonHeadNoFunding = makeProject({
      fundingNotRequired: true,
      projectApprovalStatus: 'pending_head',
      setupCompletedAt: '2026-11-22T01:00:00Z',
    });
    expect(effectiveProjectLifecycleStatus(nonHeadNoFunding)).toBe('pending');
    expect(resolveUnifiedProjectStatus(nonHeadNoFunding, 'on_track', '2026-11-22')).toMatchObject({
      label: 'Pending approval',
      sublabel: 'Awaiting Office Head approval',
    });
  });

  it('transitions approved projects to Waiting for activation (never Active automatically)', () => {
    const approvedFuture = makeProject({
      status: 'planning',
      setupCompletedAt: '2026-11-22T01:00:00Z',
      fundingApprovalStatus: 'approved',
      startDate: '2026-12-10',
    });
    expect(effectiveProjectLifecycleStatus(approvedFuture)).toBe('waiting_for_activation');
    expect(resolveUnifiedProjectStatus(approvedFuture, 'on_track', '2026-11-22')).toMatchObject({
      label: 'Waiting for activation',
      sublabel: 'Approved · Starts 12/10/2026',
    });

    const approvedReadyToday = makeProject({
      status: 'planning',
      setupCompletedAt: '2026-11-22T01:00:00Z',
      fundingNotRequired: true,
      projectApprovalStatus: 'approved',
      startDate: '2026-11-22',
    });
    expect(resolveUnifiedProjectStatus(approvedReadyToday, 'on_track', '2026-11-22')).toMatchObject({
      label: 'Waiting for activation',
      sublabel: 'Approved · Ready to activate',
    });

    const scheduled = makeProject({
      status: 'planning',
      setupCompletedAt: '2026-11-22T01:00:00Z',
      fundingApprovalStatus: 'approved',
      startDate: '2026-12-10',
      activationScheduledAt: '2026-11-22T02:00:00Z',
    });
    expect(resolveUnifiedProjectStatus(scheduled, 'on_track', '2026-11-22')).toMatchObject({
      label: 'Waiting for activation',
      sublabel: 'Scheduled · 12/10/2026',
    });
  });

  it('surfaces calm health subtext only on Active projects and handles Pending completion', () => {
    const activeDueSoon = makeProject({ status: 'active', targetDate: '2026-11-24' });
    expect(resolveUnifiedProjectStatus(activeDueSoon, 'due_soon', '2026-11-22')).toMatchObject({
      label: 'Active',
      sublabel: 'Due soon',
      sublabelTone: 'warning',
    });

    const pendingCompletion = makeProject({
      status: 'active',
      completionReviewStatus: 'requested',
    });
    expect(resolveUnifiedProjectStatus(pendingCompletion, 'on_track', '2026-11-22')).toMatchObject({
      effectiveStatus: 'pending_completion',
      label: 'Pending completion',
      sublabel: 'Awaiting Office Head review',
    });
  });
});

describe('ProjectsPortfolioTable & ProjectHeader — Single Badge UI & Head Approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.userProfile = {
      id: 'head-1',
      full_name: 'Office Head',
      email: 'head@lgu.gov.ph',
      role: 'head',
      org_id: 'org-1',
      is_active: true,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('removes the duplicate Schedule column and displays Project Lead + unified Status in All projects', () => {
    const projects: Project[] = [
      makeProject({
        id: 'p-1',
        title: 'Approved Streetlights',
        status: 'planning',
        setupCompletedAt: '2026-11-22T01:00:00Z',
        fundingApprovalStatus: 'approved',
        projectLeadId: 'lead-1',
        ownerId: 'head-1',
        startDate: '2026-12-15',
      }),
    ];

    render(
      <ProjectsPortfolioTable
        projects={projects}
        tasks={[]}
        organizations={[{ id: 'org-1', name: 'LEDIPO', slug: 'ledipo', is_active: true, created_at: '' } as any]}
        profiles={[
          { id: 'head-1', full_name: 'Office Head', email: 'head@lgu.gov.ph', role: 'head', org_id: 'org-1', is_active: true } as any,
          { id: 'lead-1', full_name: 'Maria Lead', email: 'maria@lgu.gov.ph', role: 'member', org_id: 'org-1', is_active: true } as any,
        ]}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText('Schedule')).not.toBeInTheDocument();
    expect(screen.queryByText('No scheduled work')).not.toBeInTheDocument();
    expect(screen.getByText('Waiting for activation')).toBeInTheDocument();
    expect(screen.getByText('Maria Lead')).toBeInTheDocument();
  });

  it('lets Office Head approve a pending non-Head project from ProjectHeader without auto-activating', async () => {
    decideNonHeadProjectApprovalMock.mockResolvedValue({
      projectId: 'proj-nonhead',
      status: 'planning',
      projectApprovalStatus: 'approved',
    });

    const project = makeProject({
      id: 'proj-nonhead',
      title: 'Community Pantry Outreach',
      status: 'planning',
      fundingNotRequired: true,
      projectApprovalStatus: 'pending_head',
      setupCompletedAt: '2026-11-22T01:00:00Z',
    });

    render(
      <ProjectHeader
        project={project}
        organizations={[{ id: 'org-1', name: 'LEDIPO', head_user_id: 'head-1' } as any]}
        profiles={[{ id: 'lead-1', full_name: 'Maria Lead' } as any]}
      />,
    );

    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.queryByText('Due soon')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Approve project/i }));
    await waitFor(() => {
      expect(decideNonHeadProjectApprovalMock).toHaveBeenCalledWith('proj-nonhead', true, '');
    });
    expect(await screen.findByText(/Status is now Waiting for activation/i)).toBeInTheDocument();
  });
});

describe('EarlyStartConfirmModal — Distance-Aware Escalation (Near / Weeks / Far)', () => {
  afterEach(() => {
    cleanup();
  });

  it('escalates copy and requirements across 1–6d, 7–29d, and 30+d tiers', () => {
    const near = getEarlyStartConfig(3, 'Bridge Repair', '11/25/2026');
    expect(near.tier).toBe('near');
    expect(near.requireReason).toBe(false);
    expect(near.requireAcknowledge).toBe(false);

    const weeks = getEarlyStartConfig(14, 'Bridge Repair', '12/06/2026');
    expect(weeks.tier).toBe('weeks');
    expect(weeks.requireReason).toBe(true);
    expect(weeks.requireAcknowledge).toBe(false);

    const far = getEarlyStartConfig(45, 'Bridge Repair', '01/06/2027');
    expect(far.tier).toBe('far');
    expect(far.requireReason).toBe(true);
    expect(far.requireAcknowledge).toBe(true);
    expect(far.title).toMatch(/45 days/i);
  });

  it('blocks 30+ day early start until checkbox + 10-char reason are provided, and offers Schedule instead', () => {
    const onConfirm = vi.fn();
    const onSchedule = vi.fn();

    render(
      <EarlyStartConfirmModal
        open
        projectTitle="Drainage Upgrade"
        startDateLabel="01/15/2027"
        daysEarly={54}
        canScheduleInstead
        onCancel={vi.fn()}
        onConfirmEarlyStart={onConfirm}
        onScheduleInstead={onSchedule}
      />,
    );

    // Attempt submit without checkbox or reason
    fireEvent.click(screen.getByRole('button', { name: /Confirm early start/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirm that you reviewed how far away/i)).toBeInTheDocument();

    // Check box + enter valid justification
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText(/Early start justification/i), {
      target: { value: 'Mayor issued urgent directive to begin drainage clearing ahead of typhoon season.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm early start/i }));

    expect(onConfirm).toHaveBeenCalledWith(
      'Mayor issued urgent directive to begin drainage clearing ahead of typhoon season.',
    );

    // Escape hatch: Schedule instead
    fireEvent.click(screen.getByRole('button', { name: /Schedule for 01\/15\/2027 instead/i }));
    expect(onSchedule).toHaveBeenCalledOnce();
  });
});
