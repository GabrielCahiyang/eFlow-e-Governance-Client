// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({task:{id:'task-1',title:'Prepare report',status:'todo',updatedAt:1} as any,fetch:vi.fn(),update:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'lead'},userProfile:{full_name:'Task Lead'}})}));
vi.mock('../../src/app/features/tasks',()=>({checkTaskExecution:api.fetch,updateTaskStatus:api.update}));
vi.mock('../../src/app/shared/navigationGuard',()=>({requestNavigation:(run:()=>void)=>{run();return Promise.resolve(true);},useNavigationBlocker:vi.fn()}));
import {useInspectorLifecycle} from '../../src/app/features/task-inspector/hooks/useInspectorLifecycle';
function Harness(){const lifecycle=useInspectorLifecycle(api.task);return <>{lifecycle.dialog}<button onClick={lifecycle.start}>Start task</button>{lifecycle.error&&<p role="alert">{lifecycle.error}</p>}</>;}
beforeEach(()=>{vi.clearAllMocks();api.fetch.mockResolvedValue({id:'task-1',status:'todo',org_id:null,linked_project_id:null,updated_at:new Date(1).toISOString()});api.update.mockResolvedValue(undefined);});afterEach(cleanup);
describe('Task Start confirmation',()=>{
 it('cancellation closes confirmation without a read or write',async()=>{render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Start task'}));const dialog=await screen.findByRole('alertdialog',{name:'Start work?'});fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());expect(api.fetch).not.toHaveBeenCalled();expect(api.update).not.toHaveBeenCalled();});
 it('blocks duplicate confirmations and freshly checks the Task before writing',async()=>{render(<Harness/>);const trigger=screen.getByRole('button',{name:'Start task'});fireEvent.click(trigger);fireEvent.click(trigger);const dialog=await screen.findByRole('alertdialog',{name:'Start work?'});expect(screen.getAllByRole('alertdialog')).toHaveLength(1);fireEvent.click(within(dialog).getByRole('button',{name:'Start work'}));await waitFor(()=>expect(api.update).toHaveBeenCalledOnce());expect(api.fetch).toHaveBeenCalledExactlyOnceWith('task-1','lead',['todo','changes_requested']);expect(api.update).toHaveBeenCalledExactlyOnceWith('task-1','in_progress',{id:'lead',name:'Task Lead'});});
 it('retains the confirmation error and does not write after a changed Task',async()=>{api.fetch.mockResolvedValue({id:'task-1',status:'todo',updated_at:new Date(2).toISOString()});render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Start task'}));fireEvent.click(within(await screen.findByRole('alertdialog',{name:'Start work?'})).getByRole('button',{name:'Start work'}));await screen.findByRole('alert');expect(api.update).not.toHaveBeenCalled();});
});
