import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
test('desktop project setup precedes tasks and derives a funding envelope from two accounts',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 records.groups.push({id:'30000000-0000-4000-8000-000000000002',project_id:records.project,title:'Project coordination',color:'#087972',position:1,is_default:false});
 const p:any={...records.projects[0],description:'',scope:'',project_lead_id:null,start_date:null,target_date:null,funding_not_required:false};let ready=false;const funds:any[]=[];const commands:any[]=[];
 const source='70000000-0000-4000-8000-000000000001';
 const travel='70000000-0000-4000-8000-000000000002';
 await page.route(/\/rest\/v1\/rpc\/(project_flow_snapshot|save_project_definition|finish_project_setup|authorize_project_funding)$/,async route=>{
 const op=route.request().url().split('/').at(-1),body=route.request().postDataJSON();
 if(op==='project_flow_snapshot')return route.fulfill({json:{project:p,ready,canAuthorize:true,canAllocate:true,funds,sources:[{id:source,name:'Community services appropriation',year:2027,available:2000000},{id:travel,name:'Travel appropriation',year:2027,available:500000}],total:funds.reduce((sum,line)=>sum+line.amount,0),allocated:0,unallocated:funds.reduce((sum,line)=>sum+line.amount,0),released:0,spent:0,requests:[],fundingRequests:[],taskFunding:[],liquidations:[]}});
 commands.push({op,...body});
 if(op==='save_project_definition'){const d=body.p_details;Object.assign(p,{title:d.title,description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end,funding_not_required:d.noFunding,updated_at:new Date().toISOString()});return route.fulfill({json:p});}
 if(op==='authorize_project_funding'){if(!p.scope)return route.fulfill({status:400,json:{code:'23514',message:'Save complete project details before funding.'}});for(const line of body.p_lines)funds.push({id:crypto.randomUUID(),name:line.partitionId===travel?'Travel appropriation':'Community services appropriation',fiscal_year:2027,amount:line.amount,available:line.amount});return route.fulfill({json:{authorized:700000}});}
 if(op==='finish_project_setup'){if(!p.description||!p.scope||!p.project_lead_id||!p.start_date||!p.target_date||!funds.length)return route.fulfill({status:400,json:{code:'23514',message:'Complete project details and funding before adding tasks or people.'}});ready=true;return route.fulfill({json:null});}
 });
 await page.goto(`/projects?page=Projects&workspace=${records.org}&project=${records.project}&view=settings`);
 const definition=page.getByRole('region',{name:'Project definition'});await expect(definition).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'+ Add people',exact:true})).toHaveCount(0);
 await definition.getByRole('button',{name:'Continue project setup'}).click();const wizard=page.locator('.eflow-responsive-modal').filter({has:page.locator('.pf-wizard-modal')});await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Next',exact:true}).click();const error=wizard.getByRole('alert');await expect(error).toContainText('title and description');await expect(error).toHaveCSS('color','rgb(161, 18, 45)');await page.screenshot({path:info.outputPath('setup-validation-red-alert.png'),fullPage:true});
 await wizard.getByLabel('Description *').fill('Support local enterprises through registration and training.');await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByLabel('Scope of the project *').fill('Two quarterly workshops and participant support.');await page.screenshot({path:info.outputPath('project-scope-step.png'),fullPage:true});await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByLabel('Project lead *').selectOption(records.id);await wizard.getByLabel('Project start date *').fill('2027-01-01');await wizard.getByLabel('Project target date *').fill('2027-06-30');await wizard.getByRole('button',{name:'Next',exact:true}).click();
 const budget=wizard.getByRole('region',{name:'Project budget'});await budget.getByLabel('Fiscal year').selectOption('2027');await budget.getByLabel('Office Budget source').selectOption(source);await budget.getByRole('spinbutton').fill('300000');await budget.getByRole('button',{name:'Add funding source'}).click();await budget.getByLabel('Fiscal year').nth(1).selectOption('2027');await budget.getByLabel('Office Budget source').nth(1).selectOption(travel);await budget.getByRole('spinbutton').nth(1).fill('400000');await budget.getByLabel('Reason / approved authority reference').fill('Approved annual community services work program');
 await page.screenshot({path:info.outputPath('project-definition-funding.png'),fullPage:true});
 await budget.getByRole('button',{name:'Authorize project funding'}).click();await expect(budget.getByText('₱700,000.00',{exact:true}).first()).toBeVisible();
 await wizard.getByRole('button',{name:'Next',exact:true}).click();await expect(wizard.getByRole('heading',{name:'Ready to build the work plan?'})).toBeVisible();await expect(wizard.getByText('FY 2027 · Community services appropriation',{exact:true})).toBeVisible();
 await page.setViewportSize({width:1180,height:900});await page.screenshot({path:info.outputPath('budget-desktop-1180.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await wizard.getByRole('button',{name:'Next: Add people'}).click();await expect(wizard.getByRole('heading',{name:'Add people'})).toBeVisible();
 await wizard.getByRole('button',{name:'Next: Draft tasks'}).click();
 await expect(wizard.getByRole('heading',{name:'Draft tasks'})).toBeVisible();
 await wizard.getByRole('button',{name:'Open project',exact:true}).click();await expect(page).toHaveURL(/view=tasks/);await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
 const menu=page.getByRole('button',{name:'Actions for Prepare community assessment',exact:true});await menu.click();await expect(page.getByRole('menuitem',{name:'Edit task',exact:true})).toBeVisible();await page.getByRole('menuitem',{name:'Move to',exact:true}).hover();await expect(page.getByRole('menuitem',{name:'Project coordination',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('task-actions-submenu.png'),fullPage:true});
 expect(commands.some(c=>c.op==='authorize_project_funding'&&c.p_lines[0].amount===300000&&c.p_lines[1].partitionId===travel&&c.p_lines[1].amount===400000)).toBe(true);
});

test('Create project saves the team and only selected template work before opening the task table',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});const id=crypto.randomUUID();let ready=false;const p:any={...records.projects[0],id,title:'',description:'',scope:'',project_lead_id:null,start_date:null,target_date:null,funding_not_required:false};let creates=0;
 const officeId=crypto.randomUUID(), teammateId=crypto.randomUUID();
 records.profiles.push({id:teammateId,org_id:records.org,full_name:'QA Team Member',email:'qa-team@example.test',role:'member',is_active:true});
 const teamWrites: string[][]=[];
 const groupId=crypto.randomUUID();
 const taskWrites: string[]=[];
 await page.route('**/rest/v1/rpc/r7_work_tree',route=>{
  const root=route.request().postDataJSON().p_root;
  const nodes=records.subtasks.filter(step=>step.task_id===root).map(step=>({
   ...step,parent_subtask_id:null,lead_id:null,assigned_to_ids:[],sibling_order:step.position,depth:1,is_standalone:true,
  }));
  return route.fulfill({json:{root:{id:root,project:id,office:records.org,kind:'office',open:true,people:[]},revision:1,nodes,people:[],leaf_total:nodes.length,leaf_completed:0}});
 });
 await page.route(/\/rest\/v1\/project_task_templates(?:\?|$)/,route=>route.fulfill({json:[{
  id:'seminar',name:'Seminar or training',groups:[{title:'Event preparation',tasks:[
   {title:'Draft the agenda',subtasks:['Confirm topics','Draft speaker notes']},
   {title:'Reserve the room',subtasks:['Verify venue availability']},
   {title:'Print registration sheets',subtasks:[]},
   {title:'Invite attendees',subtasks:[]},
  ]}],
 }]}));
 await page.route('**/rest/v1/rpc/save_project_setup_tasks',route=>{
  const {p_project_id,p_review}=route.request().postDataJSON();
  expect(p_project_id).toBe(id);
  expect(p_review.setupSource).toBe('template');
  expect(p_review.groups[0].tasks[0].subitems).toEqual([{title:'Confirm topics',dueDate:''}]);
  records.groups.push({id:groupId,project_id:id,title:'Event preparation',color:'#087972',position:1,is_default:false});
  const taskIds: Record<string,string>={};
  for(const task of p_review.groups[0].tasks){
   const taskId=crypto.randomUUID();taskIds[task.key]=taskId;taskWrites.push(task.title);
   records.tasks.push({id:taskId,title:task.title,linked_project_id:id,project_id:id,group_id:groupId,org_id:records.org,status:'todo',priority:'medium'});
   for(const [position, item] of task.subitems.entries()) records.subtasks.push({id:crypto.randomUUID(),task_id:taskId,title:item.title,status:'todo',source:'template',position});
  }
  return route.fulfill({json:{taskCount:3,subitemCount:2,groupCount:1,taskIds,groupIds:[groupId]}});
 });
 await page.route('**/rest/v1/rpc/r9_selection_preview',route=>route.fulfill({json:{fingerprint:'reviewed-team',removed:[]}}));
 await page.route('**/rest/v1/rpc/r9_select_members',route=>{
  const args=route.request().postDataJSON();
  expect(ready).toBe(true);expect(args.p_office).toBe(officeId);expect(args.p_fingerprint).toBe('reviewed-team');
  teamWrites.push(args.p_users);
  for(const user of args.p_users)if(!records.officeMembers.some(member=>member.user_id===user&&member.project_office_id===officeId))records.officeMembers.push({project_office_id:officeId,user_id:user});
  return route.fulfill({json:args.p_users});
 });
 await page.route(/\/rest\/v1\/rpc\/(create_project_with_details|project_flow_snapshot|save_project_definition|finish_project_setup)$/,async route=>{
  const name=route.request().url().split('/').at(-1),body=route.request().postDataJSON();
  if(name==='create_project_with_details'){creates++;Object.assign(p,body.p_payload);records.projects.push(p);records.projectOffices.splice(0,records.projectOffices.length,{id:officeId,project_id:id,office_id:records.org,relationship_type:'lead',invitation_status:'joined'});return route.fulfill({json:p});}
  if(name==='project_flow_snapshot')return route.fulfill({json:{project:p,ready,canAuthorize:true,canAllocate:true,funds:[],sources:[],total:0,allocated:0,unallocated:0,released:0,spent:0,requests:[],fundingRequests:[],taskFunding:[],liquidations:[]}});
  if(name==='save_project_definition'){const d=body.p_details;Object.assign(p,{title:d.title,description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end,funding_not_required:d.noFunding,updated_at:new Date().toISOString()});return route.fulfill({json:p});}
  ready=true;records.officeMembers.push({project_office_id:officeId,user_id:records.id});return route.fulfill({json:null});
 });
 await page.goto(`/projects?page=Projects&workspace=${records.org}`);await page.getByRole('button',{name:'Create project',exact:true}).click();const wizard=page.locator('.eflow-responsive-modal').filter({has:page.locator('.pf-wizard-modal')});await expect(wizard).toBeVisible();expect((await wizard.boundingBox())!.width).toBeGreaterThan(1000);
 await wizard.getByLabel('Project type (optional)').selectOption('seminar');
 await wizard.getByLabel('Project title *').fill('QA connected creation');await wizard.getByLabel('Description *').fill('Create the project through one guided dialog.');await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByLabel('Scope of the project *').fill('A non-financial internal planning activity.');await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByLabel('Project lead *').selectOption(records.id);await wizard.getByLabel('Project start date *').fill('2027-01-01');await wizard.getByLabel('Project target date *').fill('2027-01-31');expect(creates).toBe(0);await page.screenshot({path:info.outputPath('connected-create-lead-dates.png'),fullPage:true});await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByLabel('No funding required for this project').check();await wizard.getByRole('button',{name:'Next',exact:true}).click();await expect(wizard.getByRole('heading',{name:'Ready to build the work plan?'})).toBeVisible();
 await wizard.getByRole('button',{name:'Next: Add people'}).click();
 await expect(wizard.getByText(/Step 6 of 7/)).toBeVisible();
 await expect(wizard.getByRole('checkbox',{name:/Alex Rivera/})).toBeChecked();
 await wizard.getByRole('textbox',{name:'Search Office members'}).fill('QA Team');
 await wizard.getByRole('checkbox',{name:/QA Team Member/}).check();
 await page.screenshot({path:info.outputPath('connected-create-add-people.png'),fullPage:true});
 await wizard.getByRole('button',{name:'Save project team',exact:true}).click();
 await page.getByRole('alertdialog',{name:'Save project team?'}).getByRole('button',{name:'Save project team',exact:true}).click();
 await expect(wizard.getByText(/Step 7 of 7/)).toBeVisible();
 await expect(wizard.getByLabel('Use a template')).toHaveValue('seminar');
 await wizard.getByRole('checkbox',{name:'Include Print registration sheets'}).uncheck();
 await wizard.getByRole('checkbox',{name:'Include Draft speaker notes'}).uncheck();
 await expect(wizard.getByText('3 selected tasks · 2 subtasks')).toBeVisible();
 await wizard.getByRole('button',{name:'Add tasks and open project'}).click();
 await expect(wizard).toHaveCount(0);await expect(page).toHaveURL(new RegExp(`project=${id}.*view=tasks`));expect(creates).toBe(1);expect(p.funding_not_required).toBe(true);
 expect(teamWrites).toEqual([[records.id,teammateId]]);
 expect(taskWrites).toEqual(['Draft the agenda','Reserve the room','Invite attendees']);
 await expect(page.getByText('Draft the agenda',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Subtasks for Draft the agenda'}).click();
 await expect(page.getByRole('region',{name:'Subtasks for Draft the agenda'}).getByText('Confirm topics',{exact:true})).toBeVisible();
});
