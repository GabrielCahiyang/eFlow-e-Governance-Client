// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({subscribe:vi.fn()}));
vi.mock('../../src/lib/supabaseService',()=>({fetchAllOrgs:vi.fn(),fetchAllProfiles:vi.fn(),subscribeToOrgs:vi.fn(),subscribeToProfiles:vi.fn(),getDescendantOrgIds:vi.fn()}));
vi.mock('../../src/app/services/projectService',()=>({subscribeToProjects:vi.fn(),notifyProjectListeners:vi.fn()}));
vi.mock('../../src/app/services/taskService',()=>({subscribeToTasks:api.subscribe}));
vi.mock('../../src/app/features/tasks',()=>{throw new Error('Private module transport details');});
vi.mock('../../src/app/services/taskSelectors',()=>({operationalMetrics:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:vi.fn()}));
import {useTasksData} from '../../src/app/hooks/useSupabaseData';
afterEach(cleanup);

it('ends task retry loading and retains a safe error when its deferred module cannot load',async()=>{
 api.subscribe.mockImplementation(callback=>{callback([]);return vi.fn();});
 function Consumer(){const state=useTasksData();return <><button onClick={state.retry}>Retry</button><p role="status">{state.loading?'Loading':'Ready'}</p>{state.error&&<p role="alert">{state.error.message}</p>}</>;}
 render(<Consumer/>);
 expect(screen.getByRole('status').textContent).toBe('Ready');
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await screen.findByRole('alert');
 expect(screen.getByRole('alert').textContent).toBe('Tasks could not be refreshed. Try again.');
 expect(screen.getByRole('status').textContent).toBe('Ready');
 expect(screen.queryByText(/Private module/)).toBeNull();
 expect(api.subscribe).toHaveBeenCalledOnce();
});
