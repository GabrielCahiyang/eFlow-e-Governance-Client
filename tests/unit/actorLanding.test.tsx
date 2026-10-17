// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({can:vi.fn(),mounts:[] as string[]}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({can:state.can})}));
vi.mock('../../src/app/features/session-security',()=>({SessionSecurityProvider:({children}:{children:React.ReactNode})=>children}));
vi.mock('../../src/app/features/app-shell/EflowAppShell',()=>({EflowAppShell:()=>{state.mounts.push(window.location.pathname+window.location.search);return <div>Workspace mounted</div>;}}));
import {SignedInApp} from '../../src/app/features/app-shell/SignedInApp';
beforeEach(()=>{state.mounts=[];state.can.mockReturnValue(false);window.history.replaceState({},'','/');});
afterEach(cleanup);
it('redirects a restored Head session away from an unsupported Admin page',()=>{
 window.history.replaceState({},'','/users?page=All+Users&workspace=previous-office');render(<SignedInApp role="head" actorId="head"/>);
 expect(screen.getByText('Workspace mounted')).toBeTruthy();expect(state.mounts).toEqual(['/']);
});
it('preserves explicit support permissions instead of removing legitimate Head access',()=>{
 state.can.mockImplementation((key:string)=>key==='navigation.user_management');window.history.replaceState({},'','/users?page=All+Users');render(<SignedInApp role="head" actorId="head"/>);
 expect(window.location.pathname).toBe('/users');
});
it('clears a foreign workspace before any workspace hooks mount',()=>{
 window.history.replaceState({eflowActorId:'admin',eflowActorRole:'admin'},'','/projects?page=Projects&workspace=admin-office');render(<SignedInApp role="head" actorId="head"/>);
 expect(state.mounts).toEqual(['/']);expect(window.history.state.eflowActorId).toBe('head');
});
it('keeps an authorized same-account project deep link',()=>{
 window.history.replaceState({eflowActorId:'head',eflowActorRole:'head'},'','/projects?page=Projects&project=own&view=tasks');render(<SignedInApp role="head" actorId="head"/>);
 expect(window.location.search).toContain('project=own');
});
