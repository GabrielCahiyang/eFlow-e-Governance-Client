// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({read:vi.fn(),save:vi.fn(),unlock:vi.fn(),confirm:vi.fn(),blocker:vi.fn(),role:'admin',id:'admin-1',navigate:true}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({userProfile:{role:api.role,id:api.id}})}));
vi.mock('../../src/app/shared/navigationGuard',()=>({useNavigationBlocker:api.blocker,requestNavigation:(action:()=>void)=>{if(api.navigate)action();}}));
vi.mock('../../src/app/components/ui/useConfirmation',()=>({useConfirmation:()=>({confirm:api.confirm,dialog:null})}));
vi.mock('../../src/app/components/ui/DataTable',()=>({DataTable:({data,columns}:any)=><div>{data.map((row:any)=><div key={row.user_id}>{columns.map((column:any)=><span key={column.key}>{column.render(row)}</span>)}</div>)}</div>}));
vi.mock('../../src/app/features/administration/services/loginSecurityService',()=>({readLoginSecurity:api.read,saveLoginAttemptLimit:api.save,unlockLoginAccount:api.unlock}));
import {LockedAccountsTab} from '../../src/app/features/administration/components/user-management/LockedAccountsTab';
const account={user_id:'member-1',email:'locked@example.test',full_name:'Locked person',role:'member',failed_attempts:3,locked_at:'2026-10-01T00:00:00Z'};
beforeEach(()=>{
  vi.resetAllMocks();api.role='admin';api.id='admin-1';api.navigate=true;
  api.read.mockResolvedValue({max_attempts:3,accounts:[account]});
  api.confirm.mockResolvedValue(true);api.unlock.mockResolvedValue({status:'unlocked'});api.save.mockResolvedValue({max_attempts:5});
});
afterEach(cleanup);
it('guards dirty lockout settings and preserves them while unlocking another account',async()=>{
  render(<LockedAccountsTab/>);
  const input=await screen.findByRole('spinbutton',{name:'Failed attempts before lockout'});
  await waitFor(()=>expect((input as HTMLInputElement).value).toBe('3'));
  fireEvent.change(input,{target:{value:'5'}});
  expect(api.blocker.mock.lastCall?.[0]).toMatchObject({dirty:true,label:'Account lockout settings'});
  fireEvent.click(screen.getByRole('button',{name:'Unlock account',exact:true}));
  await screen.findByText('Account unlocked. They can sign in again.');
  expect(api.confirm).toHaveBeenCalledTimes(1);expect(api.unlock).toHaveBeenCalledWith('member-1');
  expect((input as HTMLInputElement).value).toBe('5');
  expect(api.blocker.mock.lastCall?.[0].dirty).toBe(true);
  api.navigate=false;
  fireEvent.click(screen.getByRole('button',{name:'Refresh locked accounts'}));
  expect(api.read).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button',{name:'Save attempt limit'}));
  await screen.findByText('Attempt limit saved.');
  expect(api.save).toHaveBeenCalledWith(5);
});
it('never reads security data for non-Admin actors',()=>{
  api.role='head';render(<LockedAccountsTab/>);
  expect(screen.getByText('Only Admin can view and unlock locked accounts.')).toBeTruthy();
  expect(api.read).not.toHaveBeenCalled();
});
it('drops late settings responses when the signed-in actor changes',async()=>{
  let resolveSave:(value:unknown)=>void=()=>{};
  api.save.mockImplementation(()=>new Promise(resolve=>{resolveSave=resolve;}));
  const view=render(<LockedAccountsTab/>);
  const input=await screen.findByRole('spinbutton',{name:'Failed attempts before lockout'});
  await waitFor(()=>expect((input as HTMLInputElement).value).toBe('3'));
  fireEvent.change(input,{target:{value:'5'}});
  fireEvent.click(screen.getByRole('button',{name:'Save attempt limit'}));
  api.id='admin-2';view.rerender(<LockedAccountsTab/>);
  await act(()=>Promise.resolve());
  await act(()=>{resolveSave({max_attempts:5});return Promise.resolve();});
  expect(screen.queryByText('Attempt limit saved.')).toBeNull();
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3');
});
