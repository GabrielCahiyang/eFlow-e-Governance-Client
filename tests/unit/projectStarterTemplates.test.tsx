// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  saveTemplate: vi.fn(),
  retireTemplate: vi.fn(),
  confirm: vi.fn(),
  flowData: {
    project: {
      id: 'proj-1',
      title: 'Community Cleanup',
      description: 'Neighborhood cleanup plan',
      scope: 'Clean three barangay zones',
      project_lead_id: 'lead-1',
      start_date: '2026-11-16',
      target_date: '2026-12-01',
      funding_not_required: false,
      updated_at: '2026-11-15T00:00:00Z',
    },
    ready: false,
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
  },
}));

vi.mock('../../src/app/features/work-templates/projectTaskTemplates', async () => {
  const actual = await vi.importActual<typeof import('../../src/app/features/work-templates/projectTaskTemplates')>(
    '../../src/app/features/work-templates/projectTaskTemplates',
  );
  return {
    ...actual,
    listProjectTaskTemplates: api.listTemplates,
    saveProjectTaskTemplate: api.saveTemplate,
    retireProjectTaskTemplate: api.retireTemplate,
  };
});

vi.mock('../../src/app/components/ui/useConfirmation', () => ({
  useConfirmation: () => ({ confirm: api.confirm }),
}));

vi.mock('../../src/app/features/project-setup/useProjectFlow', () => ({
  useProjectFlow: () => ({ data: api.flowData, reload: vi.fn(), error: '' }),
}));

vi.mock('../../src/app/features/project-setup/services/projectFlow', () => ({
  projectFlowCall: vi.fn(),
  readProjectFlow: vi.fn(async () => api.flowData),
  ProjectFlowError: class extends Error {},
}));

vi.mock('../../src/app/shared/navigationGuard', () => ({
  useNavigationBlocker: vi.fn(),
  requestNavigation: async (action: () => void) => {
    action();
    return true;
  },
}));

import { ProjectTaskTemplateLibrary } from '../../src/app/features/work-templates';
import { ProjectSetupWizard } from '../../src/app/features/project-setup/components/ProjectSetupWizard';
import { ProjectTaskDraftStep } from '../../src/app/features/project-setup/components/ProjectTaskDraftStep';
import { ProjectWorkspaceActions } from '../../src/app/features/projects/components/ProjectWorkspaceActions';

vi.setConfig({ testTimeout: 15000 });

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  api.confirm.mockResolvedValue(true);
  api.listTemplates.mockResolvedValue([
    {
      id: 'tpl-1',
      name: 'Community outreach',
      groups: [
        { title: 'Preparation', tasks: [{ title: 'Coordinate barangay permits', subtasks: ['Draft letter'] }] },
      ],
    },
  ]);
  api.saveTemplate.mockImplementation(async (name: string, groups: any[]) => ({
    id: 'tpl-new',
    name,
    groups,
  }));
});

afterEach(cleanup);

describe('Project starter templates workflow', () => {
  it('renders starter templates without pills, supports visual subtasks and duplicate creation', async () => {
    const onTemplatesChanged = vi.fn();
    const { container } = render(<ProjectTaskTemplateLibrary onTemplatesChanged={onTemplatesChanged} />);

    await screen.findByText('Community outreach');
    expect(screen.getByText('1 group')).toBeInTheDocument();
    expect(screen.getByText('1 task')).toBeInTheDocument();
    expect(screen.getByText('1 subtask')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('rounded-full');

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByDisplayValue('Community outreach (copy)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add subtask' }));
    const subInput = screen.getByLabelText('Subtask 2 for Coordinate barangay permits');
    fireEvent.change(subInput, { target: { value: 'Confirm schedule' } });

    api.listTemplates.mockResolvedValueOnce([
      {
        id: 'tpl-new',
        name: 'Community outreach (copy)',
        groups: [
          {
            title: 'Preparation',
            tasks: [{ title: 'Coordinate barangay permits', subtasks: ['Draft letter', 'Confirm schedule'] }],
          },
        ],
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() => {
      expect(api.saveTemplate).toHaveBeenCalledWith(
        'Community outreach (copy)',
        [
          {
            title: 'Preparation',
            tasks: [{ title: 'Coordinate barangay permits', subtasks: ['Draft letter', 'Confirm schedule'] }],
          },
        ],
        undefined,
      );
      expect(onTemplatesChanged).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tpl-new', name: 'Community outreach (copy)' }),
      );
    });
  });

  it('shows retry UI on Step 1 template load error and updates right-pane preview when selecting or creating inline', async () => {
    api.listTemplates.mockRejectedValueOnce(new Error('Network down'));

    render(
      <ProjectSetupWizard
        recoveryKey="test-starter-wizard"
        profiles={[]}
        createDraft={vi.fn()}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    expect(await screen.findByText('Could not load starter templates')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Community outreach' })).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Project type/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'tpl-1' } });
    expect(screen.getByText('STARTER TEMPLATE PREVIEW')).toBeInTheDocument();
    expect(screen.getByText('Coordinate barangay permits')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ New / Manage templates' }));
    expect(await screen.findByText('Project starter templates')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New template' }));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Field Assessment' } });
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Site Visit' } });
    fireEvent.change(screen.getByLabelText('Task 1'), { target: { value: 'Inspect facility' } });

    const created = {
      id: 'tpl-created',
      name: 'Field Assessment',
      groups: [{ title: 'Site Visit', tasks: [{ title: 'Inspect facility', subtasks: [] }] }],
    };
    api.saveTemplate.mockResolvedValueOnce(created);
    api.listTemplates.mockResolvedValue([created]);

    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Project type/i)).toHaveValue('tpl-created');
    });
    expect(screen.getByText('Inspect facility')).toBeInTheDocument();
  });

  it('allows saving selected draft tasks as a starter template in Step 7', async () => {
    const onTemplateSaved = vi.fn();
    render(
      <ProjectTaskDraftStep
        projectId="proj-1"
        project={{ title: 'Health Fair', description: 'Desc', scope: 'Scope' }}
        templates={[
          {
            id: 'tpl-1',
            name: 'Community outreach',
            groups: [{ title: 'Logistics', tasks: [{ title: 'Book tables', subtasks: ['Confirm vendor'] }] }],
          },
        ]}
        templateError=""
        initialTemplate={{
          id: 'tpl-1',
          name: 'Community outreach',
          groups: [{ title: 'Logistics', tasks: [{ title: 'Book tables', subtasks: ['Confirm vendor'] }] }],
        }}
        onTemplateSaved={onTemplateSaved}
        onSaved={vi.fn()}
        onBusyChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save as template' }));
    const nameInput = screen.getByLabelText('New starter template name');
    fireEvent.change(nameInput, { target: { value: 'Health Fair Starter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save starter template' }));

    await waitFor(() => {
      expect(api.saveTemplate).toHaveBeenCalledWith('Health Fair Starter', [
        { title: 'Logistics', tasks: [{ title: 'Book tables', subtasks: ['Confirm vendor'] }] },
      ]);
      expect(onTemplateSaved).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tpl-new', name: 'Health Fair Starter' }),
      );
      expect(screen.getByText('Saved “Health Fair Starter” to starter templates.')).toBeInTheDocument();
    });
  });

  it('keeps one Templates button and offers AI creation without standalone PDF import', async () => {
    const onTemplates = vi.fn();
    const onCreateWithAi = vi.fn();
    const actions = {
      onCreate: vi.fn(), onCreateWithAi, onTemplates, onSavedPlans: vi.fn(),
      onAllProjects: vi.fn(),
    };
    const { rerender } = render(<ProjectWorkspaceActions canCreate {...actions} />);

    const templates = screen.getByRole('button', { name: 'Templates' });
    expect(screen.queryByRole('button', { name: 'Import AI PDF' })).not.toBeInTheDocument();
    fireEvent.click(templates);
    expect(onTemplates).toHaveBeenCalledTimes(1);
    const menu = screen.getByRole('button', { name: '+ New' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(screen.queryByRole('menuitem', { name: 'Template library' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Import AI PDF' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create project with AI' }));
    await waitFor(() => expect(onCreateWithAi).toHaveBeenCalledTimes(1));

    rerender(<ProjectWorkspaceActions canCreate={false} {...actions} />);
    expect(screen.queryByRole('button', { name: '+ New' })).not.toBeInTheDocument();
  });
});
