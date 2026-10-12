// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({actor:'actor-a'}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:auth.actor?{id:auth.actor}:null})}));
import {useNotificationNavigationIntent} from '../../src/app/features/notifications/hooks/useNotificationNavigationIntent';
import * as store from '../../src/app/features/notifications/navigationIntent';
const target={notificationId:'notification',kind:'subtask' as const,taskId:'root',entityId:'eight',entityLabel:'Old label',inspectorSection:'work' as const};
const key=(actor:string)=>`eflow.notification-intent.v1:${actor}`;
beforeEach(()=>{cleanup();auth.actor='actor-a';const pending=store.peekNotificationNavigationIntent();if(pending)store.completeNotificationNavigationIntent(pending.notificationId);sessionStorage.clear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();const pending=store.peekNotificationNavigationIntent();if(pending)store.completeNotificationNavigationIntent(pending.notificationId);sessionStorage.clear();});
describe('NW9.5 unfinished navigation lifecycle',()=>{
 it('owns canonical intent identity and restores only its account after a module reload; completion clears persisted state',async()=>{
  const original={...target};store.queueNotificationNavigationIntent(original,'actor-a');original.entityId='wrong';
  expect(store.peekNotificationNavigationIntent('actor-a')?.entityId).toBe('eight');expect(store.peekNotificationNavigationIntent('actor-b')).toBeNull();
  vi.resetModules();const reloaded=await import('../../src/app/features/notifications/navigationIntent');
  expect(reloaded.peekNotificationNavigationIntent('actor-b')).toBeNull();const restored=reloaded.peekNotificationNavigationIntent('actor-a');expect(restored).toEqual(target);
  reloaded.completeNotificationNavigationIntent('another');expect(sessionStorage.getItem(key('actor-a'))).not.toBeNull();
  reloaded.completeNotificationNavigationIntent(target.notificationId,restored!);expect(sessionStorage.getItem(key('actor-a'))).toBeNull();expect(reloaded.peekNotificationNavigationIntent('actor-a')).toBeNull();
 });
 it('persists navigation fields only, never attached evidence or privileged snapshots',()=>{
  store.queueNotificationNavigationIntent(Object.assign({...target},{evidence:'private-file',access_token:'credential',workContext:{title:'private'}}),'actor-a');
  const raw=sessionStorage.getItem(key('actor-a'))!;expect(raw).not.toContain('private');expect(raw).not.toContain('credential');expect(JSON.parse(raw).intent).toEqual(target);
 });
 it('waits for current authorized source resolution and removes the pending pointer only once handled',async()=>{
  store.queueNotificationNavigationIntent(target,'actor-a');const handle=vi.fn((_intent:unknown)=>false);
  const view=renderHook(({ready})=>useNotificationNavigationIntent(intent=>intent.kind==='subtask',handle,[ready]),{initialProps:{ready:false}});
  expect(handle).toHaveBeenCalledOnce();expect(store.peekNotificationNavigationIntent('actor-a')).not.toBeNull();
  handle.mockReturnValue(true);view.rerender({ready:true});await waitFor(()=>expect(store.peekNotificationNavigationIntent('actor-a')).toBeNull());expect(sessionStorage.getItem(key('actor-a'))).toBeNull();
 });
 it('hides another actor unfinished intent and defers restoration until the originating actor returns',()=>{
  store.queueNotificationNavigationIntent(target,'actor-a');auth.actor='actor-b';const handle=vi.fn(()=>true);
  const view=renderHook(()=>useNotificationNavigationIntent(()=>true,handle,[]));expect(handle).not.toHaveBeenCalled();expect(sessionStorage.getItem(key('actor-a'))).not.toBeNull();
  auth.actor='actor-a';view.rerender();expect(handle).toHaveBeenCalledWith(expect.objectContaining({entityId:'eight'}),expect.any(Function));expect(sessionStorage.getItem(key('actor-a'))).toBeNull();
 });
 it('does not complete a replacement intent with the same notification ID while the old handler finishes',async()=>{
  const second={...target,entityId:'new-target'};const handle=vi.fn((intent:typeof target)=>{if(intent.entityId==='eight'){store.queueNotificationNavigationIntent(second,'actor-a');return true;}return false;});
  renderHook(()=>useNotificationNavigationIntent(()=>true,handle,[]));act(()=>store.queueNotificationNavigationIntent(target,'actor-a'));
  expect(store.peekNotificationNavigationIntent('actor-a')?.entityId).toBe('new-target');expect(handle).toHaveBeenCalledTimes(2);expect(JSON.parse(sessionStorage.getItem(key('actor-a'))!).intent.entityId).toBe('new-target');
 });
 it('ignores late asynchronous focus after an account change and keeps the originating pointer unfinished',async()=>{
  let finish!:(handled:boolean)=>void,current!:()=>boolean;const handle=vi.fn((_intent:unknown,isCurrent:()=>boolean)=>{current=isCurrent;return new Promise<boolean>(resolve=>{finish=resolve;});});
  store.queueNotificationNavigationIntent(target,'actor-a');const view=renderHook(()=>useNotificationNavigationIntent(()=>true,handle,[]));
  expect(current()).toBe(true);auth.actor='actor-b';view.rerender();expect(current()).toBe(false);
  await act(async()=>finish(true));expect(store.peekNotificationNavigationIntent('actor-b')).toBeNull();expect(sessionStorage.getItem(key('actor-a'))).not.toBeNull();view.unmount();
 });
 it('does not retry an in-flight focus twice and retains failed/declined navigation for a later source retry',async()=>{
  let finish!:(handled:boolean)=>void;const handle=vi.fn(()=>new Promise<boolean>(resolve=>{finish=resolve;}));store.queueNotificationNavigationIntent(target,'actor-a');
  const view=renderHook(({retry})=>useNotificationNavigationIntent(()=>true,handle,[retry]),{initialProps:{retry:0}});
  await act(async()=>finish(false));expect(sessionStorage.getItem(key('actor-a'))).not.toBeNull();view.rerender({retry:1});expect(handle).toHaveBeenCalledTimes(2);await act(async()=>finish(true));expect(store.peekNotificationNavigationIntent('actor-a')).toBeNull();
 });
 it('rejects corrupt or foreign stored state without applying it, and keeps the legacy runtime path if storage is disabled',async()=>{
  vi.resetModules();const empty=await import('../../src/app/features/notifications/navigationIntent');
  for(const raw of ['{broken',JSON.stringify({actorId:'actor-b',intent:target}),JSON.stringify({actorId:'actor-a',intent:{...target,entityId:{malicious:true}}})]){sessionStorage.setItem(key('actor-a'),raw);expect(empty.peekNotificationNavigationIntent('actor-a')).toBeNull();}
  sessionStorage.clear();vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Storage blocked');});expect(()=>empty.queueNotificationNavigationIntent(target,'actor-a')).not.toThrow();expect(empty.peekNotificationNavigationIntent('actor-a')).toEqual(target);empty.completeNotificationNavigationIntent(target.notificationId);
  empty.queueNotificationNavigationIntent(target);expect(empty.peekNotificationNavigationIntent()).toEqual(target);expect(sessionStorage.length).toBe(0);empty.completeNotificationNavigationIntent(target.notificationId);
 });
});
