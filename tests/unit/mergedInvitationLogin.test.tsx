// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';

const api=vi.hoisted(()=>({
  signIn:vi.fn(),getUser:vi.fn(),validateOffice:vi.fn(),validateGuest:vi.fn(),
  createOffice:vi.fn(),createGuest:vi.fn(),acceptOffice:vi.fn(),acceptGuest:vi.fn(),
}));
vi.mock('../../src/lib/supabase',()=>({supabase:{auth:{getUser:api.getUser}}}));
vi.mock('../../src/app/features/authentication',()=>({signInWithAccountProtection:api.signIn}));
vi.mock('../../src/app/features/invitations/services/invitationService',()=>({
  validateInvitation:api.validateOffice,createInvitedAccount:api.createOffice,acceptInvitation:api.acceptOffice,
}));
vi.mock('../../src/app/features/project-invitations',()=>({
  validateProjectInvitation:api.validateGuest,createProjectGuest:api.createGuest,acceptProjectInvitation:api.acceptGuest,
}));
vi.mock('../../src/components/EFlowMark',()=>({EFlowMark:()=>null}));
vi.mock('../../src/app/components/ui/WorkspaceIllustration',()=>({WorkspaceIllustration:()=>null}));
import {AcceptInvitationPage} from '../../src/app/features/invitations/components/AcceptInvitationPage';

beforeEach(()=>{
  vi.resetAllMocks();
  api.getUser.mockResolvedValue({data:{user:null}});
  const invite={email:'guest@example.test',office_name:'Environment Office',account_role:'member',expires_at:'2030-01-01',existing_account:false};
  api.validateOffice.mockResolvedValue(invite);
  api.validateGuest.mockResolvedValue({...invite,project_id:'project-1',project_title:'Community assessment',engagement:'contractual',skills:[]});
  api.signIn.mockResolvedValue(undefined);
});
afterEach(()=>{cleanup();window.history.replaceState({},'', '/');});

it.each([
  ['Office','/accept-invite', 'validateOffice','createOffice','acceptOffice','acceptGuest'],
  ['project guest','/accept-project-invite','validateGuest','createGuest','acceptGuest','acceptOffice'],
] as const)('recovers a lost %s account response through protected login and its own acceptance operation',async(_name,path,validate,create,accept,otherAccept)=>{
  window.history.replaceState({},'',`${path}?token=test-invitation-token`);
  api[create].mockRejectedValue(new Error('Create response lost'));
  api[accept].mockRejectedValue(new Error('Acceptance pending verification'));
  render(<AcceptInvitationPage/>);
  await screen.findByLabelText('Full name');
  fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Guest person'}});
  fireEvent.change(screen.getByLabelText('Password',{exact:true}),{target:{value:'a-secure-password'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'a-secure-password'}});
  fireEvent.click(screen.getByRole('button',{name:/Create account/}));
  await screen.findByText('Acceptance pending verification');
  expect(api[validate]).toHaveBeenCalledWith('test-invitation-token');
  expect(api[create]).toHaveBeenCalledTimes(1);
  expect(api.signIn).toHaveBeenCalledWith('guest@example.test','a-secure-password');
  expect(api[accept]).toHaveBeenCalledWith('test-invitation-token','Guest person');
  expect(api[otherAccept]).not.toHaveBeenCalled();
  expect(window.location.search).toBe('');
});

it('retains the original uncertain account creation error if protected recovery is rejected',async()=>{
  window.history.replaceState({},'', '/accept-project-invite?token=test-invitation-token');
  api.createGuest.mockRejectedValue(new Error('Create response lost'));
  api.signIn.mockRejectedValue(new Error('Your account is locked. Contact an Admin to unlock it.'));
  render(<AcceptInvitationPage/>);
  await screen.findByLabelText('Full name');
  fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Guest person'}});
  fireEvent.change(screen.getByLabelText('Password',{exact:true}),{target:{value:'a-secure-password'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'a-secure-password'}});
  fireEvent.click(screen.getByRole('button',{name:/Create account/}));
  await screen.findByText('Create response lost');
  await waitFor(()=>expect(api.signIn).toHaveBeenCalledTimes(1));
  expect(api.acceptGuest).not.toHaveBeenCalled();
  expect(api.acceptOffice).not.toHaveBeenCalled();
});
