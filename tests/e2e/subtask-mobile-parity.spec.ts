import {expect,test,type Page} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {nestedWorkStaffingFixture} from './fixtures/nestedWorkStaffing';

async function setup(page:Page){
 const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 Object.assign(records.projects[0],{status:'active'});
 Object.assign(records.tasks[0],{status:'in_progress',deadline:'2026-12-15',due_date:'2026-12-15'});
 Object.assign(records.subtasks[0],{status:'in_progress',lead_id:records.id,assigned_to_ids:[records.id],started_at:'2026-11-18T00:00:00Z',dependency_ids:[],is_standalone:true});
 const fixture=await nestedWorkStaffingFixture(page,records);
 let revision=1;
 const commands:Array<{p_command:string;p_payload:Record<string,any>}>=[];
 const snapshot=()=>{
  const tree=fixture.snapshot();tree.supportsSubtaskDependencies=true;tree.revision=revision;
  Object.assign(tree.root,{status:'in_progress',project_status:'active',scheduling:{version:1,today:'2026-11-18'},scheduleBounds:{taskStart:'2026-11-18',taskDue:'2026-12-15'}});
  for(const node of tree.nodes){
   const record=records.subtasks.find(item=>item.id===node.id)!;
   Object.assign(node,{started_at:record.started_at||null,dependency_ids:record.dependency_ids??null,can_edit_dependencies:record.status==='todo',restricted_dependency_count:0,pending_dependency_count:0});
   node.capabilities!.execute={allowed:true,reason_code:null};
  }
  return tree;
 };
 await page.route(/\/rest\/v1\/rpc\/r7_work_tree$/,route=>route.fulfill({json:snapshot()}));
 await page.route(/\/rest\/v1\/rpc\/(r7_work_command|nw_work_command)$/,async route=>{
  const body=route.request().postDataJSON();commands.push(body);
  if(body.p_command==='create')records.subtasks.push({...records.subtasks[0],id:body.p_payload.id,title:body.p_payload.title,parent_subtask_id:body.p_payload.parent,lead_id:null,assigned_to_ids:[],status:'todo',started_at:null,dependency_ids:null,is_standalone:body.p_payload.standalone});
  if(body.p_command==='edit')Object.assign(records.subtasks.find(item=>item.id===body.p_payload.id)!,{dependency_ids:body.p_payload.dependency_ids});
  revision++;await route.fulfill({json:snapshot()});
 });
 await page.route(/\/rest\/v1\/subtasks(?:\?|$)/,async route=>{
  const id=new URL(route.request().url()).searchParams.get('id')?.replace(/^eq\./,'');
  await route.fulfill({json:id?records.subtasks.find(item=>item.id===id):records.subtasks});
 });
 await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'My Work',exact:true}).click();
 await page.getByRole('navigation',{name:'My Work destinations'}).getByRole('button',{name:'Work I lead',exact:true}).click();
 await page.locator('[data-personal-task]').filter({hasText:'Prepare community assessment'}).click();
 const task=page.getByRole('dialog',{name:'Task details: Prepare community assessment',exact:true});
 await task.getByRole('tab',{name:'Work',exact:true}).click();
 return {records,task,commands};
}

test('new subtasks use independent prerequisites by default without changing earlier work',async({page})=>{
 test.setTimeout(60_000);
 const {records,task,commands}=await setup(page);
 await task.getByRole('button',{name:'Add subtask',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Add subtask',exact:true});
 await expect(dialog.getByRole('group',{name:'Prerequisite subtasks'})).toBeVisible();
 await expect(dialog.getByLabel('Work order')).toHaveCount(0);
 await expect(dialog.getByRole('checkbox').filter({has:page.locator(':checked')})).toHaveCount(0);
 await dialog.getByLabel('Subtask title').fill('Independent specialist review');
 await dialog.getByRole('button',{name:'Add subtask',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 expect(commands.map(command=>command.p_command)).toEqual(['create','edit']);
 expect(commands[0].p_payload.standalone).toBe(true);
 expect(commands[1].p_payload.dependency_ids).toEqual([]);
 expect(records.subtasks[0].dependency_ids).toEqual([]);
});

test('an uncertain blocker update keeps the draft and disables blind retries',async({page},info)=>{
 test.setTimeout(60_000);
 const {task}=await setup(page);let writes=0;
 await page.route(/\/rest\/v1\/rpc\/save_subtask_work_update$/,async route=>{
  writes++;await route.fulfill({status:503,json:{code:'08006',message:'Connection lost before the response was received'}});
 });
 await task.getByRole('button',{name:'Gather supporting evidence',exact:true}).click();
 const subtask=page.getByRole('dialog',{name:'Subtask: Gather supporting evidence',exact:true});
 const form=subtask.getByRole('region',{name:'Work status and update'});
 await form.getByLabel('Work status').selectOption('stuck');
 await form.getByLabel('Blocker reason').fill('Waiting for equipment');
 await form.getByLabel('Work update').fill('Keep this note until the result is verified');
 await form.getByRole('button',{name:'Report blocker'}).click();
 await expect(subtask.getByText(/check its work history before posting again/)).toBeVisible();
 await expect(form.getByRole('button',{name:'Report blocker'})).toBeDisabled();
 await expect(form.getByLabel('Work update')).toHaveValue('Keep this note until the result is verified');
 expect(writes).toBe(1);
 await page.setViewportSize({width:390,height:844});
 await expect(subtask.getByText(/check its work history before posting again/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('uncertain-blocker-update.png')});
});

test('started subtask editing explains planning locks and places a changed-date reason below the date',async({page},info)=>{
 test.setTimeout(60_000);
 const {task}=await setup(page);
 await task.getByRole('button',{name:'Actions for Gather supporting evidence',exact:true}).click();
 await page.getByRole('menuitem',{name:'Edit subtask',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Edit subtask',exact:true});
 await expect(dialog.getByText(/Start date and prerequisites cannot be changed/)).toBeVisible();
 await expect(dialog.getByLabel('Subtask start date')).toBeDisabled();
 await expect(dialog.getByRole('group',{name:'Prerequisite subtasks'})).toHaveAttribute('disabled','');
 const due=dialog.getByLabel('Subtask due date'),reason=dialog.getByLabel('Reason for due date change');
 const original=await due.inputValue();
 await expect(reason).toHaveCount(0);
 await due.fill('12/14/2026');
 await expect(reason).toBeVisible();
 await reason.fill('Approved schedule extension');
 await page.setViewportSize({width:390,height:844});
 await reason.scrollIntoViewIfNeeded();
 const dateBox=await due.boundingBox(),reasonBox=await reason.boundingBox();
 expect(reasonBox!.y).toBeGreaterThan(dateBox!.y+dateBox!.height);
 await expect(dialog.getByText(/Estimated (hours|days)/i)).toHaveCount(0);
 await page.screenshot({path:info.outputPath('started-subtask-date-reason.png')});
 await due.fill(original);
 await expect(reason).toHaveCount(0);
});

test('started task editing omits hours and cancellation and only reveals the changed-date reason',async({page})=>{
 test.setTimeout(60_000);
 const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 Object.assign(records.tasks[0],{status:'in_progress',start_date:'2026-11-18',deadline:'2026-12-15',due_date:'2026-12-15'});
 await page.route('**/rest/v1/rpc/work_detail_edit_state',route=>route.fulfill({json:{version:1,task_id:records.tasks[0].id,node_id:null,updated_at:null,started:true,details:true,due:true,planning:false}}));
 await page.goto(`/projects?page=Projects&workspace=${records.org}&project=${records.project}&view=tasks`);
 await page.getByRole('button',{name:'Actions for Prepare community assessment',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'Cancel task',exact:true})).toHaveCount(0);
 await page.getByRole('menuitem',{name:'Edit task',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Edit task',exact:true});
 await expect(dialog.getByText(/Start date and prerequisites cannot be changed/)).toBeVisible();
 await expect(dialog.getByLabel('Start date')).toBeDisabled();
 await expect(dialog.getByText(/Estimated (hours|days)/i)).toHaveCount(0);
 const due=dialog.getByLabel('Due date'),reason=dialog.getByLabel('Reason for due-date change');
 await expect(reason).toHaveCount(0);
 await due.fill('12/16/2026');await expect(reason).toBeVisible();
 const dateBox=await due.boundingBox(),reasonBox=await reason.boundingBox();
 expect(reasonBox!.y).toBeGreaterThan(dateBox!.y+dateBox!.height);
 await due.fill('12/15/2026');await expect(reason).toHaveCount(0);
});
