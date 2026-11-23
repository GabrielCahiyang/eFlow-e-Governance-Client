// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BoundedTextarea, BoundedTextInput } from '../../src/app/components/ui/BoundedInput';
import { MoneyInput } from '../../src/app/components/ui/MoneyInput';
import { diffCentavos, exceedsCentavos, formatPeso, sumCentavos, toCentavos } from '../../src/app/shared/currency';
import { parseMoneyInput, parseMoneyInputDetailed } from '../../src/app/shared/moneyInput';
import { INPUT_LIMITS } from '../../src/app/shared/inputLimits';
import { fundingEntryError, fundingRowIssues } from '../../src/app/features/project-setup/fundingMessages';

const flowMock = vi.hoisted(() => ({
  call: vi.fn(),
  read: vi.fn(),
  reload: vi.fn(),
  data: undefined as any,
}));

vi.mock('../../src/app/shared/navigationGuard', () => ({
  useNavigationBlocker: vi.fn(),
  requestNavigation: async (action: () => void) => {
    action();
    return true;
  },
}));
vi.mock('../../src/app/features/project-setup/services/projectFlow', () => ({
  projectFlowCall: flowMock.call,
  readProjectFlow: flowMock.read,
  ProjectFlowError: class extends Error {},
}));
vi.mock('../../src/app/features/project-setup/useProjectFlow', () => ({
  useProjectFlow: () => ({ data: flowMock.data, reload: flowMock.reload, error: '' }),
}));
vi.mock('../../src/app/features/work-templates', () => ({
  listProjectTaskTemplates: vi.fn(async () => []),
  ProjectTaskTemplateLibrary: () => null,
  summarizeProjectTaskTemplate: (groups: any[]) => ({ groupCount: groups.length, taskCount: 0, subtaskCount: 0, groupNames: [] }),
  saveProjectTaskTemplate: vi.fn(),
  parseProjectTaskGroups: (groups: any[]) => groups,
}));

import { ProjectFundingPanel } from '../../src/app/features/project-setup/components/ProjectFundingPanel';
import { ProjectSetupWizard } from '../../src/app/features/project-setup/components/ProjectSetupWizard';
import { getPhilippineCalendarDate, getPhilippineYear } from '../../src/app/shared/calendarDates';

vi.setConfig({ testTimeout: 30000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetAllMocks();
});

describe('Sir Nonel QA guardrails for Create a project', () => {
  it('performs centavo-safe PHP arithmetic without floating-point drift', () => {
    expect(toCentavos(0.1)).toBe(10);
    expect(sumCentavos([0.1, 0.2])).toBe(0.3);
    expect(diffCentavos(40111.1, 40000.05)).toBe(111.05);
    expect(exceedsCentavos(750000.01, 750000)).toBe(true);
    expect(exceedsCentavos(750000.0, 750000)).toBe(false);
    expect(formatPeso(32143143111)).toBe('₱32,143,143,111.00');
  });

  it('aligns PROJECT_DESCRIPTION cap to 8,000 characters', () => {
    expect(INPUT_LIMITS.PROJECT_DESCRIPTION).toBe(8000);
  });

  it('parses PHP/₱ pasted currency prefixes and classifies rejected inputs', () => {
    expect(parseMoneyInput('PHP 50,000.25')).toBe('50000.25');
    expect(parseMoneyInput('₱ 12,345')).toBe('12345');
    expect(parseMoneyInputDetailed('-100')).toEqual({ value: null, reason: 'negative' });
    expect(parseMoneyInputDetailed('100.123')).toEqual({ value: null, reason: 'too_many_decimals' });
    expect(parseMoneyInputDetailed('abc')).toEqual({ value: null, reason: 'non_numeric' });
  });

  it('renders live bottom-right character counter and pops up limit tooltip on BoundedTextarea & BoundedTextInput', () => {
    const onChange = vi.fn();
    render(
      <div>
        <BoundedTextInput aria-label="Short title" value="12345" maxLength={5} onChange={onChange} />
        <BoundedTextarea aria-label="Project scope" value="Hello" maxLength={8000} onChange={onChange} />
      </div>,
    );

    expect(screen.getByText('5 / 5')).toHaveAttribute('data-level', 'max');
    expect(screen.getByText('5 / 8,000')).toHaveAttribute('data-level', 'normal');

    const title = screen.getByLabelText('Short title') as HTMLInputElement;
    title.setSelectionRange(5, 5);
    fireEvent.keyDown(title, { key: 'x' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Maximum 5 characters reached.');
  });

  it('immediately flags over-budget amounts with red border, persistent inline error, and anchored tooltip on MoneyInput', () => {
    const onValueChange = vi.fn();
    render(
      <MoneyInput
        aria-label="Funding amount"
        value="32143143111"
        availableMax={750000}
        showCeilingHint
        onValueChange={onValueChange}
      />,
    );

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const hint = screen.getByText('Exceeds ₱750,000.00 by ₱32,142,393,111.00').closest('.eflow-money-hint');
    expect(hint).toHaveAttribute('data-over', 'true');
    fireEvent.focus(input);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Exceeds available ₱750,000.00 — reduce by ₱32,142,393,111.00.',
    );

    // Typing a negative sign pops up an immediate guard tooltip.
    fireEvent.keyDown(input, { key: '-' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Negative amounts are not allowed.');
  });

  it('renders a real .pf-error alert banner and red total on over-budget entries in both Budget tab and Wizard funding', () => {
    const year = getPhilippineYear();
    const data = {
      project: { id: 'p1', status: 'planning', funding_not_required: false },
      ready: false,
      hasEligibleAccountingStaff: true,
      canConfigure: true,
      canAuthorize: true,
      canAllocate: true,
      funds: [],
      sources: [{ id: 's1', name: 'Salaries and Wages — Regular', year, available: 750000 }],
      requests: [],
      taskFunding: [],
      liquidations: [],
      fundingRequests: [],
      total: 0,
      allocated: 0,
      unallocated: 0,
      released: 0,
      spent: 0,
    } as any;

    const onErrorChange = vi.fn();
    render(<ProjectFundingPanel data={data} reload={vi.fn()} onErrorChange={onErrorChange} />);
    fireEvent.change(screen.getByLabelText('Office Budget source'), { target: { value: 's1' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '32143143111' } });

    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('pf-error');
    expect(alert).toHaveTextContent('Amount exceeds available Office Budget');
    expect(alert).toHaveTextContent('Reduce it by ₱32,142,393,111.00.');
    expect(screen.getByText(/Additional funding total:/).closest('.pf-funding-total')).toHaveAttribute('data-over', 'true');
    expect(screen.getByRole('button', { name: 'Submit for Accounting certification' })).toBeDisabled();
    expect(onErrorChange).toHaveBeenLastCalledWith(true);
  });

  it('enforces cumulative multi-line fiscal budget ceiling in fundingMessages', () => {
    const sources = [
      { id: 's1', name: 'Salaries', year: 2026, available: 500000, fiscalBudgetId: 'fb1', fiscalAvailable: 600000 },
      { id: 's2', name: 'MOOE', year: 2026, available: 500000, fiscalBudgetId: 'fb1', fiscalAvailable: 600000 },
    ];
    const lines = [
      { partitionId: 's1', amount: 400000 },
      { partitionId: 's2', amount: 300000 },
    ];
    expect(fundingEntryError(lines, sources, 'Work program')).toContain('Combined total ₱700,000.00 exceeds available ₱600,000.00');
    const rowIssues = fundingRowIssues(lines, sources);
    expect(rowIssues[0].amountError).toContain('Combined FY 2026 total');
  });

  it('sorts Office Budget source dropdown options alphabetically (A–Z) in both wizard and funding tab', () => {
    const year = getPhilippineYear();
    const data = {
      project: { id: 'p1', status: 'planning', funding_not_required: false },
      ready: false,
      hasEligibleAccountingStaff: true,
      canConfigure: true,
      canAuthorize: true,
      canAllocate: true,
      funds: [],
      sources: [
        { id: 's-z', name: 'Utilities Expense', year, available: 100000 },
        { id: 's-a', name: 'Capital Outlay', year, available: 500000 },
        { id: 's-m', name: 'Office Supplies', year, available: 200000 },
      ],
      requests: [],
      taskFunding: [],
      liquidations: [],
      fundingRequests: [],
      total: 0,
      allocated: 0,
      unallocated: 0,
      released: 0,
      spent: 0,
    } as any;

    render(<ProjectFundingPanel wizard data={data} reload={vi.fn()} />);
    const select = screen.getByLabelText('Office Budget source') as HTMLSelectElement;
    const optionValues = Array.from(select.options).slice(1).map((opt) => opt.value);
    expect(optionValues).toEqual(['s-a', 's-m', 's-z']);
  });

  it('warns and blocks Head funding submission when no active independent Accounting Staff exists', () => {
    const year = getPhilippineYear();
    const data = {
      project: { id: 'p1', status: 'planning', funding_not_required: false },
      ready: false,
      hasEligibleAccountingStaff: false,
      canConfigure: true,
      canAuthorize: true,
      canAllocate: true,
      funds: [],
      sources: [{ id: 's1', name: 'Salaries', year, available: 750000 }],
      requests: [],
      taskFunding: [],
      liquidations: [],
      fundingRequests: [],
      total: 0,
      allocated: 0,
      unallocated: 0,
      released: 0,
      spent: 0,
    } as any;

    const { container } = render(<ProjectFundingPanel wizard data={data} reload={vi.fn()} />);
    expect(screen.getByText(/No active independent Accounting Staff is available/)).toBeVisible();
    expect(screen.queryByText('Cash released')).toBeNull();
    expect(container.innerHTML).not.toContain('rounded-full');

    fireEvent.change(screen.getByLabelText('Office Budget source'), { target: { value: 's1' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10000' } });
    fireEvent.change(screen.getByLabelText('Reason / approved authority reference *'), { target: { value: 'Approved' } });
    expect(screen.getByRole('button', { name: 'Submit for Accounting certification' })).toBeDisabled();
  });

  it('keeps Save draft and close enabled with unsaved funding rows and confirms before discarding them', async () => {
    const year = getPhilippineYear();
    const today = getPhilippineCalendarDate();
    const tomorrow = getPhilippineCalendarDate(new Date(Date.now() + 86400000));
    const createDraft = vi.fn().mockResolvedValue('p-draft');
    const onClose = vi.fn();

    const savedProject = {
      id: 'p-draft',
      status: 'planning',
      title: 'Draft Project',
      description: 'Project overview text',
      scope: 'Deliverable boundaries',
      project_lead_id: 'lead-1',
      start_date: today,
      target_date: tomorrow,
      funding_not_required: false,
      updated_at: '2026-11-22T00:00:00Z',
    };
    flowMock.data = {
      project: savedProject,
      ready: false,
      canAuthorize: true,
      canAllocate: true,
      hasEligibleAccountingStaff: true,
      funds: [],
      sources: [{ id: 's1', name: 'MOOE', year, available: 500000 }],
      requests: [],
      taskFunding: [],
      liquidations: [],
      fundingRequests: [],
      total: 0,
      allocated: 0,
      unallocated: 0,
      released: 0,
      spent: 0,
    };
    flowMock.read.mockResolvedValue(flowMock.data);
    flowMock.call.mockImplementation(async (op: string) => {
      if (op === 'office_funding_sources_preview') {
        return { orgId: 'o1', canAuthorize: true, hasEligibleAccountingStaff: true, sources: flowMock.data.sources };
      }
      if (op === 'save_project_definition') return savedProject;
    });

    render(
      <ProjectSetupWizard
        recoveryKey="qa-save-draft"
        creatorId="lead-1"
        createDraft={createDraft}
        profiles={[{ id: 'lead-1', full_name: 'Office Head', email: 'h@test', role: 'head', is_active: true }] as any}
        onClose={onClose}
        onFinish={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Project title *'), { target: { value: 'Draft Project' } });
    fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Project overview text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Scope of the project *'), { target: { value: 'Deliverable boundaries' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Project start date *'), { target: { value: today } });
    fireEvent.change(screen.getByLabelText('Project target date *'), { target: { value: tomorrow } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByLabelText('Office Budget source');
    expect(createDraft).not.toHaveBeenCalled();

    // Enter unsaved funding row: Save draft and close MUST stay enabled!
    fireEvent.change(screen.getByLabelText('Office Budget source'), { target: { value: 's1' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25000' } });
    const saveDraftBtn = screen.getByRole('button', { name: 'Save draft and close' });
    expect(saveDraftBtn).toBeEnabled();

    fireEvent.click(saveDraftBtn);
    expect(await screen.findByText('Save project draft without unsubmitted funding?')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft & discard funding entries' }));

    await waitFor(() => expect(createDraft).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('p-draft'));
  });

  it('allows skipping across setup tabs in Create project with AI, and pops up an explanatory modal only when clicking Import AI PDF before prerequisites are complete', async () => {
    render(
      <ProjectSetupWizard
        importPdf
        recoveryKey="qa-ai-skip"
        creatorId="lead-1"
        createDraft={vi.fn()}
        profiles={[{ id: 'lead-1', full_name: 'Office Head', email: 'h@test', role: 'head', is_active: true }] as any}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    await screen.findByLabelText('Project title *');
    expect(screen.queryByRole('button', { name: /Add people/i })).toBeNull();
    expect(screen.getByRole('button', { name: /06.*Import AI PDF/ })).toBeInTheDocument();

    // Skipping across setup tabs (e.g. 01 -> 03 Dates or 04 Funding) works freely without blocking.
    fireEvent.click(screen.getByRole('button', { name: /03.*Dates/ }));
    expect(screen.getByLabelText('Project start date *')).toBeVisible();
    expect(screen.queryByText('Complete earlier setup steps for AI import')).toBeNull();

    // Clicking 06 Import AI PDF itself pops up the explanatory modal.
    fireEvent.click(screen.getByRole('button', { name: /06.*Import AI PDF/ }));

    expect(await screen.findByText('Complete earlier setup steps for AI import')).toBeVisible();
    expect(screen.getByText(/Cannot skip ahead to 06 Import AI PDF yet/)).toBeVisible();
    expect(screen.getByText(/relies on your project’s/)).toBeVisible();
    expect(screen.getByRole('region', { name: 'Steps required before skipping' })).toHaveTextContent('Details');
    expect(screen.getByRole('region', { name: 'Steps required before skipping' })).toHaveTextContent('Scope');
    expect(screen.getByRole('region', { name: 'Steps required before skipping' })).toHaveTextContent('Funding');

    fireEvent.click(screen.getByRole('button', { name: 'Go to 01 Details' }));
    await waitFor(() => expect(screen.queryByText('Complete earlier setup steps for AI import')).toBeNull());
    expect(screen.getByRole('button', { name: /01.*Details/ })).toHaveAttribute('aria-current', 'step');
  });

  it('lets the user jump directly to Funding, Draft tasks, Scope, and Details in any order without blocking funding entry', async () => {
    const year = getPhilippineYear();
    flowMock.call.mockImplementation(async (operation: string) => {
      if (operation === 'office_funding_sources_preview') {
        return {
          orgId: 'org-1',
          canAuthorize: true,
          hasEligibleAccountingStaff: true,
          sources: [{ id: 's1', name: 'MOOE Supplies', year, available: 500000 }],
        };
      }
    });

    render(
      <ProjectSetupWizard
        recoveryKey="qa-free-tab-order"
        creatorId="lead-1"
        createDraft={vi.fn()}
        profiles={[{ id: 'lead-1', full_name: 'Office Head', email: 'h@test', role: 'head', is_active: true }] as any}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    // Jump straight from blank Step 01 -> Step 07 Draft tasks -> Step 04 Funding
    fireEvent.click(screen.getByRole('button', { name: /07.*Draft tasks/ }));
    expect(screen.getByRole('button', { name: /07.*Draft tasks/ })).toHaveAttribute('aria-current', 'step');

    fireEvent.click(screen.getByRole('button', { name: /04.*Funding/ }));
    const sourceSelect = await screen.findByLabelText('Office Budget source');
    expect(screen.queryByText(/Complete Details, Scope and Dates before choosing funding/i)).toBeNull();
    expect(sourceSelect).toBeEnabled();

    fireEvent.change(sourceSelect, { target: { value: 's1' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '15000' } });

    // Jump to Step 02 Scope -> Step 01 Details -> back to Step 04 Funding; entries stay intact
    fireEvent.click(screen.getByRole('button', { name: /02.*Scope/ }));
    fireEvent.change(screen.getByLabelText('Scope of the project *'), { target: { value: 'Barangay coverage' } });
    fireEvent.click(screen.getByRole('button', { name: /01.*Details/ }));
    fireEvent.change(screen.getByLabelText('Project title *'), { target: { value: 'Health Drive' } });
    fireEvent.click(screen.getByRole('button', { name: /04.*Funding/ }));

    expect(screen.getByLabelText('Office Budget source')).toHaveValue('s1');
    expect(screen.getByRole('spinbutton')).toHaveValue('15,000');
  });

  it('renders a structured error card with a styled Reload funding sources button and reloading state when funding sources fail to load', async () => {
    const year = getPhilippineYear();
    let resolveReload!: (value: unknown) => void;
    flowMock.call
      .mockRejectedValueOnce(new Error('Temporary connection timeout'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveReload = resolve; }));

    render(
      <ProjectSetupWizard
        recoveryKey="qa-funding-reload"
        creatorId="lead-1"
        createDraft={vi.fn()}
        profiles={[{ id: 'lead-1', full_name: 'Office Head', email: 'h@test', role: 'head', is_active: true }] as any}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /04.*Funding/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.className).toContain('pf-funding-error-card');
    expect(alert).toHaveTextContent('Could not load Office Budget sources');
    const reloadBtn = screen.getByRole('button', { name: 'Reload funding sources' });
    expect(reloadBtn.className).toContain('pf-funding-reload-btn');

    fireEvent.click(reloadBtn);
    expect(await screen.findByText('Reloading Office Budget sources…')).toBeVisible();

    resolveReload({
      orgId: 'org-1',
      canAuthorize: true,
      hasEligibleAccountingStaff: true,
      sources: [{ id: 's1', name: 'MOOE Supplies', year, available: 500000 }],
    });

    expect(await screen.findByLabelText('Office Budget source')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reload sources' })).toBeEnabled();
  });

  it('lets Head select project team immediately on Step 06 Add people without blocking gates and preserves selections across all tabs and Review', async () => {
    const profiles = [
      { id: 'head-1', full_name: 'Office Head', email: 'head@office.test', role: 'head', org_id: 'org-1', is_active: true },
      { id: 'mem-1', full_name: 'Alice Cruz', email: 'alice@office.test', role: 'member', org_id: 'org-1', is_active: true },
      { id: 'mem-2', full_name: 'Marco Reyes', email: 'marco@office.test', role: 'member', org_id: 'org-1', is_active: true },
    ] as any;
    const organizations = [{ id: 'org-1', name: 'Operations', head_user_id: 'head-1' }] as any;

    render(
      <ProjectSetupWizard
        recoveryKey="qa-draft-people"
        creatorId="head-1"
        createDraft={vi.fn()}
        profiles={profiles}
        organizations={organizations}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    // Jump directly from blank Step 01 to Step 06 Add people
    fireEvent.click(screen.getByRole('button', { name: /06.*Add people/ }));
    expect(screen.queryByText(/Complete earlier tabs to add your project team/i)).toBeNull();
    expect(screen.getByLabelText('Include Office Head')).toBeChecked();
    expect(screen.getByLabelText('Include Office Head')).toBeDisabled();

    // Filter via search & select Alice Cruz
    fireEvent.change(screen.getByLabelText('Search Office members'), { target: { value: 'Alice' } });
    expect(screen.queryByLabelText('Include Marco Reyes')).toBeNull();
    fireEvent.click(screen.getByLabelText('Include Alice Cruz'));
    expect(screen.getByLabelText('Include Alice Cruz')).toBeChecked();

    // Jump to Step 07 Draft tasks -> Step 05 Review -> back to Step 06 Add people
    fireEvent.click(screen.getByRole('button', { name: /07.*Draft tasks/ }));
    fireEvent.click(screen.getByRole('button', { name: /05.*Review/ }));
    expect(screen.getByText(/2 members selected \(Office Head, Alice Cruz\)/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /06.*Add people/ }));
    expect(screen.getByLabelText('Include Alice Cruz')).toBeChecked();
    expect(screen.getByLabelText('Include Marco Reyes')).not.toBeChecked();
  });

  it('shows a clear permission notice instead of a setup blocker on Step 06 Add people for non-Head creators', () => {
    const profiles = [
      { id: 'head-1', full_name: 'Office Head', email: 'head@office.test', role: 'head', org_id: 'org-1', is_active: true },
      { id: 'mem-1', full_name: 'Alice Cruz', email: 'alice@office.test', role: 'member', org_id: 'org-1', is_active: true },
    ] as any;
    const organizations = [{ id: 'org-1', name: 'Operations', head_user_id: 'head-1' }] as any;

    render(
      <ProjectSetupWizard
        recoveryKey="qa-draft-people-non-head"
        creatorId="mem-1"
        createDraft={vi.fn()}
        profiles={profiles}
        organizations={organizations}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /06.*Add people/ }));
    expect(screen.queryByText(/Complete earlier tabs to add your project team/i)).toBeNull();
    expect(screen.getByText(/Only the appointed Office Head can choose the project team/i)).toBeVisible();
    expect(screen.queryByLabelText('Include Alice Cruz')).toBeNull();
  });
});
