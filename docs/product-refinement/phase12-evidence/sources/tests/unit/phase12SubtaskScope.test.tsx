// @vitest-environment jsdom
import { act,cleanup,renderHook } from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
const feed=vi.hoisted(()=>({callbacks:{} as Record<string,(rows:unknown[])=>void>}));
vi.mock('../../src/app/services/subtaskService',()=>({getCachedSubtasks:(id:string)=>id==='a'?[{id:'old',taskId:'a'}]:undefined,subscribeToSubtasks:(id:string,callback:(rows:unknown[])=>void)=>{feed.callbacks[id]=callback;return ()=>{};}}));
import {useTaskSubtasks} from '../../src/app/features/subtasks/hooks/useTaskSubtasks';
afterEach(cleanup);
describe('Phase 12 canonical subtask scope',()=>{
 it('drops previous rows and ignores late callbacks when task identity changes',()=>{
  const {result,rerender}=renderHook(({id})=>useTaskSubtasks(id),{initialProps:{id:'a'}});expect(result.current.subtasks.map(row=>row.id)).toEqual(['old']);
  const old=feed.callbacks.a;rerender({id:'b'});expect(result.current.subtasks).toEqual([]);
  act(()=>old([{id:'late',taskId:'a'}]));expect(result.current.subtasks).toEqual([]);
  act(()=>feed.callbacks.b([{id:'current',taskId:'b'}]));expect(result.current.subtasks.map(row=>row.id)).toEqual(['current']);
 });
});
