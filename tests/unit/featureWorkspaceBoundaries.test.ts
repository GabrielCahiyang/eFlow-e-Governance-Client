import {describe,expect,it,vi} from 'vitest';

// Loading a data/public API must not evaluate its consuming screen. These
// factories fail only if the module is actually imported, not merely declared.
vi.mock('../../src/app/features/project-members/components/ProjectMembers',()=>{throw new Error('Members screen evaluated during data import');});
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc}}));

describe('feature data and workspace loading boundaries',()=>{
 it('retains public APIs without eagerly evaluating deferred workspace screens',async()=>{
  const members=await import('../../src/app/features/project-members');
  expect(typeof members.ProjectMembers).toBe('function');
  const snapshot={members:[],offices:[]};
  rpc.mockResolvedValue({data:snapshot,error:null});
  expect(await members.fetchMembers('qa-project')).toBe(snapshot);
  expect(rpc).toHaveBeenCalledWith('r7_project_members',{p_project:'qa-project'});
 });
});
