import {beforeEach,describe,it,expect,vi} from 'vitest';
const backend=vi.hoisted(()=>({rpc:vi.fn(),upload:vi.fn(),sign:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:backend.rpc,storage:{from:()=>({upload:backend.upload,createSignedUrl:backend.sign})}}}));
import {uploadProjectFile,openProjectFile,fetchProjectFiles} from '../../src/app/features/project-files/services/projectFileService';
import {validateProjectFile} from '../../src/app/features/project-files/constants';
import {mapInspectorFiles} from '../../src/app/features/task-inspector/services/inspectorFileService';
import type {ProjectFile,ProjectUploadDraft} from '../../src/app/features/project-files/types';
const receipt={id:'stable-id',object_path:'stable-id/document',state:'pending'};
const draft=():ProjectUploadDraft=>({id:'stable-id',file:new File(['plan'],'Plan.pdf',{type:'application/pdf'}),sha256:'a'.repeat(64)});
beforeEach(()=>{vi.resetAllMocks();backend.upload.mockResolvedValue({error:null});});
describe('R6 private project documents',()=>{
 it('recovers an uncertain successful object upload on retry without another object or metadata identity',async()=>{
  let uploaded=false,failed=false;
  backend.upload.mockImplementation(async()=>{uploaded=true;return {error:null};});
  backend.rpc.mockImplementation(async(_name,args)=>{
   if(args.p_command==='commit'&&uploaded&&!failed){failed=true;throw new Error('Receipt response lost');}
   return {data:{...receipt,state:uploaded?'ready':'pending'},error:null};
  });
  const upload=draft();await expect(uploadProjectFile('project','task',upload)).rejects.toThrow('Receipt response lost');
  await expect(uploadProjectFile('project','task',upload)).resolves.toMatchObject({id:'stable-id',state:'ready'});
  expect(backend.upload).toHaveBeenCalledTimes(1);
  expect(backend.upload).toHaveBeenCalledWith('stable-id/document',upload.file,{upsert:false,contentType:'application/pdf'});
  const reservations=backend.rpc.mock.calls.filter(([,args])=>args.p_command==='reserve');
  expect(reservations).toHaveLength(2);expect(reservations[0][1]).toEqual(reservations[1][1]);
 });
 it('accepts committed receipt after a lost upload response, and keeps failed upload drafts stable',async()=>{
  backend.rpc.mockResolvedValueOnce({data:receipt}).mockResolvedValueOnce({data:receipt}).mockResolvedValueOnce({data:{...receipt,state:'ready'}});
  backend.upload.mockResolvedValue({error:{message:'Network error'}});
  const upload=draft();expect((await uploadProjectFile('p',undefined,upload)).state).toBe('ready');expect(upload.id).toBe('stable-id');
 });
 it('rejects unsupported and oversized uploads before reserving metadata',async()=>{
  const bad=draft();bad.file=new File(['<html>'],'Page.html',{type:'text/html'});
  await expect(uploadProjectFile('p','t',bad)).rejects.toThrow('Choose PDF');expect(backend.rpc).not.toHaveBeenCalled();
  expect(validateProjectFile({name:'p.pdf',size:10485761,type:'application/pdf'} as File)).toContain('10 MB');
 });
 it('signs private library objects for 60 seconds and reports missing server capability explicitly',async()=>{
  backend.sign.mockResolvedValue({data:{signedUrl:'signed-private-url'}});
  expect(await openProjectFile(receipt as ProjectFile)).toBe('signed-private-url');expect(backend.sign).toHaveBeenCalledWith('stable-id/document',60);
  backend.rpc.mockResolvedValue({error:{code:'PGRST202',message:'missing function'}});
  await expect(fetchProjectFiles('p','t')).rejects.toThrow('not available on this server');
 });
 it('collects authorized parent/subitem progress and submission provenance in their original buckets',()=>{
  const rows=mapInspectorFiles([{id:'a',file_name:'Parent.pdf',file_path:'task/a',submission_id:'s',created_at:'2026-10-01'}],[{id:'b',attachment_path:'task/b',author_name:'Contributor',created_at:'2026-10-02'}],[{id:'s',version:2,status:'approved',submitter_name:'Task lead'}],[{id:'c',subtask_id:'sub',attachment_path:'sub/c',author_name:'Member',created_at:'2026-10-03'}],[{id:'d',subtask_id:'sub',submission_id:'ss',file_path:'sub/d',created_at:'2026-10-04'}],[{id:'ss',version:1,status:'approved',submitter_name:'Member'}],[{id:'sub',title:'Survey households'}]);
  expect(rows.map(f=>f.bucket)).toEqual(['task-attachments','task-attachments','task-comment-attachments','task-attachments']);
  expect(rows[0].source).toBe('Survey households · Submission 1 (approved)');expect(rows[3].uploader).toBe('Task lead');
  expect(rows.every(f=>f.restriction.includes('rules')||f.restriction.includes('restrictions'))).toBe(true);
 });
});
