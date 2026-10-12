// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import type { Subtask } from '../../src/app/features/subtasks';
import type { UserProfile } from '../../src/app/types';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), refresh: vi.fn(), open: vi.fn(), openSubitem: vi.fn(),
  officeState: { offices: [] as Record<string, unknown>[], members: [], error: '' },
}));
vi.mock('../../src/app/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer' }, userProfile: { id: 'viewer', role: 'head', org_id: 'office' } }) }));
vi.mock('../../src/app/features/subtasks', async () => {
  const { parentTaskDueDate } = await import('../../src/app/features/subtasks/selectors/deadlines');
  return { createSubtask: mocks.create, updateSubtask: mocks.update, parentTaskDueDate };
});
vi.mock('../../src/app/features/tasks', async () => {
  const { getTaskLeadId, getTaskTeamMemberIds } = await import('../../src/app/features/tasks/selectors/teamMembership');
  const { isTaskLead } = await import('../../src/app/features/tasks/selectors/leadership');
  return { getTaskLeadId, getTaskTeamMemberIds, isTaskLead, assignTask: vi.fn(), updateTaskStatus: vi.fn(), TASK_STATUS_LABELS: { todo: 'To Do', in_progress: 'In Progress', for_review: 'For Review', completed: 'Completed', cancelled: 'Cancelled' } };
});
vi.mock('../../src/app/features/project-offices', () => ({ useProjectOfficeContext: () => mocks.officeState, canHandoverTask: () => false, projectOfficePeople: () => [], setResponsibleOffice: vi.fn(), moveProjectOfficeTask: vi.fn() }));
vi.mock('../../src/app/features/project-table/services/workspaceService', () => ({ patchWorkspaceTask: vi.fn() }));
vi.mock('../../src/app/features/project-table/components/PlanningCells', () => ({ TimelineCell: () => null, DependencyCell: () => null, NumberCell: () => null }));
vi.mock('../../src/app/features/staffing', () => ({ StaffingDialog: () => null }));

import { ProjectTaskRow } from '../../src/app/features/project-table/components/ProjectTaskRow';

const task: Task = { id: 'task', title: 'Prepare assessment', orgId: 'office', assigneeId: 'viewer', status: 'todo', deadline: '2026-10-12', createdAt: 1, updatedAt: 1 };
const subtask = (patch: Partial<Subtask> = {}): Subtask => ({ id: 'subitem', taskId: task.id, title: 'Gather evidence', status: 'todo', isCompleted: false, percentComplete: 0, assignedToIds: ['lead'], position: 3, isStandalone: false, source: 'manual', createdAt: 1, updatedAt: 1, ...patch });
const profiles = [{ id: 'viewer', full_name: 'Office Head' }, { id: 'lead', full_name: 'Maria Clara' }] as UserProfile[];

function show(patch: Partial<Task> = {}, subtasks: Subtask[] = []) {
  const result = render(<table><tbody><ProjectTaskRow task={{ ...task, ...patch }} tasks={[]} groups={[]} profiles={profiles} orgs={[]} columns={[]} editable userId="viewer" subtasks={subtasks} onOpen={mocks.open} onOpenSubitem={mocks.openSubitem} refreshSubitems={mocks.refresh} reorderable={false} onMove={vi.fn()} run={async fn => { await fn(); }}/></tbody></table>);
  fireEvent.click(screen.getByRole('button', { name: 'Subitems for Prepare assessment' }));
  return result;
}

beforeEach(() => { vi.clearAllMocks(); mocks.officeState.offices = []; mocks.officeState.error = ''; mocks.create.mockResolvedValue(subtask()); mocks.refresh.mockResolvedValue(undefined); });
afterEach(cleanup);

describe('Project table subitem expansion', () => {
  it('opens the legacy Task team menu directly in Work after the menu focus handoff', async () => {
    show();
    const trigger = screen.getByRole('button', { name: 'Actions for Prepare assessment' });
    trigger.focus(); fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Task team & contributors', exact: true }));
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith('work'));
    expect(mocks.open).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(trigger);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it('places task actions in the first cell and keeps detail access without drag controls', async () => {
    const { container } = show();
    const row = container.querySelector<HTMLTableRowElement>('.pt-task-row')!;
    const actions = within(row).getByRole('button', { name: 'Actions for Prepare assessment' });
    expect(row.cells[0].contains(actions)).toBe(true);
    expect(row.cells).toHaveLength(3);
    expect(within(row).queryByRole('button', { name: /^Drag / })).toBeNull();
    expect(row.querySelector('[draggable]')).toBeNull();
    fireEvent.keyDown(actions, { key: 'Enter' });
    expect((await screen.findByRole('menuitem', { name: 'Move up', exact: true })).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Task details, evidence & review' }));
    await waitFor(()=>expect(mocks.open).toHaveBeenCalledOnce());
  });

  it('keeps the first-column Add subitem action disabled for someone who is not the task lead', async () => {
    show({ assigneeId: 'lead' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for Prepare assessment' }), { key: 'Enter' });
    expect((await screen.findByRole('menuitem', { name: 'Add subitem', exact: true })).getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('textbox', { name: 'Add subitem to Prepare assessment' })).toBeNull();
  });

  it('hands menu focus to the add field when subitems are already expanded', async () => {
    show();
    const actions = screen.getByRole('button', { name: 'Actions for Prepare assessment' });
    actions.focus();
    fireEvent.keyDown(actions, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Add subitem', exact: true }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Add subitem to Prepare assessment' })));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('opens an empty nested table and saves the task lead’s subitem when focus leaves', async () => {
    show();
    const table = screen.getByRole('table', { name: 'Prepare assessment subitems' });
    expect(within(table).getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Subitem', 'Owner', 'Status', 'Due date', 'Progress']);
    const input = screen.getByRole('textbox', { name: 'Add subitem to Prepare assessment' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '  Prepare agenda  ' } });
    fireEvent.blur(input);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith('task', 'Prepare agenda', { position: 0, dueDate: '2026-10-12' });
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('lets the task lead set a due date before focus leaves the add row', async () => {
    show();
    const input = screen.getByRole('textbox', { name: 'Add subitem to Prepare assessment' });
    const date = screen.getByLabelText('Due date for new subitem to Prepare assessment');
    fireEvent.change(input, { target: { value: 'Prepare agenda' } });
    fireEvent.blur(input, { relatedTarget: date });
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(date, { target: { value: '2026-10-10' } });
    fireEvent.blur(date);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith('task', 'Prepare agenda', { position: 0, dueDate: '2026-10-10' });
  });

  it('keeps order, owners, progress, dates, and evidence drawer access', () => {
    const first = subtask({ id: 'first', title: 'First step', position: 1, dueDate: '2026-10-10', percentComplete: 40 });
    show({}, [subtask(), first]);
    const table = screen.getByRole('table', { name: 'Prepare assessment subitems' });
    expect(within(table).getAllByRole('button', { name: /^Edit subitem/ }).map(button => button.textContent)).toEqual(['First step', 'Gather evidence']);
    expect(within(table).getAllByText('Maria Clara')).toHaveLength(2);
    expect(within(table).getByText('40%')).toBeTruthy();
    expect(within(table).getByText('2026-10-10')).toBeTruthy();
    fireEvent.click(within(table).getByRole('button', { name: 'Open subitem First step' }));
    expect(mocks.openSubitem).toHaveBeenCalledWith(first,false);
  });

  it('explains why an Office Head who is not the task lead cannot add', () => {
    show({ assigneeId: 'lead' });
    expect(screen.getByText('No subitems yet.')).toBeTruthy();
    expect(screen.getByText('Only the assigned task lead (Maria Clara) can add subitems.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Add subitem to Prepare assessment' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Task details' }));
    expect(mocks.open).toHaveBeenCalledOnce();
  });

  it('explains the assignment step for tasks without a lead', () => {
    show({ assigneeId: undefined });
    expect(screen.getByText('Assign a task owner first. Only the assigned task lead can add subitems.')).toBeTruthy();
  });

  it.each(['for_review', 'completed', 'cancelled'] as const)('preserves the %s lock and keeps existing subitems readable', status => {
    show({ status }, [subtask()]);
    expect(screen.getByText(/Subitems are locked while this task is/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Edit subitem Gather evidence' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('textbox', { name: 'Add subitem to Prepare assessment' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open subitem Gather evidence' })).toBeTruthy();
  });

  it('preserves observer access even when the viewer is the assigned lead', () => {
    mocks.officeState.offices = [{ office_id: 'office', relationship_type: 'observer', invitation_status: 'joined' }];
    show();
    expect(screen.getByText('This Office has read-only access to this task.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Add subitem to Prepare assessment' })).toBeNull();
  });

  it('keeps a failed draft for retry and appends after the greatest saved position', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Could not save.'));
    show({}, [subtask()]);
    const input = screen.getByRole('textbox', { name: 'Add subitem to Prepare assessment' });
    fireEvent.change(input, { target: { value: 'Next step' } });
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Could not save.');
    expect((input as HTMLInputElement).value).toBe('Next step');
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenLastCalledWith('task', 'Next step', { position: 4, dueDate: '2026-10-12' });
  });
});


// Supported hierarchy acceptance is separate from the excluded legacy cases above.
import { WorkHierarchy, type WorkTreeSnapshot } from '../../src/app/features/nested-work';
import { rememberWorkCapabilityContext } from '../../src/app/features/nested-work/selectors/capabilities';
function hierarchySnapshot():WorkTreeSnapshot {
 const allowed={allowed:true,reason_code:null} as const;
 const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',open:true,lead:'viewer',people:['viewer'],due:null,capabilities:{create_child:allowed}},revision:3,can_manage:true,can_transfer:true,leaf_total:1,leaf_completed:0,people:[{id:'viewer',name:'Maria with a very long authorized project name',eligible:true}],nodes:Array.from({length:8},(_,index)=>({id:'node-'+index,task_id:'root',parent_subtask_id:index?'node-'+(index-1):null,lead_id:index===7?null:index===6?'historical':'viewer',assigned_to_ids:[],title:'Work '+(index+1),sibling_order:0,depth:index+1,due_date:null,is_standalone:true,status:index===7?'changes_requested':'todo',percent_complete:index===7?43:0,can_manage:true,can_work:true,can_order:true,can_appoint:true,can_review:false,capabilities:{edit_details:allowed}}))};rememberWorkCapabilityContext(data,'viewer');return data;
}
describe('NW6.4 Main Table hierarchy accessibility',()=>{
 it('renders native headers, capped deep paths and readable historical/unassigned states',()=>{
  const data=hierarchySnapshot();const action=vi.fn();const {container}=render(<WorkHierarchy snapshot={data} readOnly={false} executionBlocked={false} authorityFresh collapsedIds={new Set()} onCollapsedIdsChange={vi.fn()} onOpenNode={vi.fn()} onRequestAction={action}/>);
  const table=screen.getByRole('table',{name:'Subitem hierarchy'});expect(within(table).getAllByRole('columnheader').map(header=>header.textContent)).toEqual(['Subitem','Lead','Contributors','Status','Due','Progress','Actions']);expect(screen.queryByRole('treegrid')).toBeNull();
  expect([...container.querySelectorAll<HTMLElement>('.nw-hierarchy-title')].map(element=>element.style.getPropertyValue('--nw-indent'))).toEqual(['0','1','2','3','3','3','3','3']);expect(screen.getByLabelText('Path for Work 8').textContent).toBe(data.nodes.map(node=>node.title).join(' / '));expect(screen.getByText('Previously assigned person',{exact:false})).toBeTruthy();expect(screen.getByText('Needs reassignment',{exact:false})).toBeTruthy();expect(screen.getByText('Changes requested')).toBeTruthy();expect(within(screen.getByRole('group',{name:'Progress for Work 8'})).getByRole('progressbar',{name:'43% complete'}).getAttribute('aria-valuenow')).toBe('43');expect(action).not.toHaveBeenCalled();
 });
 it('reports controlled disclosure state and preserves the exact authorized parent',()=>{
  const data=hierarchySnapshot(),change=vi.fn(),open=vi.fn();const props={snapshot:data,readOnly:true,executionBlocked:true,authorityFresh:true,collapsedIds:new Set<string>(),onCollapsedIdsChange:change,onOpenNode:open,onRequestAction:vi.fn()};const view=render(<WorkHierarchy {...props}/>);
  const collapse=screen.getByRole('button',{name:'Collapse children of Work 1'});expect(collapse.getAttribute('aria-expanded')).toBe('true');fireEvent.click(collapse);expect([...change.mock.calls[0][0]]).toEqual(['node-0']);view.rerender(<WorkHierarchy {...props} collapsedIds={new Set(['node-0'])}/>);expect(screen.getByRole('button',{name:'Expand children of Work 1'}).getAttribute('aria-expanded')).toBe('false');expect(screen.queryByRole('button',{name:'Work 8',exact:true})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Work 1',exact:true}));expect(open).toHaveBeenCalledWith('node-0');expect(data.nodes[1].parent_subtask_id).toBe('node-0');
 });
 it('switches composition without leaving a hidden desktop table or losing disclosure state',()=>{
  let mobile=false;let notify=()=>{};const media={get matches(){return mobile;},addEventListener:(_type:string,callback:()=>void)=>{notify=callback;},removeEventListener:vi.fn()};const original=window.matchMedia;window.matchMedia=vi.fn(()=>media as unknown as MediaQueryList);
  try{const data=hierarchySnapshot();const props={snapshot:data,readOnly:true,executionBlocked:true,authorityFresh:true,collapsedIds:new Set(['node-0']),onCollapsedIdsChange:vi.fn(),onOpenNode:vi.fn(),onRequestAction:vi.fn()};const view=render(<WorkHierarchy {...props}/>);expect(screen.getByRole('table',{name:'Subitem hierarchy'})).toBeTruthy();mobile=true;act(()=>notify());view.rerender(<WorkHierarchy {...props}/>);expect(screen.queryByRole('table',{name:'Subitem hierarchy'})).toBeNull();expect(screen.getByRole('list',{name:'Subitem hierarchy'})).toBeTruthy();expect(screen.getByRole('button',{name:'Expand children of Work 1'}).getAttribute('aria-expanded')).toBe('false');expect(screen.queryByRole('button',{name:'Work 8',exact:true})).toBeNull();}finally{window.matchMedia=original;}
 });
});
