// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {headOverview} from '../../src/app/features/personal-work/selectors/headOverview';
import {HeadWorkspaceDashboard} from '../../src/app/features/personal-work/components/head-overview/HeadWorkspaceDashboard';
import type {WorkRow,WorkSnapshot} from '../../src/app/features/personal-work/types';
const now=new Date('2026-10-17T04:00:00Z');
function row(id:string,patch:Partial<WorkRow>={}):WorkRow{return {key:`office-task:${id}`,id,rootId:id,title:id,kind:'office-task',projectId:'p',projectTitle:'Community assessment',workspaceName:'LEDIPO',timezone:'Asia/Manila',status:'todo',progress:0,mine:false,leading:false,actionable:true,history:false,relation:'Office work',...patch};}
function snapshot():WorkSnapshot{return {rows:[row('Late task',{due:'2026-10-16'}),row('Review task',{status:'for_review',due:'2026-10-20',updatedAt:now.getTime()-3600000}),row('Completed task',{status:'completed',history:true,progress:100}),row('Child',{kind:'office-node',due:'2026-10-16'}),row('Cancelled',{status:'cancelled'})],projects:[{id:'p',title:'Community assessment',status:'active',kind:'office',home_workspace_id:'o',workspace_name:'LEDIPO',timezone:'Asia/Manila'}],workspaces:[],issues:[],unavailable:[],loadedAt:now.getTime()};}
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('Head workspace dashboard',()=>{
 it('counts root tasks once and measures completion against all non-cancelled project tasks',()=>{
  const model=headOverview(snapshot(),now);
  expect(model.open).toHaveLength(2);expect(model.attention.overdue.map(r=>r.id)).toEqual(['Late task']);
  expect(model.attention.review).toHaveLength(1);expect(model.projects[0]).toMatchObject({total:3,done:1,percent:33,overdue:1,review:1});
  expect(model.latest.map(r=>r.id)).toEqual(['Review task']);
 });
 it('uses local calendar days for deadlines and excludes personal work and archived tasks',()=>{
  const data=snapshot();data.rows.push(row('Today',{due:'2026-10-16T16:30:00Z'}),row('Private',{kind:'personal-task'}),row('Archived',{task:{archivedAt:1} as WorkRow['task']}));
  const model=headOverview(data,now);expect(model.attention.overdue.map(r=>r.id)).not.toContain('Today');expect(model.attention.upcoming.map(r=>r.id)).toContain('Today');expect(model.open).toHaveLength(3);
 });
 it('respects an optional due time that has already passed today',()=>{
  const data=snapshot();data.rows.push(row('Timed task',{due:'2026-10-17T11:00:00+08:00',task:{deadline:'2026-10-17T11:00:00+08:00',createdAt:now.getTime()} as WorkRow['task']}));
  const model=headOverview(data,now);expect(model.attention.overdue.map(row=>row.id)).toContain('Timed task');expect(model.attention.upcoming.map(row=>row.id)).not.toContain('Timed task');
 });
 it('opens the actual project, reports and task behind each summary',()=>{
  const onNavigate=vi.fn(),onOpen=vi.fn();render(<HeadWorkspaceDashboard name="LEDIPO" data={snapshot()} loading={false} onRefresh={vi.fn()} onNavigate={onNavigate} onOpen={onOpen} canReports/>);
  expect(screen.getByRole('heading',{name:'Office dashboard'})).toBeVisible();
  fireEvent.click(within(screen.getByRole('region',{name:'Project progress'})).getByRole('button',{name:/Community assessment/}));expect(onNavigate).toHaveBeenCalledWith('projects','Projects','p');
  fireEvent.click(screen.getByRole('button',{name:/Open reports/}));expect(onNavigate).toHaveBeenCalledWith('reports','Reports');
  const attention=screen.getByRole('region',{name:'Tasks needing attention'});fireEvent.click(within(attention).getByRole('button',{name:/Late task/}));expect(onOpen.mock.calls[0][0].id).toBe('Late task');
  fireEvent.click(within(attention).getByRole('button',{name:/Awaiting review/}));expect(within(attention).getByRole('button',{name:/Review task/})).toBeVisible();
 });
 it('does not present partial coverage as zero or reliable project progress',()=>{
  const data=snapshot();data.issues=['One source failed'];render(<HeadWorkspaceDashboard name="LEDIPO" data={data} loading={false} onRefresh={vi.fn()} onNavigate={vi.fn()} onOpen={vi.fn()} canReports={false}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('Some work couldn’t be loaded');expect(screen.getAllByText('—')).toHaveLength(4);expect(screen.queryByText('33%')).toBeNull();expect(screen.getByText('Progress unavailable')).toBeVisible();expect(screen.queryByRole('button',{name:/Open reports/})).toBeNull();
 });
 it('uses skeletons before data arrives and helpful empty states once an empty result is verified',()=>{
  const props={name:'LEDIPO',onRefresh:vi.fn(),onNavigate:vi.fn(),onOpen:vi.fn(),canReports:true};const view=render(<HeadWorkspaceDashboard {...props} loading/>);
  expect(screen.getAllByRole('status',{name:'Loading dashboard data'}).length).toBeGreaterThan(0);expect(screen.queryByText('No active projects yet')).toBeNull();
  view.rerender(<HeadWorkspaceDashboard {...props} loading={false} data={{...snapshot(),rows:[],projects:[]}}/>);expect(screen.getByText('No active projects yet')).toBeVisible();expect(screen.getByText('No overdue tasks')).toBeVisible();
 });
});
