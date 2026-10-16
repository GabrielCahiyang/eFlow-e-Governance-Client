// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {ProductivitySidebar} from '../../src/app/features/app-shell/components/ProductivitySidebar';
import {buildShellNavigation} from '../../src/app/features/navigation';
import {EflowVibeThemeProvider} from '../../src/app/shared/vibe';
import {readContextDestination} from '../../src/app/features/app-shell/useContextDestinations';
import {buildWorkspaceNavigation} from '../../src/app/features/workspaces';
const items=buildShellNavigation({role:'head',can:()=>true,hasLeadingWork:true});
Object.defineProperty(window,'matchMedia',{writable:true,value:()=>({matches:false,addEventListener(){},removeEventListener(){}})});
afterEach(()=>{cleanup();localStorage.clear();window.history.replaceState({},'','/');});
function sidebar(section:string,page:string,onPageSelect=vi.fn(),user='head'){
 return <EflowVibeThemeProvider preference="light"><ProductivitySidebar role="head" activeSection={section} activePage={page} navigationItems={items} onPageSelect={onPageSelect} userId={user} workspaceId="office" workspaceName="LEDIPO" projects={[{id:'p',title:'Project tree entry',status:'planning'}]}/></EflowVibeThemeProvider>;
}
describe('approved primary/context isolation',()=>{
 it('keeps a granted Office calendar handoff reachable from the global My Work feed in a personal workspace',()=>{
  const authorized=buildShellNavigation({role:'member',can:()=>true,hasLeadingWork:true});
  const scoped=buildWorkspaceNavigation(authorized,true,false), select=vi.fn();
  render(<EflowVibeThemeProvider preference="light"><ProductivitySidebar role="member" activeSection="personal_work" activePage="Assigned work" navigationItems={scoped} personalToolItems={authorized} onPageSelect={select} workspaceKind="personal" /></EflowVibeThemeProvider>);
  fireEvent.click(screen.getByText('More work tools'));fireEvent.click(screen.getByRole('button',{name:'Deadline calendar',exact:true}));
  expect(select).toHaveBeenCalledWith('deadlines','Deadlines');
  expect(screen.queryByRole('button',{name:'Office Budget',exact:true})).toBeNull();
 });
 it('identifies only the current authorized legacy tool without exposing all retained routes',()=>{
  const memberItems=buildShellNavigation({role:'member',can:()=>true,hasLeadingWork:true});
  const legacy=memberItems.find(item=>item.id==='deadlines')!;
  const view=render(<EflowVibeThemeProvider preference="light"><ProductivitySidebar role="member" activeSection="deadlines" activePage={legacy.pages[0].label} navigationItems={memberItems} onPageSelect={vi.fn()} /></EflowVibeThemeProvider>);
  const work=screen.getByRole('navigation',{name:'My Work destinations'});
  expect(within(work).getAllByRole('button').filter(button=>!button.closest('details'))).toHaveLength(5);
  expect(work.querySelector('details')?.hasAttribute('open')).toBe(false);
  expect(within(work).getByRole('button',{name:legacy.label}).getAttribute('aria-current')).toBe('page');
  view.rerender(<EflowVibeThemeProvider preference="light"><ProductivitySidebar role="member" activeSection="personal_work" activePage="Assigned work" navigationItems={memberItems} onPageSelect={vi.fn()} /></EflowVibeThemeProvider>);
  expect(within(screen.getByRole('navigation',{name:'My Work destinations'})).getAllByRole('button').filter(button=>!button.closest('details'))).toHaveLength(4);
  expect(screen.queryByText('Current tool')).toBeNull();
 });
 it('retains existing authorized Inbox destinations when a personal workspace is selected',()=>{
  const personal=buildWorkspaceNavigation(items,true,false);expect(personal.filter(item=>item.group==='inbox').map(item=>item.id)).toEqual(items.filter(item=>item.group==='inbox').map(item=>item.id));expect(personal.filter(item=>item.group==='workspaces').map(item=>item.id)).toEqual(['dashboard','projects']);
 });
 it('rejects corrupted or revoked remembered routes and strips parameters belonging to another context',()=>{
  const key='eflow:context:v1:head:my-work';localStorage.setItem(key,JSON.stringify({version:1,section:'projects',page:'Projects'}));expect(readContextDestination('head','my-work','head',items)).toBeUndefined();
  localStorage.setItem(key,JSON.stringify({version:1,section:'personal_work',page:'Leading',parameters:{q:'keep',project:'foreign',task:'privileged',token:'privileged'}}));expect(readContextDestination('head','my-work','head',items)?.parameters).toEqual({q:'keep'});expect(readContextDestination('head','my-work','head',items.filter(item=>item.id!=='personal_work'))).toBeUndefined();expect(readContextDestination('another','my-work','head',items)).toBeUndefined();
 });
 it('replaces workspace sections immediately with My Work then Inbox while keeping the primary rail',()=>{
  const view=render(sidebar('projects','Projects'));expect(screen.getByRole('region',{name:'Workspace content'})).toBeTruthy();expect(screen.getByRole('button',{name:'Project tree entry'})).toBeTruthy();
  view.rerender(sidebar('personal_work','Leading'));const work=screen.getByRole('region',{name:'My Work content'});
  for(const name of ['Assigned work','Leading','Subtasks','History'])expect(within(work).getByRole('button',{name,exact:true})).toBeTruthy();
  for(const name of ['Workspace content','Office tools','Favorites','Projects','Archived projects'])expect(screen.queryByRole('region',{name,exact:true})).toBeNull();expect(screen.queryByRole('button',{name:'LEDIPO Workspace'})).toBeNull();
  view.rerender(sidebar('inbox','Updates'));const inbox=screen.getByRole('region',{name:'Inbox content'});expect(within(inbox).getByRole('button',{name:'Updates',exact:true}).getAttribute('aria-current')).toBe('page');expect(screen.queryByRole('region',{name:'My Work content'})).toBeNull();expect(screen.getByRole('navigation',{name:'Global navigation'})).toBeTruthy();expect(within(inbox).queryByRole('button',{name:'Inbox',exact:true})).toBeNull();
 });
 it('restores the accepted My Work subdestination/filters and scopes memories to the account',()=>{
  const select=vi.fn();window.history.replaceState({},'','/my-work?page=History&q=kept&date=All+my+work');const view=render(sidebar('personal_work','History',select));
  window.history.replaceState({},'','/inbox?page=Updates');view.rerender(sidebar('inbox','Updates',select));fireEvent.click(within(screen.getByRole('navigation',{name:'Global navigation'})).getByRole('button',{name:'My Work',exact:true}));
  expect(select).toHaveBeenLastCalledWith('personal_work','History',undefined,expect.objectContaining({workspaceId:'office',parameters:expect.objectContaining({q:'kept',date:'All my work'})}));
  view.rerender(sidebar('inbox','Updates',select,'another'));fireEvent.click(within(screen.getByRole('navigation',{name:'Global navigation'})).getByRole('button',{name:'My Work',exact:true}));expect(select).toHaveBeenLastCalledWith('personal_work','Assigned work');
 });
 it('keeps collapse preferences isolated between contexts and restores workspace state',()=>{
  const view=render(sidebar('projects','Projects'));fireEvent.click(screen.getByRole('button',{name:'Collapse workspace sidebar'}));expect(screen.queryByRole('button',{name:'LEDIPO Workspace'})).toBeNull();
  view.rerender(sidebar('personal_work','Assigned work'));expect(screen.getByRole('button',{name:'Leading',exact:true})).toBeTruthy();view.rerender(sidebar('projects','Projects'));expect(screen.getByRole('button',{name:'Restore workspace sidebar'})).toBeTruthy();
 });
});
