import { openProjectAction, openCompletionRequirements } from './fixtures/projectActions';
import { test, expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';
const kinds=['structure','dates','budget'];
async function readinessFixture(page: Page, records: Awaited<ReturnType<typeof projectWorkspaceFixture>>) {
 const reviewed=new Set<string>(); let activated=0,closed=0;
 await page.route('**/rest/v1/rpc/phase7_*',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1);const payload=route.request().postDataJSON();let data:unknown=null;
  if(name==='phase7_review_project')reviewed.add(payload.p_kind);
  if(name==='phase7_activate_project'){activated++;records.projects[0].status='active';}
  if(name==='phase7_project_readiness')data={projectId:records.project,governed:false,ready:reviewed.size===3,canActivate:reviewed.size===3&&records.projects[0].status!=='active',stage:records.projects[0].status==='active'?'Active':reviewed.size===3?'Ready':'Planning',checks:[...kinds.map(key=>({key,label:key==='structure'?'Project structure reviewed':key==='dates'?'Project dates confirmed':'Budget information reviewed',ok:reviewed.has(key),detail:'Current revision requires Lead Head review.'})),{key:'staffing',label:'Required task owners assigned',ok:true,detail:'All required owners selected by their own Office.'}]};
  if(name==='phase7_closeout_summary')data={tasks:3,completed:1,cancelled:0,budgetEstimate:1500,offices:1,evidence:1,contributors:2,startDate:'2026-10-01',targetDate:'2026-10-25',financial:{requested:500,approved:500,settled:1,open:0}};
  await route.fulfill({json:data});
 });
 await page.route('**/rest/v1/rpc/get_project_completion_readiness',route=>route.fulfill({json:{projectId:records.project,title:'Community outreach',status:'planning',canComplete:false,blockers:[{kind:'task',id:records.tasks[0].id,taskId:records.tasks[0].id,title:'Prepare community assessment',status:'in_progress',detail:'Complete work and have its evidence reviewed before closeout.'}]}}));
 await page.route('**/rest/v1/rpc/complete_project',route=>{closed++;return route.fulfill({json:null});});
 return {reviewed,get activated(){return activated;},get closed(){return closed;}};
}
test('Head confirms readiness; desktop and mobile retain readable checks and closeout blockers',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const records=await projectWorkspaceFixture(page,'head');const flow=await readinessFixture(page,records);
 await openCompletionRequirements(page);
 const panel=page.getByRole('region',{name:'Project readiness reviews'});await expect(panel).toBeVisible();
 await expect(panel.getByRole('button',{name:'Activate project',exact:true})).toBeDisabled();
 await expect(page.getByRole('dialog',{name:'Mark project complete',exact:true}).getByRole('button',{name:'Confirm completion',exact:true})).toBeDisabled();
 for(const label of ['Project structure reviewed','Project dates confirmed','Budget information reviewed']) {const check=panel.locator('li').filter({hasText:label});await check.getByRole('button',{name:'Confirm review',exact:true}).click();await expect(check.getByRole('button',{name:'Reviewed',exact:true})).toBeVisible();}
 await expect(panel.getByRole('button',{name:'Activate project',exact:true})).toBeEnabled();
 await page.screenshot({path:info.outputPath('readiness-desktop.png')});
 await panel.getByRole('button',{name:'Activate project',exact:true}).click();await page.getByRole('alertdialog',{name:'Activate this project?'}).getByRole('button',{name:'Activate project',exact:true}).click();await expect.poll(()=>flow.activated).toBe(1);expect(flow.closed).toBe(0);
 await expect(panel.getByRole('status').filter({hasText:'Project activated.'})).toContainText('activated');
 await page.setViewportSize({width:390,height:844});await expect(panel).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect.poll(async()=>panel.locator('li').evaluateAll(rows=>rows.every(row=>{const bounds=row.getBoundingClientRect();return bounds.width>200&&bounds.height>50;}))).toBe(true);
 await panel.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('readiness-mobile.png')});expect(errors).toEqual([]);
});
test('Staffing is advisory until Head confirmation; roomy dialog supports keyboard selection and mobile footer',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});const records=await projectWorkspaceFixture(page,'head');
 Object.assign(records.tasks[0],{status:'pending_assignment',assigned_to:null,team_member_ids:[]});
 const candidates=Array.from({length:4},(_,i)=>({id:'candidate-'+i,name:'Office Specialist '+i,skills:['Community assessment'],training:['Survey methods'],education:[],experience:[],specializations:[],certifications:[],experience_summary:'',activeTasks:i+1,remainingHours:(i+1)*4,unknownEffortTasks:1}));
 let assigned=0;
 await page.route('**/controlpanelEflow/api/staffing/**',route=>route.fulfill({json:{task:{id:records.tasks[0].id,title:records.tasks[0].title,description:'Prepare assessment',skills:['Community assessment']},candidates,excludedUnconfirmed:2}}));
 await page.route('**/controlpanelEflow/api/ai/status',route=>route.fulfill({json:{ai_endpoint:'http://127.0.0.1:5190/controlpanelEflow/api',ai_endpoint_status:'online',ai_endpoint_heartbeat:new Date().toISOString()}}));
 await page.route('**/controlpanelEflow/api/ai/jobs',route=>{expect(route.request().postDataJSON().workspace_staffing.taskId).toBe(records.tasks[0].id);return route.fulfill({status:202,json:{job_id:'staffing-job',status:'completed',position:null,jobs_ahead:0,queue_depth:0,result:{message:{content:JSON.stringify({schemaVersion:1,recommendations:candidates.map(p=>({userId:p.id,evidence:['Community assessment','Survey methods']}))})}}}});});
 await page.route('**/rest/v1/rpc/assign_task_with_details',route=>{assigned++;const payload=route.request().postDataJSON();Object.assign(records.tasks[0],{assigned_to:payload.p_assignee,assignee_name:payload.p_assignee_name,status:'todo'});return route.fulfill({json:[records.tasks[0]]});});
 await page.goto('/projects?page=Projects&project='+records.project+'&view=tasks');await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Actions for Prepare community assessment'}).click();await page.getByRole('menuitem',{name:'Recommend staff',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Recommend staff',exact:true});await expect(dialog).toContainText('4 eligible confirmed profiles');
 await dialog.getByRole('button',{name:'Generate recommendations',exact:true}).click();await expect(dialog).toContainText('Office Specialist 3');
 expect(assigned).toBe(0);await expect(dialog.getByRole('button',{name:'Confirm owner'})).toBeDisabled();
 const bounds=(await dialog.boundingBox())!;expect(bounds.width).toBeGreaterThan(850);expect(bounds.height).toBeGreaterThan(600);
 const visibleCards=await dialog.locator('.p7-staff-card').evaluateAll(cards=>cards.filter(card=>{const bounds=card.getBoundingClientRect();const body=card.closest('.p7-staff-body')!.getBoundingClientRect();return bounds.top>=body.top&&bounds.bottom<=body.bottom;}).length);expect(visibleCards).toBeGreaterThanOrEqual(4);
 await page.screenshot({path:info.outputPath('staffing-desktop.png')});
 await page.setViewportSize({width:390,height:844});await expect(dialog).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const footer=(await dialog.getByRole('button',{name:'Confirm owner'}).boundingBox())!;expect(footer.y+footer.height).toBeLessThanOrEqual(844);expect(footer.x+footer.width).toBeLessThanOrEqual(390);
 const mobileBounds=(await dialog.boundingBox())!;expect(Math.round(mobileBounds.width)).toBe(390);expect(Math.round(mobileBounds.height)).toBe(844);
 await dialog.locator('.p7-staff-card').first().scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('staffing-mobile.png')});
 await dialog.getByRole('radio').first().check();await dialog.getByRole('button',{name:'Confirm owner'}).click();
 const assignmentResponse=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname.endsWith('/rpc/assign_task_with_details'));
 await page.getByRole('alertdialog',{name:'Assign recommended owner?'}).getByRole('button',{name:'Assign owner',exact:true}).click();
 const response=await assignmentResponse;
 expect(response.status()).toBe(200);
 expect(response.request().postDataJSON()).toMatchObject({p_task_id:records.tasks[0].id,p_assignee:candidates[0].id,p_assignee_name:candidates[0].name,p_team_member_ids:[candidates[0].id]});
 await expect(page.getByRole('dialog',{name:'Recommend staff',exact:true,includeHidden:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Open Prepare community assessment',exact:true}).click();
 const inspector=page.getByRole('dialog',{name:'Task details: Prepare community assessment'});
 await inspector.getByRole('button',{name:'Details',exact:true}).click();
 await expect(inspector.getByText('Assignee',{exact:true}).locator('..')).toContainText(candidates[0].name);
 expect(assigned).toBe(1);
});
test('Member reads readiness without Head review, activation or staffing controls',async({page})=>{
 const records=await projectWorkspaceFixture(page,'member');await readinessFixture(page,records);
 await openProjectAction(page,'Project settings');await page.getByText('Plan reviews',{exact:true}).click();const panel=page.getByRole('region',{name:'Project readiness reviews'});await expect(panel).toBeVisible();
 await expect(panel.getByRole('button',{name:'Confirm review'})).toHaveCount(0);await expect(panel.getByRole('button',{name:'Activate project'})).toHaveCount(0);await expect(panel.getByRole('button',{name:'Close project'})).toHaveCount(0);
});
