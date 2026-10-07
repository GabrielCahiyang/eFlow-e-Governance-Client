// @vitest-environment jsdom
import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const login=vi.hoisted(()=>vi.fn());
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({login})}));
vi.mock('../../src/app/features/authentication',()=>({validateLoginFields:()=>({}),signInWithAccountProtection:vi.fn()}));
import {useLoginForm} from '../../src/pages/Login/useLoginForm';
afterEach(cleanup);beforeEach(()=>{login.mockReset();localStorage.clear();});
it('does not invent a browser lock after repeated failures',async()=>{
  login.mockRejectedValue(new Error('Email or password is incorrect.'));
  const {result}=renderHook(()=>useLoginForm());
  act(()=>{result.current.setEmail('person@example.test');result.current.setPassword('wrong');});
  for(let i=0;i<6;i++) await act(()=>result.current.handleSubmit());
  expect(result.current.state).toBe('invalid_credentials');
  expect(result.current.isSubmitDisabled).toBe(false);
});
it('keeps a server lock message but does not ban this browser from another account',async()=>{
  login.mockRejectedValueOnce(new Error('Your account is locked. Contact an Admin to unlock it.')).mockResolvedValueOnce(undefined);
  const {result}=renderHook(()=>useLoginForm());
  act(()=>{result.current.setEmail('locked@example.test');result.current.setPassword('password');});
  await act(()=>result.current.handleSubmit());
  expect(result.current.state).toBe('account_locked'); expect(result.current.cooldownSeconds).toBe(0);
  act(()=>result.current.setEmail('other@example.test'));
  await act(()=>result.current.handleSubmit());
  expect(result.current.state).toBe('success');
});
it('a network failure never turns into an account lock',async()=>{
  login.mockRejectedValue(new TypeError('Failed to fetch'));
  const {result}=renderHook(()=>useLoginForm());
  act(()=>{result.current.setEmail('person@example.test');result.current.setPassword('password');});
  await act(()=>result.current.handleSubmit());
  expect(result.current.state).toBe('network_offline');
});
it('scenario sign-in respects the same server lock',async()=>{
  login.mockRejectedValue(new Error('Your account is locked. Contact an Admin to unlock it.'));
  const {result}=renderHook(()=>useLoginForm());
  await act(()=>result.current.loginWithCredentials('locked@example.test','password'));
  expect(result.current.state).toBe('account_locked');
});
