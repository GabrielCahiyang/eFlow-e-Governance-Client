// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({pending:vi.fn(),save:vi.fn(),touch:vi.fn(),publish:vi.fn(),generate:vi.fn(),extract:vi.fn(),assign:vi.fn(),revision:0}));
vi.mock('../../src/app/features/project-import/services/pdfImportSession',()=>({pendingPdfImport:api.pending,checkpointPdfImport:api.save,touchPdfImport:api.touch,publishPdfImport:api.publish,cacheImportFile:vi.fn().mockResolvedValue(undefined),readImportFile:()=>Promise.resolve(new File(['pdf'],'proposal.pdf')),clearImportFile:vi.fn().mockResolvedValue(undefined)}));
vi.mock('../../src/app/features/project-import/services/documentService',()=>({readProjectDocument:()=>Promise.resolve('Verified source document')}));
vi.mock('../../src/app/features/project-import/services/pdfProjectDraft',()=>({generatePdfProjectDraft:api.generate}));
vi.mock('../../src/app/features/project-import/services/pdfOffices',()=>({extractPdfOffices:api.extract,officeAliases:(name:string)=>[name.toLowerCase()]}));
vi.mock('../../src/app/features/staffing',()=>({prepareImportAssignment:api.assign}));
vi.mock('../../src/lib/supabase',()=>({supabase:{from:(table:string)=>({select:()=>({eq:()=>({single:()=>Promise.resolve({data:table==='projects'?{org_id:'org'}:{name:'LEDIPO',slug:'ledipo'},error:null})})})})}}));
import {usePdfImportSession} from '../../src/app/features/project-import/hooks/usePdfImportSession';
const task=(key:string)=>({key,title:key,description:'Source work',priority:'medium',estimatedHours:4,startDate:'2099-10-21',dueDate:'2099-11-20',officeKey:'o1',dependencies:[],subitems:[],sourceQuote:key,included:true});
const draft=()=>({schemaVersion:1,project:{title:'',description:'',objectives:'',startDate:'',targetDate:''},offices:[{key:'o1',name:'Agriculture Office',evidence:'Source office quote',officeId:'',confirmed:false}],warnings:[],groups:[{key:'g1',title:'Planning',color:'#087f8c',existingGroupId:'',tasks:[task('t1'),task('t2')]}]});
beforeEach(()=>{vi.clearAllMocks();api.revision=0;api.pending.mockResolvedValue(null);api.save.mockImplementation(async(session,runner,state)=>({...session,runner,state:structuredClone(state),revision:++api.revision}));api.touch.mockResolvedValue(undefined);api.generate.mockResolvedValue(draft());api.assign.mockResolvedValue({lead:'person',people:['person']});api.extract.mockResolvedValue({offices:draft().offices,taskOffices:{t2:'o1'},clarification:[]});api.publish.mockResolvedValue({taskCount:2,groupCount:1,subitemCount:0,taskIds:{},groupIds:[]});});
afterEach(cleanup);
describe('saved PDF workflow',()=>{
 it('ignores a keep-alive failure arriving after a committed publication',async()=>{
  let heartbeat:(()=>void)|undefined,rejectTouch:(reason:Error)=>void=()=>{};
  const realInterval=globalThis.setInterval;
  const interval=vi.spyOn(globalThis,'setInterval').mockImplementation(((callback:()=>void,delay:number)=>{if(delay===25000)heartbeat=callback;return realInterval(callback,delay);}) as typeof setInterval);
  api.touch.mockImplementation(()=>new Promise((_,reject)=>{rejectTouch=reject;}));
  api.publish.mockImplementation(async()=>{heartbeat?.();return {taskCount:2,groupCount:1,subitemCount:0,taskIds:{},groupIds:[]};});
  try{
   const hook=renderHook(()=>usePdfImportSession('project',vi.fn()));await waitFor(()=>expect(hook.result.current.loading).toBe(false));
   await act(async()=>{await hook.result.current.upload(new File(['pdf'],'proposal.pdf'),'2099-10-21',false,true);});
   await waitFor(()=>expect(hook.result.current.result?.taskCount).toBe(2));
   await act(async()=>{rejectTouch(new Error('Import session is no longer available'));await Promise.resolve();});
   expect(hook.result.current.error).toBe('');expect(api.publish).toHaveBeenCalledOnce();
  }finally{interval.mockRestore();}
 });
 it('strips fallback office suggestions when unchecked and retries publication without regenerating or restaffing',async()=>{
  api.publish.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({taskCount:2,groupCount:1,subitemCount:0,taskIds:{},groupIds:[]});
  const done=vi.fn(),hook=renderHook(()=>usePdfImportSession('project',done));await waitFor(()=>expect(hook.result.current.loading).toBe(false));
  await act(async()=>{await hook.result.current.upload(new File(['pdf'],'proposal.pdf'),'2099-10-21',false,true);});
  await waitFor(()=>expect(hook.result.current.error).toBe('Connection interrupted'));
  const saved=api.publish.mock.calls[0][0];expect(saved.state.review.offices).toEqual([]);expect(saved.state.review.groups[0].tasks.every((item:any)=>item.officeKey==='')).toBe(true);
  expect(api.assign).toHaveBeenCalledTimes(2);expect(api.assign.mock.calls[1][2]).toEqual([{lead:'person',hours:4}]);
  await act(async()=>{await hook.result.current.resume();});
  expect(api.generate).toHaveBeenCalledOnce();expect(api.assign).toHaveBeenCalledTimes(2);expect(api.publish.mock.calls[1][0].id).toBe(saved.id);expect(done).toHaveBeenCalledOnce();
 });
 it('pauses for office confirmation and keeps external work unassigned until people join',async()=>{
  const done=vi.fn(),hook=renderHook(()=>usePdfImportSession('project',done));await waitFor(()=>expect(hook.result.current.loading).toBe(false));
  await act(async()=>{await hook.result.current.upload(new File(['pdf'],'proposal.pdf'),'2099-10-21',true,true);});
  await waitFor(()=>expect(hook.result.current.session?.state.stage).toBe('review_offices'));await waitFor(()=>expect(hook.result.current.busy).toBe(false));
  expect(api.assign).not.toHaveBeenCalled();expect(api.publish).not.toHaveBeenCalled();
  await act(async()=>{await hook.result.current.confirmOffices(hook.result.current.session!.state.draft!.offices);});
  await waitFor(()=>expect(done).toHaveBeenCalledOnce());
  expect(api.assign).toHaveBeenCalledOnce();const saved=api.publish.mock.calls[0][0];expect(saved.state.assignments).toHaveLength(1);expect(saved.state.assignments[0].key).toBe('t1');expect(saved.state.review.offices[0].confirmed).toBe(true);
 });
});
