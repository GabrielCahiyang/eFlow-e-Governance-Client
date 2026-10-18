// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const calls=vi.hoisted(()=>({group:vi.fn(),task:vi.fn()}));
vi.mock('../../src/app/components/ui/FeatureDialog',()=>({FeatureDialog:({children}:{children:React.ReactNode})=><div role="dialog">{children}</div>}));
vi.mock('../../src/app/hooks/useFirebaseData',()=>({useTasks:()=>({tasks:[{id:'one',title:'Set up meeting',linkedProjectId:'project',groupId:'group'}]})}));
vi.mock('../../src/app/features/project-table/services/workspaceService',()=>({createProjectGroup:calls.group,createWorkspaceTask:calls.task}));
import {CreateWorkDialog} from '../../src/app/features/project-table/components/CreateWorkDialog';
afterEach(()=>{cleanup();vi.clearAllMocks();});
for(const kind of ['task','group'] as const)it('shows a duplicate '+kind+' name error without creating anything',async()=>{
 render(<CreateWorkDialog kind={kind} projectId="project" groups={[{id:'group',projectId:'project',title:'Set up meeting',position:0,color:'blue',isDefault:false}]} onClose={vi.fn()}/>);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:' SET UP   MEETING '}});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:kind==='task'?'Add task':'Add group'})));
 expect(screen.getByText(/already exists here/)).toBeTruthy();expect(calls.group).not.toHaveBeenCalled();expect(calls.task).not.toHaveBeenCalled();
});
