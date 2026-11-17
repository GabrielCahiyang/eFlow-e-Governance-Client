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
 it('renders only the static Office workspace label without workspace creation or dropdown switching controls',()=>{
  render(selector());
  expect(screen.getByText('LEDIPO Workspace')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'LEDIPO Workspace'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Create workspace'})).toBeNull();
  expect(screen.queryByRole('region',{name:'Workspace switcher'})).toBeNull();
 });
});
