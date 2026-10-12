import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rows:{} as Record<string,Record<string,unknown>[]>,calls:[] as unknown[][],profileError:false}));
vi.mock('../../src/lib/supabase',()=>({supabase:{from:(table:string)=>{
 const chain:any={};let ids:string[]=[],column='';
 chain.select=(...args:unknown[])=>{api.calls.push([table,'select',...args]);return chain;};
 chain.in=(key:string,selected:string[])=>{column=key;ids=selected;api.calls.push([table,'in',key,selected]);return chain;};
 chain.order=()=>chain;
 chain.range=async(from:number)=>{
  api.calls.push([table,'range',from]);
  if(table==='profiles'&&api.profileError)return {data:null,error:{message:'Profile scope denied'}};
  const rows=(api.rows[table]||[]).filter(row=>ids.includes(row[column] as string));
  return {data:rows.slice(from,from+25),count:rows.length,error:null};
 };
 return chain;
}}}));
import {fetchTeamWorkflowFacts} from '../../src/app/features/team-management/services/teamWorkflowFactsService';
describe('NW9.3 authorized report facts',()=>{
 beforeEach(()=>{api.rows={};api.calls=[];api.profileError=false;});
 it('chunks only distinct authorized staffing IDs and exhausts profile pages without fetching a global directory',async()=>{
  api.rows.subtasks=Array.from({length:205},(_,i)=>({id:`node${i}`,task_id:'root',title:'Same',lead_id:`lead${i}`,assigned_to_ids:[`lead${i}`],position:i}));
  api.rows.subtasks.push({id:'denied',task_id:'foreign',title:'SECRET',lead_id:'secret-person'});
  api.rows.profiles=Array.from({length:205},(_,i)=>({id:`lead${i}`,full_name:`Lead ${i}`}));
  api.rows.profiles.push({id:'secret-person',full_name:'SECRET'});
  const facts=await fetchTeamWorkflowFacts(['root','root']);
  expect(facts.subtasks).toHaveLength(205);
  expect(facts.subtasks[204].workContext).toMatchObject({rootId:'root',nodeId:'node204',leadName:'Lead 204',participantIds:['lead204'],contributors:[]});
  const queries=api.calls.filter(call=>call[0]==='profiles'&&call[1]==='in');
  expect(queries.map(call=>(call[3] as string[]).length)).toEqual([100,100,100,100,100,100,100,100,5]);
  expect([...new Set(queries.map(call=>JSON.stringify(call[3])))].map(batch=>JSON.parse(batch).length)).toEqual([100,100,5]);
  expect(api.calls.filter(call=>call[0]==='profiles'&&call[1]==='range').map(call=>call[2])).toEqual([0,25,50,75,0,25,50,75,0]);
  expect(queries.flatMap(call=>call[3])).not.toContain('secret-person');
  expect(api.calls.filter(call=>call[0]==='profiles'&&call[1]==='select').every(call=>call[2]==='id,full_name')).toBe(true);
  expect(facts.subtasks[204].assignedToIds).toEqual(['lead204']);
 });
 it('keeps legacy reviewer preference and immutable decision actor/name separately for task and node attempts',async()=>{
  const record={id:'attempt',task_id:'root',subtask_id:'node',submitter_id:'author',submitter_name:'Original author',reviewer_id:'changed-reviewer',decided_by:'actual-actor',decided_by_name:'Original actor',status:'approved',submitted_at:'2026-10-01',decided_at:'2026-10-02'};
  api.rows.task_submissions=[record];api.rows.subtask_submissions=[{...record,id:'node-attempt'}];
  const facts=await fetchTeamWorkflowFacts(['root']);
  expect(facts.submissions).toHaveLength(2);
  for(const attempt of facts.submissions)expect(attempt).toMatchObject({reviewerId:'changed-reviewer',decisionAuthorId:'actual-actor',decisionAuthorName:'Original actor',submitterName:'Original author'});
  api.rows.task_submissions=[{...record,reviewer_id:null}];api.rows.subtask_submissions=[];
  expect((await fetchTeamWorkflowFacts(['root'])).submissions[0].reviewerId).toBe('actual-actor');
 });
 it('uses the shared missing-name fallback, propagates denied reads and never queries profiles for empty scope',async()=>{
  api.rows.subtasks=[{id:'node',task_id:'root',title:'Same',lead_id:'missing',assigned_to_ids:[],position:0}];
  expect((await fetchTeamWorkflowFacts(['root'])).subtasks[0].workContext?.leadName).toBe('Previously assigned person');
  api.profileError=true;
  await expect(fetchTeamWorkflowFacts(['root'])).rejects.toThrow('Profile scope denied');
  api.calls=[];
  expect((await fetchTeamWorkflowFacts([])).subtasks).toEqual([]);
  expect(api.calls).toEqual([]);
 });
});
