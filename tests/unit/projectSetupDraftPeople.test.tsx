// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  flowCall: vi.fn(),
  readFlow: vi.fn(),
  reloadFlow: vi.fn(),
  fetchProjectOffices: vi.fn(),
  previewSelection: vi.fn(),
  saveSelection: vi.fn(),
  selectMembersChecked: vi.fn(),
  flowData: {} as any,
}));

vi.mock('../../src/app/features/project-setup/useProjectFlow', () => ({
  useProjectFlow: () => ({ data: mocks.flowData, reload: mocks.reloadFlow, error: '' }),
}));
vi.mock('../../src/app/features/project-setup/services/projectFlow', () => ({
  projectFlowCall: mocks.flowCall,
  readProjectFlow: mocks.readFlow,
  ProjectFlowError: class extends Error {},
}));
vi.mock('../../src/app/features/project-offices/services/projectOfficeService', () => ({
  fetchProjectOffices: mocks.fetchProjectOffices,
  selectProjectOfficeMembersChecked: mocks.selectMembersChecked,
}));
vi.mock('../../src/app/features/project-offices', () => ({
  prefetchProjectOffices: vi.fn().mockResolvedValue(undefined),
  ProjectOfficeContext: { Provider: ({ children }: any) => children },
  ProjectPeoplePage: () => <div data-testid="setup-people-page" />,
  useProjectOffices: () => ({ offices: [], members: [], loading: false, error: '', refresh: vi.fn() }),
}));
vi.mock('../../src/app/features/project-access', () => ({
  previewSelection: mocks.previewSelection,
  saveSelection: mocks.saveSelection,
}));
vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'james' }, userProfile: { id: 'james', role: 'head', org_id: 'ledipo' } }),
}));
vi.mock('../../src/app/shared/navigationGuard', () => ({
  useNavigationBlocker: vi.fn(),
  requestNavigation: async (action: () => void) => {
    action();
    return true;
  },
}));
vi.mock('../../src/app/features/work-templates', () => ({
  listProjectTaskTemplates: vi.fn().mockResolvedValue([]),
  ProjectTaskTemplateLibrary: () => null,
  summarizeProjectTaskTemplate: () => ({ groupCount: 0, taskCount: 0, subtaskCount: 0, groupNames: [] }),
  saveProjectTaskTemplate: vi.fn(),
  parseProjectTaskGroups: (g: any[]) => g,
}));
vi.mock('../../src/app/features/project-setup/useProjectTaskTemplates', () => ({
  useProjectTaskTemplates: () => ({ templates: [], loading: false, error: '', reload: vi.fn() }),
}));
vi.mock('../../src/app/features/workload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/app/features/workload')>();
  return {
    ...actual,
    invalidateWorkloadCache: vi.fn(),
    recordWorkloadOverloadOverride: vi.fn(),
    useOfficeWorkload: () => ({ byUserId: new Map(), thresholds: actual.DEFAULT_WORKLOAD_THRESHOLDS }),
  };
});

import { ProjectSetupWizard } from '../../src/app/features/project-setup/components/ProjectSetupWizard';
import { getPhilippineCalendarDate } from '../../src/app/shared/calendarDates';

const today = getPhilippineCalendarDate();

const profiles = [
  { id: 'other-org-user', full_name: 'Other Office', email: 'other@test', role: 'member', org_id: 'other-org', is_active: true },
  { id: 'james', full_name: 'James Adrian Denoy', email: 'james@test', role: 'head', org_id: 'ledipo', is_active: true },
  { id: 'gabriel', full_name: 'Gabriel Cahiyang', email: 'gabriel@test', role: 'member', org_id: 'ledipo', is_active: true },
  { id: 'kurt', full_name: 'Kurt Dichosa', email: 'kurt@test', role: 'accounting_staff', org_id: 'ledipo', is_active: true },
  { id: 'andres', full_name: 'Andres Manili', email: 'andres@test', role: 'member', org_id: 'ledipo', is_active: true },
] as any[];

const orgs = [{ id: 'ledipo', name: 'LEDIPO', head_user_id: 'james', is_active: true }] as any[];

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  mocks.flowData = {
    project: {
      id: 'proj-1',
      org_id: 'ledipo',
      title: 'MOOESZ',
      description: 'Desc',
      scope: 'Scope',
      project_lead_id: 'james',
      start_date: today,
      target_date: today,
      funding_not_required: true,
      updated_at: '2026-11-23T00:00:00Z',
    },
    ready: false,
    canDraftWork: false,
    hasEligibleAccountingStaff: true,
    canAuthorize: true,
    canAllocate: true,
    funds: [],
    sources: [],
    requests: [],
    fundingRequests: [],
    taskFunding: [],
    liquidations: [],
    total: 0,
    allocated: 0,
    unallocated: 0,
    released: 0,
    spent: 0,
  };
  mocks.reloadFlow.mockResolvedValue(undefined);
  mocks.readFlow.mockImplementation(async () => mocks.flowData);
  mocks.flowCall.mockImplementation(async (op: string) => {
    if (op === 'office_funding_sources_preview') {
      return { orgId: 'ledipo', canAuthorize: true, hasEligibleAccountingStaff: true, sources: [] };
    }
    return mocks.flowData.project;
  });
  mocks.fetchProjectOffices.mockResolvedValue({
    offices: [{ id: 'po-lead', project_id: 'proj-1', office_id: 'ledipo', relationship_type: 'lead', invitation_status: 'joined' }],
    members: [
      { project_office_id: 'po-lead', user_id: 'james' },
      { project_office_id: 'po-lead', user_id: 'andres' },
    ],
  });
  mocks.previewSelection.mockResolvedValue({ fingerprint: 'fp-1', removed: [] });
  mocks.saveSelection.mockResolvedValue(undefined);
});

afterEach(cleanup);

it('saves only the explicitly selected office members in setup (including removing pre-existing unselected ones)', async () => {
  render(
    <ProjectSetupWizard
      projectId="proj-1"
      creatorId="james"
      profiles={profiles}
      organizations={orgs}
      onClose={vi.fn()}
      onFinish={vi.fn()}
    />,
  );

  // Uses creatorId org ('ledipo'), not the first profile's org ('other-org')
  expect(screen.queryByText('Other Office')).toBeNull();

  // Navigate to Step 06 Add people
  fireEvent.click(screen.getByRole('button', { name: /06.*Add people/ }));
  const andresBox = await screen.findByLabelText('Include Andres Manili') as HTMLInputElement;
  const gabrielBox = screen.getByLabelText('Include Gabriel Cahiyang') as HTMLInputElement;
  const kurtBox = screen.getByLabelText('Include Kurt Dichosa') as HTMLInputElement;

  expect(andresBox.checked).toBe(true);
  fireEvent.click(andresBox); // Uncheck Andres
  fireEvent.click(gabrielBox); // Check Gabriel
  fireEvent.click(kurtBox); // Check Kurt

  // Go back to Review and click Next: Add people (which finishes setup & syncs draft people)
  fireEvent.click(screen.getByRole('button', { name: /05.*Review/ }));
  const continueBtn = await screen.findByRole('button', { name: /Next: Add people/i });
  await waitFor(() => expect(continueBtn).toBeEnabled());
  fireEvent.click(continueBtn);

  await waitFor(() => expect(mocks.saveSelection).toHaveBeenCalledTimes(1));
  const savedUsers = mocks.saveSelection.mock.calls[0][1] as string[];
  expect(savedUsers.sort()).toEqual(['gabriel', 'james', 'kurt']);
  expect(savedUsers).not.toContain('andres');
}, 30000);
