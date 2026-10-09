import {test,expect,type Page} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {personalWorkspaceFixture} from './fixtures/personalWorkspace';
const title='Prepare community assessment';
const reference={id:'70000000-0000-4000-8000-000000000001',file_name:'Project reference.pdf',file_size:20,mime_type:'application/pdf',object_path:'70000000-0000-4000-8000-000000000001/document',uploader_name:'Office colleague',uploader_id:'colleague',created_at:'2026-10-01T00:00:00Z',state:'ready',links:0,linked:false,can_remove:false};
async function filesFixture(page:Page,role:'head'|'member'|'admin'='head',shared=false){
 const records=await projectWorkspaceFixture(page,role,true,{shared});
 const files:any[]=[{...reference,project_id:records.project}],uploaded=new Set<string>();let uploads=0,lostReceipt=true;
 await page.route('**/rpc/r6_list_project_files',route=>route.fulfill({json:{can_write:role!=='admin'&&!shared&&!['completed','archived'].includes(String(records.projects[0].status)),files:files.filter(f=>f.state==='ready')}}));
 await page.route('**/rpc/r6_project_file_command',async route=>{
  const {p_command:command,p_payload:payload,p_task:task}=route.request().postDataJSON();let file=files.find(f=>f.id===payload.id);
  if(command==='reserve'&&!file){file={...reference,id:payload.id,file_name:payload.name,file_size:payload.size,mime_type:payload.type,object_path:payload.id+'/document',uploader_id:records.id,uploader_name:'Alex Rivera',state:'pending',project_id:records.project,can_remove:true};files.push(file);}
  if(!file)return route.fulfill({status:403,json:{message:'Unknown project file'}});
  if(command==='commit'&&uploaded.has(file.id)){file.state='ready';file.linked=!!task;file.links=task?1:0;if(lostReceipt){lostReceipt=false;return route.fulfill({status:500,json:{message:'File saved; receipt response interrupted'}});}}
  if(command==='link'){file.linked=true;file.links=1;file.link={linked_by:records.id,linked_at:new Date().toISOString()};}
  if(command==='unlink'){file.linked=false;file.links=0;}
  if(command==='remove')file.state='removed';
  return route.fulfill({json:file});
 });
 const signing:any[]=[];
 await page.route('**/storage/v1/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/object/sign/')){signing.push({path:url.pathname,...route.request().postDataJSON()});return route.fulfill({json:{signedURL:'/object/sign/project-library/private?token=synthetic'}});}
  if(route.request().method()==='POST'){uploads++;uploaded.add(url.pathname.split('/').at(-2)!);return route.fulfill({json:{Key:url.pathname,Id:'synthetic'}});}
  return route.fulfill({status:404,body:'Synthetic private files'});
 });
 const task=String(records.tasks[0].id),sub=String(records.subtasks[0].id);
 const evidence:Record<string,unknown[]>={
  task_attachments:[{id:'parent-file',task_id:task,submission_id:'attempt',file_name:'Approved evidence.pdf',file_path:task+'/evidence.pdf',uploader_name:'Alex Rivera',created_at:'2026-10-02'}],
  task_submissions:[{id:'attempt',task_id:task,version:1,status:'approved',submitter_name:'Alex Rivera',note:'Accepted evidence',submitted_at:'2026-10-02'}],
  task_progress_updates:[{id:'progress',task_id:task,author_name:'Alex Rivera',percent_complete:40,note:'Survey started',attachment_name:'Progress photo.png',attachment_path:task+'/progress.png',created_at:'2026-10-03'}],
  subtask_submission_attachments:[{id:'child-file',task_id:task,subtask_id:sub,submission_id:'child-attempt',file_name:'Subitem evidence.pdf',file_path:sub+'/child.pdf',created_at:'2026-10-04'}],
  subtask_submissions:[{id:'child-attempt',task_id:task,subtask_id:sub,version:1,status:'approved',submitter_name:'Team member',note:'Child evidence',submitted_at:'2026-10-04'}],
 };
 for(const [table,rows] of Object.entries(evidence))await page.route(`**/rest/v1/${table}?**`,route=>route.fulfill({json:rows}));
 return {records,files,signing,get uploads(){return uploads;}};
}
async function open(page:Page){await page.getByRole('button',{name:'Open '+title,exact:true}).click();return page.getByRole('dialog',{name:'Task details: '+title});}
test.beforeEach(async({page})=>{test.setTimeout(90000);await page.setViewportSize({width:1440,height:1000});});
test('R6 compact header has exactly three tabs, expandable metadata and authorized workflow files',async({page},info)=>{
 const fixture=await filesFixture(page);const inspector=await open(page);
 await expect(inspector.getByRole('tab')).toHaveText(['Updates','Files','Activity']);await expect(inspector.getByRole('button',{name:'Details',exact:true})).toHaveAttribute('aria-expanded','false');
 await expect(inspector.getByLabel('Task team and subtasks')).toHaveCount(0);await expect(inspector.getByText('Survey started')).toBeVisible();
 await inspector.getByRole('button',{name:'Details',exact:true}).first().click();await expect(inspector.getByLabel('Task team and subtasks')).toBeVisible();await expect(inspector).toContainText('Estimated hours');
 await inspector.getByRole('button',{name:'Details',exact:true}).first().click();await inspector.getByRole('tab',{name:'Files',exact:true}).click();
 await expect(inspector.getByRole('button',{name:'Approved evidence.pdf',exact:true})).toBeVisible();await expect(inspector.getByRole('button',{name:'Subitem evidence.pdf',exact:true})).toBeVisible();
 await expect(inspector).toContainText('Submission 1 (approved)');await expect(inspector).toContainText('Team member');await expect(inspector.getByRole('button',{name:'Progress photo.png',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('r6-files-desktop.png'),fullPage:true,animations:'disabled'});
 await inspector.getByRole('button',{name:'Insert from project library'}).click();await inspector.getByRole('button',{name:'Insert Project reference.pdf',exact:true}).click();
 await expect(inspector.getByRole('button',{name:'Project reference.pdf',exact:true})).toBeVisible();await inspector.getByRole('button',{name:'Project reference.pdf',exact:true}).click();
 await expect.poll(()=>fixture.signing.length).toBe(1);expect(fixture.signing[0].expiresIn).toBe(60);expect(fixture.signing[0].path).toContain('/project-library/');
 expect(fixture.files[0].linked).toBe(true);await expect(inspector.getByRole('button',{name:/Delete evidence|Remove evidence/})).toHaveCount(0);
});
test('R6 guarded upload retries a committed file once and keeps successful metadata and object identity',async({page},info)=>{
 const fixture=await filesFixture(page);const inspector=await open(page);await inspector.getByRole('tab',{name:'Files',exact:true}).click();
 await inspector.getByLabel('Upload a project document').setInputFiles({name:'New plan.pdf',mimeType:'application/pdf',buffer:Buffer.from('private plan')});
 await inspector.getByRole('tab',{name:'Activity',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(inspector.getByRole('tab',{name:'Files',exact:true})).toHaveAttribute('aria-selected','true');
 await inspector.getByRole('button',{name:'Save document / retry'}).click();await expect(inspector.getByRole('alert')).toContainText('receipt response interrupted');
 expect(fixture.uploads).toBe(1);await inspector.getByRole('button',{name:'Save document / retry'}).click();
 await expect(inspector.getByText('Document saved to the project library.')).toBeVisible();await expect(inspector.getByRole('button',{name:'New plan.pdf',exact:true})).toBeVisible();expect(fixture.uploads).toBe(1);expect(fixture.files.filter(f=>f.file_name==='New plan.pdf')).toHaveLength(1);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:info.outputPath('r6-upload-mobile.png'),fullPage:true,animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await inspector.getByRole('button',{name:'Close task detail'}).click();await expect(page.getByRole('button',{name:'Open '+title,exact:true})).toBeFocused();
});
test('R6 eligible review is contextual and its draft is guarded',async({page},info)=>{
 const {records}=await filesFixture(page);Object.assign(records.tasks[0],{status:'for_review',reviewer_id:records.id});await page.reload();await expect(page.getByRole('table',{name:'To do tasks',exact:true})).toBeVisible({timeout:30000});
 const inspector=await open(page);await expect(inspector.getByRole('tab')).toHaveText(['Updates','Files','Activity']);await inspector.getByRole('button',{name:'Review submission',exact:true}).click();
 await inspector.getByRole('button',{name:'Request changes',exact:true}).click();await inspector.getByRole('textbox').fill('Review correction');await inspector.getByRole('button',{name:'Close review',exact:true}).click();
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(inspector.getByRole('textbox')).toHaveValue('Review correction');await page.screenshot({path:info.outputPath('r6-contextual-review.png'),fullPage:true,animations:'disabled'});
 await inspector.getByRole('button',{name:'Close review',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();await expect(inspector.getByLabel('Submission review')).toHaveCount(0);
});
for(const actor of ['observer','archived'] as const)test(`R6 ${actor} keeps files/history readable and has no document or review mutations`,async({page},info)=>{
 const {records}=await filesFixture(page,actor==='observer'?'member':'head',actor==='observer');
 if(actor==='archived'){records.projects[0].status='archived';await page.reload();await expect(page.getByRole('table',{name:'To do tasks',exact:true})).toBeVisible({timeout:30000});}
 const inspector=await open(page);await expect(inspector.getByText('Read-only oversight record')).toBeVisible();await expect(inspector.getByRole('button',{name:'Review submission',exact:true})).toHaveCount(0);
 await inspector.getByRole('tab',{name:'Files',exact:true}).click();await expect(inspector.getByRole('button',{name:'Approved evidence.pdf',exact:true})).toBeVisible();await expect(inspector.getByLabel('Upload a project document')).toHaveCount(0);
 await inspector.getByRole('tab',{name:'Activity',exact:true}).click();await expect(inspector.getByText('Survey started')).toBeVisible();
 if(actor==='observer'){await page.setViewportSize({width:320,height:740});await page.screenshot({path:info.outputPath('r6-observer-activity-320.png'),fullPage:true,animations:'disabled'});}
});
test('R6 personal project and task file reads retain their personal home and clear on scope switch',async({page},info)=>{
 const fixture=await personalWorkspaceFixture(page,{seed:true});
 fixture.personalTasks.push({id:'72000000-0000-4000-8000-000000000001',project_id:fixture.projectId,title:'Private research task',lead_id:fixture.id,reviewer_id:null,status:'todo',progress:0,revision:1});
 const calls:any[]=[];
 await page.route('**/rpc/r6_list_project_files',route=>{const args=route.request().postDataJSON();calls.push(args);return route.fulfill({json:{can_write:true,files:[{...reference,project_id:fixture.projectId,project_kind:'personal',file_name:'Private reference.pdf',linked:!!args.p_task}]}});});
 await page.goto(`/projects?workspace=${fixture.personalId}&project=${fixture.projectId}`);await expect(page.getByRole('region',{name:'Selected personal project'})).toBeVisible();
 await page.getByRole('button',{name:'Files for Private research task',exact:true}).click();const inspector=page.getByRole('dialog',{name:'Task files: Private research task'});await expect(inspector.getByRole('button',{name:'Private reference.pdf',exact:true})).toBeVisible();
 expect(calls.every(c=>c.p_project===fixture.projectId)).toBe(true);expect(calls.some(c=>c.p_task===fixture.personalTasks[0].id)).toBe(true);
 await page.screenshot({path:info.outputPath('r6-personal-project-files.png'),fullPage:true,animations:'disabled'});await inspector.getByRole('button',{name:'Close task files',exact:true}).click();
 await expect(page.getByRole('button',{name:'Files for Private research task',exact:true})).toBeFocused();
 await page.goto(`/projects?workspace=${fixture.org}&project=${fixture.project}`);await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();await expect(page.getByText('Private reference.pdf',{exact:true})).toHaveCount(0);
});
