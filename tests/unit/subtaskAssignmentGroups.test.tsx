// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'task-lead'}})}));
import {groupWorkAssignmentPeople,workAssignmentPriority} from '../../src/app/features/nested-work/selectors/people';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
import {WorkPeoplePicker} from '../../src/app/features/nested-work/components/WorkPeoplePicker';
import {WorkTreeEditor} from '../../src/app/features/nested-work/components/WorkTreeEditor';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work/types';

const allowed={allowed:true,reason_code:null,disabledReason:null} as const;
function snapshot():WorkTreeSnapshot {
 const data:WorkTreeSnapshot={root:{id:'task',project:'project',office:'office',kind:'office',lead:'task-lead',people:['task-lead','task-worker','expired'],open:true,due:'2026-12-31',capabilities:{create_child:allowed}},
  revision:1,can_manage:true,can_transfer:true,leaf_total:1,leaf_completed:0,
  people:[{id:'specialist',name:'Ada Specialist',eligible:true},{id:'parent-lead',name:'Parent Lead',eligible:true},{id:'task-worker',name:'Task Contributor',eligible:true},{id:'task-lead',name:'Task Lead',eligible:true},{id:'expired',name:'Expired Contributor',eligible:false},{id:'observer',name:'Observer'}],
  nodes:[{id:'parent',task_id:'task',parent_subtask_id:null,lead_id:'parent-lead',assigned_to_ids:['parent-lead','specialist'],title:'Parent step',depth:1,sibling_order:0,due_date:'2026-12-31',is_standalone:true,status:'todo',percent_complete:0,can_manage:true,can_appoint:true,can_order:true,can_work:false,can_review:false,capabilities:{create_child:allowed}}]};
 rememberWorkCapabilityContext(data,'task-lead');return data;
}
beforeEach(()=>{sessionStorage.clear();vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));});
afterEach(()=>{cleanup();sessionStorage.clear();vi.useRealTimers();});

describe('subtask assignment ranking',()=>{
 it('includes only eligible task people without promoting expired, unverified, or other members',()=>{
  const data=snapshot(),before=structuredClone(data);
  const groups=groupWorkAssignmentPeople([...data.people,{id:'specialist',name:'Expired duplicate',eligible:false}],workAssignmentPriority(data,null));
  expect(groups.map(group=>[group.label,group.people.map(person=>person.id)])).toEqual([
   ['On this task',['task-worker','task-lead']],
  ]);
  expect(data).toEqual(before);
 });
 it('uses only the immediate parent team and searches within that group',()=>{
  const data=snapshot(),priority=workAssignmentPriority(data,'parent');
  expect(priority).toEqual({label:'On parent subtask',ids:['parent-lead','specialist']});
  expect(groupWorkAssignmentPeople(data.people,priority).map(group=>group.people.map(person=>person.id))).toEqual([['specialist','parent-lead']]);
  expect(groupWorkAssignmentPeople(data.people,priority,'  ADA  ')[0].people.map(person=>person.id)).toEqual(['specialist']);
  expect(groupWorkAssignmentPeople(data.people,priority,'  TASK  ')[0].people).toEqual([]);
  expect(workAssignmentPriority(data,'missing').ids).toEqual([]);
 });
 it('shows only task-assigned members in both fields and keeps selection explicit',()=>{
  const data=snapshot(),onLead=vi.fn(),onSelected=vi.fn();
  render(<WorkPeoplePicker people={data.people} priority={workAssignmentPriority(data,null)} lead="" selected={[]} onLead={onLead} onSelected={onSelected} appointmentCapability={allowed} contributorCapability={allowed}/>);
  const lead=screen.getByRole('combobox',{name:'Appointed Lead'});
  expect(within(lead).getAllByRole('group').map(group=>group.getAttribute('label'))).toEqual(['On this task']);
  expect(within(lead).queryByRole('option',{name:'Parent Lead'})).toBeNull();
  expect(screen.getAllByRole('group',{name:'On this task'})).toHaveLength(2);
  expect(screen.queryByRole('group',{name:'Other eligible members'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Add contributor Ada Specialist'})).toBeNull();
  expect(onLead).not.toHaveBeenCalled();expect(onSelected).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('searchbox',{name:'Find a lead'}),{target:{value:'lead'}});
  expect(within(lead).queryByRole('option',{name:'Task Contributor'})).toBeNull();
  fireEvent.change(lead,{target:{value:'task-lead'}});
  expect(onLead).toHaveBeenCalledExactlyOnceWith('task-lead');
  fireEvent.change(screen.getByRole('searchbox',{name:'Find people'}),{target:{value:'  CONTRIBUTOR  '}});
  fireEvent.click(screen.getByRole('button',{name:'Add contributor Task Contributor'}));
  expect(onSelected).toHaveBeenLastCalledWith(['task-worker']);
  expect(screen.queryByRole('button',{name:'Add contributor Expired Contributor'})).toBeNull();
 });
 it('keeps the appointed lead selected when a search hides their group',()=>{
  const data=snapshot();
  render(<WorkPeoplePicker people={data.people} priority={workAssignmentPriority(data,null)} lead="task-lead" selected={['task-lead']} onLead={vi.fn()} onSelected={vi.fn()} appointmentCapability={allowed} contributorCapability={allowed}/>);
  fireEvent.change(screen.getByRole('searchbox',{name:'Find a lead'}),{target:{value:'nobody'}});
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('task-lead');
  expect(screen.queryByRole('button',{name:'Add contributor Task Lead'})).toBeNull();
 });
 it.each([undefined,'parent'])('creates work under %s using only assigned team members without changing the parent team',async parent=>{
  const data=snapshot(),before=structuredClone(data),save=vi.fn().mockResolvedValue(data);
  render(<WorkTreeEditor data={data} edit={{command:'create',parent}} save={save} onDone={vi.fn()} onCancel={vi.fn()}/>);
  expect((screen.getByRole('combobox',{name:'Appointed Lead'}) as HTMLSelectElement).value).toBe('');
  expect(screen.queryByRole('button',{name:/Remove contributor/})).toBeNull();
  expect(screen.getAllByRole('group',{name:parent?'On parent subtask':'On this task'})).toHaveLength(2);
  expect(screen.queryByRole('group',{name:'Other eligible members'})).toBeNull();
  const chosenLead=parent?'specialist':'task-worker';
  fireEvent.change(screen.getByLabelText('Subtask title'),{target:{value:'Team review'}});
  fireEvent.change(screen.getByRole('combobox',{name:'Appointed Lead'}),{target:{value:chosenLead}});
  fireEvent.click(screen.getByRole('button',{name:'Add subtask',exact:true}));
  await waitFor(()=>expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toMatchObject({command:'create',payload:{parent:parent||null,lead:chosenLead,people:[chosenLead]}});
  expect(data).toEqual(before);
 });
});
