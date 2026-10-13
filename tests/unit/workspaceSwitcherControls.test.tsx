// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({create:vi.fn()}));
vi.mock('../../src/app/features/workspaces/services/workspaceService',()=>({createWorkspace:api.create}));
vi.mock('../../src/app/features/workspaces/components/WorkspaceCreateDialog',()=>({WorkspaceCreateDialog:({onClose,onCreate}:any)=><div role="dialog" aria-label="Create personal workspace"><button onClick={onClose}>Cancel</button><button onClick={()=>onCreate('request','Name','Asia/Singapore')}>Submit workspace</button></div>}));
import {WorkspaceSelector} from '../../src/app/features/workspaces/components/WorkspaceSelector';
import type {Workspace} from '../../src/app/features/workspaces/types';
afterEach(()=>{cleanup();vi.clearAllMocks();window.history.replaceState({},'','/');});
const workspace={id:'office',name:'LEDIPO',kind:'office',office_id:'office',owner_id:null} as unknown as Workspace;
function selector(overrides:Partial<Parameters<typeof WorkspaceSelector>[0]>={}){return <WorkspaceSelector name="LEDIPO" currentId="office" workspaces={[workspace]} recent={['office']} userId="actor" ownerName="Actor" loading={false} available onSelect={vi.fn().mockResolvedValue(true)} onRefresh={vi.fn()} {...overrides}/>;}
describe('approved workspace switcher controls',()=>{
 it('preserves loading, unavailable-list and no-result feedback with labeled autofocus and existing utility gates',()=>{
  const view=render(selector({loading:true,workspaces:[],error:'Current workspace list temporarily unavailable'}));fireEvent.click(screen.getByRole('button',{name:'LEDIPO Workspace'}));
  const popup=screen.getByRole('region',{name:'Workspace switcher'}),input=within(popup).getByRole('textbox',{name:'Find workspace'});
  expect(document.activeElement).toBe(input);expect(input.getAttribute('placeholder')).toBe('Search workspaces…');expect(within(popup).getByRole('status').textContent).toContain('Loading workspaces');expect(within(popup).getByRole('alert').textContent).toContain('temporarily unavailable');
  for(const name of ['Create workspace','Refresh workspaces'])expect(within(popup).getByRole('button',{name,exact:true}).hasAttribute('disabled')).toBe(true);
  view.rerender(selector({workspaces:[]}));expect(within(popup).getByText('No available workspaces.')).toBeTruthy();fireEvent.change(input,{target:{value:'Missing'}});expect(within(popup).getByText('No workspaces match your search.')).toBeTruthy();
 });
 it('shows one current choice with clean grouping and keyboard focus across the list/actions',()=>{
  render(selector());fireEvent.click(screen.getByRole('button',{name:'LEDIPO Workspace'}));const popup=screen.getByRole('region',{name:'Workspace switcher'});const choice=within(popup).getByRole('button',{name:'LEDIPO Office'});expect(choice.getAttribute('aria-current')).toBe('true');expect(within(popup).getAllByRole('button',{name:'LEDIPO Office'})).toHaveLength(1);expect(within(popup).queryByRole('region',{name:'Recent workspaces'})).toBeNull();
  const input=screen.getByRole('textbox',{name:'Find workspace'});input.focus();fireEvent.keyDown(input,{key:'ArrowDown'});expect(document.activeElement).toBe(choice);fireEvent.keyDown(choice,{key:'End'});expect(document.activeElement).toBe(within(popup).getByRole('button',{name:'Refresh workspaces'}));
 });
 it('shares one existing creation workflow between the header Plus and menu action',async()=>{
  const created=vi.fn();api.create.mockResolvedValue({id:'new'});render(selector({onCreated:created}));fireEvent.click(screen.getByRole('button',{name:'Create workspace',exact:true}));expect(screen.getAllByRole('dialog')).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'Cancel'}));fireEvent.click(screen.getByRole('button',{name:'LEDIPO Workspace'}));fireEvent.click(within(screen.getByRole('region',{name:'Workspace switcher'})).getByRole('button',{name:'Create workspace',exact:true}));expect(screen.getAllByRole('dialog')).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:'Submit workspace'}));await waitFor(()=>expect(created).toHaveBeenCalledOnce());expect(api.create).toHaveBeenCalledWith('request','Name','Asia/Singapore');expect(new URLSearchParams(window.location.search).get('workspace')).toBe('new');
 });
 it('retains the popup when guarded selection is rejected and searches the full list',async()=>{
  const select=vi.fn().mockResolvedValue(false);render(selector({workspaces:[workspace,{...workspace,id:'personal',name:'Private',kind:'personal',owner_name:'Actor'}],onSelect:select}));fireEvent.click(screen.getByRole('button',{name:'LEDIPO Workspace'}));fireEvent.change(screen.getByRole('textbox',{name:'Find workspace'}),{target:{value:'Private'}});fireEvent.click(screen.getByRole('button',{name:'Private Personal · Actor'}));await waitFor(()=>expect(select).toHaveBeenCalledWith('personal'));expect(screen.getByRole('region',{name:'Workspace switcher'})).toBeTruthy();expect(screen.queryByRole('button',{name:'LEDIPO Office'})).toBeNull();
 });
 it('keeps creation disabled when installation/loading cannot authorize the existing flow',()=>{
  render(selector({available:false}));expect(screen.getByRole('button',{name:'Create workspace',exact:true}).hasAttribute('disabled')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'LEDIPO Workspace'}));expect(within(screen.getByRole('region',{name:'Workspace switcher'})).getByRole('button',{name:'Create workspace',exact:true}).hasAttribute('disabled')).toBe(true);
 });
});
