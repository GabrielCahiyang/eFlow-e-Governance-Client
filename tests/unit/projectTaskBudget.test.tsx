// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {Task} from '../../src/app/features/tasks';
const state=vi.hoisted(()=>({role:'head',appointed:true,allocations:[] as Array<Record<string,unknown>>,loading:false}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({userProfile:{id:'head',role:state.role,org_id:'office',is_active:true}})}));
vi.mock('../../src/app/hooks/useSupabaseData',()=>({useOrgs:()=>({orgs:[{id:'office',head_user_id:state.appointed?'head':'replacement'}]})}));
vi.mock('../../src/app/features/budget/hooks/useDepartmentBudget',()=>({useDepartmentBudget:()=>({summary:{status:'locked'},allocations:state.allocations,loading:state.loading,error:'',refresh:vi.fn()})}));
vi.mock('../../src/app/features/budget/components/DirectWorkFunding',()=>({DirectWorkFunding:()=> <><input aria-label="Funding reason" defaultValue=""/><button>Authorize work funding</button></>}));
import {ProjectTaskBudgetCell,ProjectTaskBudgetProvider,useProjectTaskBudgetTotal} from '../../src/app/features/budget/components/ProjectTaskBudget';
const task={id:'task',title:'QA supplies',orgId:'office',status:'todo',budgetImpact:9999} as Task;
function Total(){const total=useProjectTaskBudgetTotal(['task']);return <output aria-label="Authorized group budget">{total}</output>;}
function View({readOnly=false}:{readOnly?:boolean}){return <ProjectTaskBudgetProvider officeId="office"><ProjectTaskBudgetCell task={task} readOnly={readOnly}/><Total/></ProjectTaskBudgetProvider>;}
beforeEach(()=>{state.role='head';state.appointed=true;state.allocations=[];state.loading=false;});afterEach(cleanup);
it('shows actual authorized funds and totals without counting child caps or draft estimates twice',()=>{
 state.allocations=[{taskId:'task',amount:2000,status:'approved'},{taskId:'task',subtaskId:'child',amount:500,status:'approved'},{taskId:'task',amount:999,status:'pending'},{taskId:'other',amount:3000,status:'approved'}];
 render(<View/>);expect(screen.getByRole('button',{name:'Budget for QA supplies'}).textContent).toContain('2,000');expect(screen.getByLabelText('Authorized group budget').textContent).toBe('2000');
 fireEvent.click(screen.getByRole('button',{name:'Budget for QA supplies'}));expect(screen.queryByRole('button',{name:'Authorize work funding'})).toBeNull();expect(screen.getByText(/already reserved/)).toBeTruthy();
});
it('lets the appointed Head set an unfunded budget through the existing authorization flow',()=>{
 render(<View/>);fireEvent.click(screen.getByRole('button',{name:'Budget for QA supplies'}));expect(screen.getByRole('button',{name:'Authorize work funding'})).toBeTruthy();expect(screen.getByLabelText('Authorized group budget').textContent).toBe('0');
});
it('retains the open funding draft while refreshed authority temporarily disables submission',()=>{
 const view=render(<View/>);fireEvent.click(screen.getByRole('button',{name:'Budget for QA supplies'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Funding reason'}),{target:{value:'QA verified plan'}});
 state.loading=true;view.rerender(<View/>);
 expect(screen.getByRole('textbox',{name:'Funding reason'})).toHaveProperty('value','QA verified plan');
 expect(screen.getByRole('button',{name:'Authorize work funding'}).closest('fieldset')?.disabled).toBe(true);
 state.loading=false;view.rerender(<View/>);
 expect(screen.getByRole('textbox',{name:'Funding reason'})).toHaveProperty('value','QA verified plan');
 expect(screen.getByRole('button',{name:'Authorize work funding'}).closest('fieldset')?.disabled).toBe(false);
});
it.each(['member','revoked','history'])('withholds funding authorization for %s',mode=>{
 if(mode==='member')state.role='member';if(mode==='revoked')state.appointed=false;
 render(<View readOnly={mode==='history'}/>);fireEvent.click(screen.getByRole('button',{name:'Budget for QA supplies'}));expect(screen.queryByRole('button',{name:'Authorize work funding'})).toBeNull();
});
