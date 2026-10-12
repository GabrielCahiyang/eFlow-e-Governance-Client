// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {selectFocusedWorkEvents,type WorkEvent,type WorkTreeSnapshot,type WorkNode} from '../../src/app/features/nested-work';
import {rememberWorkCapabilityContext} from '../../src/app/features/nested-work/selectors/capabilities';
const api=vi.hoisted(()=>({actor:'worker',read:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:api.actor}})}));
vi.mock('../../src/app/features/nested-work/services/workTreeService',()=>({fetchWorkEvents:api.read}));
import {WorkActivity} from '../../src/app/features/nested-work';
const node=(id:string,parent:string|null=null,title=id):WorkNode=>({id,task_id:'root',title,parent_subtask_id:parent,lead_id:null,assigned_to_ids:[],depth:1,sibling_order:0,due_date:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:false,can_appoint:false,can_order:false,can_work:false,can_review:false});
function tree(nodes=[node('selected'),node('child','selected'),node('other')]):WorkTreeSnapshot{const data:WorkTreeSnapshot={root:{id:'root',project:'project',office:'office',kind:'office',lead:null,people:[],open:true,due:null},revision:7,nodes,people:[],can_manage:false,can_transfer:false,leaf_total:2,leaf_completed:0};rememberWorkCapabilityContext(data,api.actor);return data;}
function event(id:string,nodeId:string|null,command='edit',before=tree(),after=tree()):WorkEvent{return {id,root_id:'root',node_id:nodeId,command,actor_name:'Historical actor '+id,occurred_at:'2026-10-12T00:00:00Z',before_data:before,after_data:after};}
const focus={rootId:'root',nodeId:'selected'};
beforeEach(()=>{vi.clearAllMocks();api.actor='worker';});afterEach(cleanup);
describe('NW8.4 focused historical Activity scope',()=>{
 it('renders shared historical fields and clears visible history when a refreshed read is denied',async()=>{
  const before=tree([node('selected'),node('child','selected','Deleted descendant')]),after=tree([node('selected')]);
  api.read.mockResolvedValueOnce({events:[event('deleted','child','delete',before,after)],more:false}).mockRejectedValueOnce(new Error('Current access denied'));
  render(<WorkActivity roots={['root']} focusedNode={focus} snapshot={tree()}/>);
  await screen.findByText(/Subitem deleted/);expect(screen.getByText(/Path: selected \/ Deleted descendant/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Refresh history'}));await screen.findByRole('alert');expect(screen.queryByText('Historical actor deleted')).toBeNull();expect(screen.queryByText(/Deleted descendant/)).toBeNull();
 });
 it('keeps own and descendant events, excludes siblings, other roots and root staffing',()=>{
  const events=[event('own','selected'),event('desc','child'),event('sibling','other'),event('root',null,'root_lead'),{...event('foreign','selected'),root_id:'foreign'}];expect(selectFocusedWorkEvents(events,focus,tree()).map(row=>row.event.id)).toEqual(['own','desc']);
 });
 it('uses before and after descendants for moved-out, moved-in and deleted work without rewriting old titles',()=>{
  const before=tree([node('selected'),node('child','selected','Old title'),node('other')]),after=tree([node('selected'),node('child','other','Outside title'),node('other')]);const moved=event('move','child','move',before,after),deleted=event('delete','child','delete',before,tree([node('selected')])),inside=event('in','child','move',after,before);
  expect(selectFocusedWorkEvents([moved,deleted,inside],focus,tree()).map(row=>[row.event.id,row.title])).toEqual([['move','Old title'],['delete','Old title'],['in','Old title']]);expect(moved.before_data.nodes[1].title).toBe('Old title');
 });
 it('rejects foreign Office/project/kind context, absent focus and cross-root node edges',()=>{
  const invalid=tree();invalid.root.office='foreign';expect(selectFocusedWorkEvents([event('bad','child','edit',invalid,invalid)],focus,tree())).toEqual([]);const mixed=tree([node('selected'),{...node('bridge','selected'),task_id:'foreign'},node('child','bridge')]);expect(selectFocusedWorkEvents([event('mixed','child','edit',mixed,mixed)],focus,tree())).toEqual([]);expect(selectFocusedWorkEvents([event('own','selected')],{...focus,nodeId:'missing'},tree())).toEqual([]);
 });
 it('includes null-node order only when the selected branch position changed',()=>{
  const before=tree(),after=tree();after.nodes[1].sibling_order=2;expect(selectFocusedWorkEvents([event('order',null,'order',before,after)],focus,tree()).map(row=>row.event.id)).toEqual(['order']);const unrelated=tree();unrelated.nodes[2].sibling_order=3;expect(selectFocusedWorkEvents([event('other',null,'order',before,unrelated)],focus,tree())).toEqual([]);
 });
 it('keeps the raw page cursor after an empty filtered page and reads only one bounded page per click',async()=>{
  const raw=[event('first','other'),event('raw-last','other')];api.read.mockResolvedValueOnce({events:raw,more:true}).mockResolvedValueOnce({events:[event('older','child')],more:false});render(<WorkActivity roots={['root']} focusedNode={focus} snapshot={tree()}/>);await screen.findByText('No permitted work changes on this page.');expect(screen.queryByText('Historical actor first')).toBeNull();expect(api.read).toHaveBeenCalledTimes(1);screen.getByRole('button',{name:'Older work changes'}).focus();fireEvent.click(screen.getByRole('button',{name:'Older work changes'}));await screen.findByText('Historical actor older');expect(api.read).toHaveBeenLastCalledWith(['root'],{time:raw[1].occurred_at,id:'raw-last'});expect(api.read).toHaveBeenCalledTimes(2);await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'Refresh history'})));
 });
 it('does not steal focus from another control when an older page finishes',async()=>{
  let resolve!:(result:{events:WorkEvent[];more:boolean})=>void;api.read.mockResolvedValueOnce({events:[event('first','child')],more:true}).mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));render(<><button>Other active control</button><WorkActivity roots={['root']} focusedNode={focus} snapshot={tree()}/></>);const older=await screen.findByRole('button',{name:'Older work changes'});older.focus();fireEvent.click(older);await waitFor(()=>expect(api.read).toHaveBeenCalledTimes(2));const other=screen.getByRole('button',{name:'Other active control'});other.focus();await act(async()=>resolve({events:[event('older','child')],more:false}));expect(document.activeElement).toBe(other);
 });
 it('blocks focused reads without current actor/root identity and ignores late pages after scope changes',async()=>{
  let resolve!:(result:{events:WorkEvent[];more:boolean})=>void;api.read.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));const data=tree(),view=render(<WorkActivity roots={['root']} focusedNode={focus} snapshot={data}/>);await waitFor(()=>expect(api.read).toHaveBeenCalledOnce());view.rerender(<WorkActivity roots={['root']} focusedNode={focus}/>);await act(async()=>resolve({events:[event('late','selected')],more:false}));expect(screen.queryByText('Historical actor late')).toBeNull();expect(api.read).toHaveBeenCalledOnce();api.actor='other-actor';view.rerender(<WorkActivity roots={['root']} focusedNode={focus} snapshot={data}/>);expect(screen.getByText('Verify current subitem access to read its work changes.')).toBeTruthy();expect(api.read).toHaveBeenCalledOnce();
 });
 it('preserves root-only rendering, errors, retry and refresh contracts',async()=>{
  api.read.mockRejectedValueOnce(new Error('History denied')).mockResolvedValue({events:[event('root',null,'root_lead')],more:false});render(<WorkActivity roots={['root']}/>);await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Retry delegation history'}));await screen.findByText('Historical actor root');expect(screen.getByText(/Task Lead transferred/)).toBeTruthy();expect(screen.queryByText(/root_lead/)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Refresh history'}));await waitFor(()=>expect(api.read).toHaveBeenCalledTimes(3));expect(api.read).toHaveBeenLastCalledWith(['root'],undefined);
 });
});
