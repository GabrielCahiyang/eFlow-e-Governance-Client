// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import {
  DEFAULT_WORKLOAD_THRESHOLDS,
  EMPTY_OVERLOAD_OVERRIDE,
  OverloadMitigationPanel,
  overloadOverrideValidationError,
  projectMemberWorkload,
  type MemberWorkloadDetail,
  type MemberWorkloadSummary,
} from '../../src/app/features/workload';
import { WorkloadMaintenance } from '../../src/app/features/administration/configuration/WorkloadMaintenance';

function makeSummary(overrides: Partial<MemberWorkloadSummary> = {}): MemberWorkloadSummary {
  return {
    userId: 'u-overloaded',
    fullName: 'Juan Dela Cruz',
    email: 'juan@lgu.gov.ph',
    role: 'member',
    isOfficeHead: false,
    activeProjectsLed: 2,
    planningProjectsLed: 1,
    taskLeads: 2,
    taskContributions: 1,
    subtaskLeads: 1,
    subtaskContributions: 0,
    pendingReviews: 1,
    overdueCount: 0,
    dueSoonCount: 1,
    loadPoints: 13.0,
    utilizationPercent: 108,
    tier: 'overloaded',
    reasons: ['Load 13.0 pts reaches overload threshold 12.0 pts'],
    ...overrides,
  };
}

describe('Workload & Overload Mitigation — projection math & override rules', () => {
  it('uses integer-tenth math cleanly and detects tipping into overload', () => {
    const nearLimit = makeSummary({
      userId: 'u-heavy',
      activeProjectsLed: 1,
      planningProjectsLed: 0,
      taskLeads: 3,
      taskContributions: 1,
      subtaskLeads: 0,
      subtaskContributions: 1,
      pendingReviews: 0,
      loadPoints: 10.5,
      utilizationPercent: 88,
      tier: 'heavy',
      reasons: [],
    });

    const projected = projectMemberWorkload(nearLimit, 'task_lead', DEFAULT_WORKLOAD_THRESHOLDS);
    expect(projected).not.toBeNull();
    expect(projected!.addedPoints).toBe(2.0);
    expect(projected!.projectedPoints).toBe(12.5);
    expect(projected!.projectedTier).toBe('overloaded');
    expect(projected!.tipsIntoOverload).toBe(true);
    expect(projected!.requiresOverride).toBe(true);
  });

  it('does not double-count or require override when viewing an existing assignment', () => {
    const existing = makeSummary({ loadPoints: 12.5, tier: 'overloaded' });
    const projected = projectMemberWorkload(existing, 'task_lead', DEFAULT_WORKLOAD_THRESHOLDS, {
      alreadyAssignedInRole: true,
    });
    expect(projected!.addedPoints).toBe(0);
    expect(projected!.projectedPoints).toBe(12.5);
    expect(projected!.requiresOverride).toBe(false);
  });

  it('enforces hard role caps (maxActiveProjectLeads, maxActiveTaskLeads, maxOverdueItems)', () => {
    const lowPtsHighCap = makeSummary({
      loadPoints: 4.5,
      tier: 'balanced',
      activeProjectsLed: 2,
      taskLeads: 4,
      overdueCount: 0,
      reasons: [],
    });
    const projLead = projectMemberWorkload(
      lowPtsHighCap,
      'project_lead_active',
      DEFAULT_WORKLOAD_THRESHOLDS,
    );
    expect(projLead!.projectedTier).toBe('overloaded');
    expect(projLead!.reasons.some((r) => r.includes('Leading 3 active projects'))).toBe(true);

    const taskLead = projectMemberWorkload(
      lowPtsHighCap,
      'task_lead',
      DEFAULT_WORKLOAD_THRESHOLDS,
    );
    expect(taskLead!.projectedTier).toBe('overloaded');
    expect(taskLead!.reasons.some((r) => r.includes('Leading 5 active tasks'))).toBe(true);

    const overdueMember = makeSummary({
      loadPoints: 5.0,
      tier: 'overloaded',
      activeProjectsLed: 0,
      taskLeads: 1,
      overdueCount: 3,
    });
    const overdueProj = projectMemberWorkload(
      overdueMember,
      'subtask_contributor',
      DEFAULT_WORKLOAD_THRESHOLDS,
    );
    expect(overdueProj!.projectedTier).toBe('overloaded');
    expect(overdueProj!.reasons.some((r) => r.includes('3 overdue'))).toBe(true);
  });

  it('validates mandatory acknowledgment and 10–500 char override reason', () => {
    const overloaded = makeSummary();
    const projection = projectMemberWorkload(overloaded, 'task_lead', DEFAULT_WORKLOAD_THRESHOLDS);

    expect(overloadOverrideValidationError(projection, EMPTY_OVERLOAD_OVERRIDE)).toMatch(/Confirm you reviewed/i);
    expect(
      overloadOverrideValidationError(projection, { acknowledged: true, reason: '   ' }),
    ).toMatch(/Enter a short justification/i);
    expect(
      overloadOverrideValidationError(projection, { acknowledged: true, reason: 'too short' }),
    ).toMatch(/at least 10 characters/i);
    expect(
      overloadOverrideValidationError(projection, {
        acknowledged: true,
        reason: 'Only licensed civil engineer available for this barangay road audit.',
      }),
    ).toBe('');
  });
});

describe('OverloadMitigationPanel — same-modal breakdown, 1-click switch & override', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('displays active projects/tasks breakdown, filters excluded alternatives, swaps in 1 click, and shows override validation', async () => {
    const detail: MemberWorkloadDetail = {
      member: {
        userId: 'u-overloaded',
        fullName: 'Juan Dela Cruz',
        email: 'juan@lgu.gov.ph',
        role: 'member',
        orgId: 'org-1',
        orgName: 'City Engineering Office',
        isOfficeHead: false,
      },
      summary: makeSummary(),
      thresholds: DEFAULT_WORKLOAD_THRESHOLDS,
      items: [
        {
          kind: 'project_lead',
          id: 'p-1',
          projectId: 'p-1',
          projectTitle: 'Drainage Rehabilitation Phase 2',
          title: 'Drainage Rehabilitation Phase 2',
          status: 'active',
          dueDate: '2026-11-30',
          isOverdue: false,
          isDueSoon: false,
          points: 3.0,
        },
        {
          kind: 'task_lead',
          id: 't-1',
          taskId: 't-1',
          projectId: 'p-1',
          projectTitle: 'Drainage Rehabilitation Phase 2',
          title: 'Site Inspection & Cost Estimate',
          status: 'in_progress',
          dueDate: '2026-11-24',
          isOverdue: false,
          isDueSoon: true,
          points: 2.0,
        },
      ],
      hiddenCounts: { projects: 0, tasks: 1, subtasks: 0, reviews: 0 },
      alternatives: [
        makeSummary({
          userId: 'u-excluded',
          fullName: 'Excluded Project Lead',
          loadPoints: 2.0,
          tier: 'balanced',
          activeProjectsLed: 0,
          planningProjectsLed: 0,
          taskLeads: 1,
          taskContributions: 0,
          reasons: [],
        }),
        makeSummary({
          userId: 'u-light',
          fullName: 'Maria Santos',
          loadPoints: 3.5,
          tier: 'balanced',
          activeProjectsLed: 0,
          planningProjectsLed: 0,
          taskLeads: 1,
          taskContributions: 1,
          reasons: [],
        }),
      ],
      calculatedAt: '2026-11-22T09:00:00+08:00',
    };

    rpcMock.mockResolvedValue({ data: detail, error: null });

    const onSwitchMember = vi.fn();
    const onOverrideChange = vi.fn();

    render(
      <OverloadMitigationPanel
        userId="u-overloaded"
        orgId="org-1"
        summary={makeSummary()}
        thresholds={DEFAULT_WORKLOAD_THRESHOLDS}
        proposedRole="task_lead"
        excludedAlternativeIds={['u-excluded']}
        override={EMPTY_OVERLOAD_OVERRIDE}
        onOverrideChange={onOverrideChange}
        onSwitchMember={onSwitchMember}
        showValidation
      />,
    );

    expect(screen.getByText(/Juan Dela Cruz is overloaded/i)).toBeInTheDocument();
    expect(screen.getByText(/Projected load:/i)).toBeInTheDocument();

    // Same-modal active commitments & filtered lighter-loaded teammate
    await waitFor(() => {
      expect(screen.getByText('Site Inspection & Cost Estimate')).toBeInTheDocument();
    });
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.queryByText('Excluded Project Lead')).not.toBeInTheDocument();

    // 1-click Assign instead swap
    fireEvent.click(screen.getByRole('button', { name: /Assign instead/i }));
    expect(onSwitchMember).toHaveBeenCalledWith('u-light');

    // Override checkbox toggle
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onOverrideChange).toHaveBeenCalledWith({ acknowledged: true, reason: '' });
  });
});

describe('WorkloadMaintenance — Admin threshold & weight validation', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [{ id: 'org-1', name: 'City Engineering Office' }],
              error: null,
            }),
        }),
      }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('blocks saving when overload threshold is <= heavy threshold and saves valid updates', async () => {
    const bundle = {
      effective: DEFAULT_WORKLOAD_THRESHOLDS,
      globalDefault: DEFAULT_WORKLOAD_THRESHOLDS,
      officeOverrides: [],
      canManage: true,
    };

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === 'get_workload_threshold_settings') {
        return Promise.resolve({ data: bundle, error: null });
      }
      if (fnName === 'save_workload_threshold_settings') {
        return Promise.resolve({
          data: {
            ...bundle,
            globalDefault: { ...DEFAULT_WORKLOAD_THRESHOLDS, heavyPoints: 9.0, overloadPoints: 14.0 },
            effective: { ...DEFAULT_WORKLOAD_THRESHOLDS, heavyPoints: 9.0, overloadPoints: 14.0 },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<WorkloadMaintenance />);

    const heavyInput = await screen.findByLabelText(/Heavy \(Near Capacity\) threshold/i);
    const overloadInput = screen.getByLabelText(/Overloaded threshold/i);

    // Invalid cross-field: overload <= heavy
    fireEvent.change(heavyInput, { target: { value: '12' } });
    fireEvent.change(overloadInput, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Save thresholds/i }));

    expect(
      await screen.findByText(/Must be greater than Heavy threshold/i),
    ).toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalledWith('save_workload_threshold_settings', expect.anything());

    // Valid values
    fireEvent.change(heavyInput, { target: { value: '9' } });
    fireEvent.change(overloadInput, { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: /Save thresholds/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        'save_workload_threshold_settings',
        expect.objectContaining({
          p_payload: expect.objectContaining({
            orgId: null,
            heavyPoints: 9,
            overloadPoints: 14,
          }),
        }),
      );
    });
  });
});
