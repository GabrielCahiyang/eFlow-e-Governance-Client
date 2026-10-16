import {test,expect,type Page,type Route} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {nestedWorkImpactFixture} from '../fixtures/nestedWorkImpact';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
const title='Prepare community assessment',bob='00000000-0000-4000-8000-000000000002',charlie='00000000-0000-4000-8000-000000000003',officeId='50000000-0000-4000-8000-000000000001';
type SurfaceActor='Head'|'Task Lead'|'Subitem Lead'|'Contributor';
function surfaceSnapshot(data:any,actorCase:SurfaceActor|undefined,actor:string){
 if(!actorCase)return data;
 const rootManager=actorCase==='Head'||actorCase==='Task Lead',allow=(allowed:boolean)=>({allowed,reason_code:allowed?null:'branch_denied'});
 data.root.lead=actorCase==='Task Lead'?actor:bob;
 data.root.capabilities={manage_contributors:allow(rootManager),appoint_lead:allow(actorCase==='Head'),create_child:allow(rootManager),order_children:allow(rootManager)};
 data.nodes=data.nodes.map((node:any,index:number)=>{
  const manager=rootManager||actorCase==='Subitem Lead',appointment=rootManager||actorCase==='Subitem Lead'&&index>0,execute=actorCase==='Contributor'||actorCase==='Subitem Lead'&&index===0;
  return {...node,lead_id:actorCase==='Subitem Lead'&&index===0?actor:bob,assigned_to_ids:actorCase==='Contributor'?[actor]:[],can_manage:manager,can_appoint:appointment,can_work:execute,capabilities:{manage_contributors:allow(manager),appoint_lead:allow(appointment),create_child:allow(manager&&node.depth<8),order_children:allow(manager),edit_details:allow(manager),move:allow(manager),delete:allow(manager),execute:allow(execute),submit:allow(execute&&index===data.nodes.length-1),review:allow(false)}};
 });return data;
}
async function hierarchyFixture(page:Page,role:'head'|'member'|'admin'='head',depth=2,unassignedRoot=false,actorCase?:SurfaceActor){
 const records=await projectWorkspaceFixture(page,role,true,{compactLayout:true});
 if(unassignedRoot)Object.assign(records.tasks[0],{status:'pending_assignment',assigned_to:null,team_member_ids:[]});
 if(actorCase&&actorCase!=='Task Lead')Object.assign(records.tasks[0],{assigned_to:bob,team_member_ids:[bob,records.id]});
 records.profiles.push({...records.profile,id:bob,full_name:'Bob selected for project',email:'bob@example.test',role:'member'},{...records.profile,id:charlie,full_name:'Charlie unselected',email:'charlie@example.test',role:'member'});
 records.projectOffices.push({id:officeId,project_id:records.project,office_id:records.org,relationship_type:'lead',invitation_status:'joined'});
 records.officeMembers.push({project_office_id:officeId,user_id:records.id},{project_office_id:officeId,user_id:bob});
 const member=(id:string)=>({user_id:id,project_office_id:officeId,office:records.org,office_name:'Planning Office',name:String(records.profiles.find(p=>p.id===id)?.full_name),engagement:'Permanent',access_end:null,until_close:false,access_ended_at:null,eligible:true,can_read:true,access:'member',state:'joined',responsibilities:id===records.id?[{root:records.tasks[0].id,title,role:'Task Lead'}]:[]});
 const members=[member(records.id),member(bob)],commands:any[]=[],previews:any[]=[],receipts=new Map<string,unknown>(),treeReads=new Map<string,number>();let revision=7,lostReceipt=true,lostCheckedReceipt=false,impactBlocked=false,materialDate=false,historyVersion=0,closed=false,revoked=false,readFailure:'offline'|'denied'|null=null,readGate:Promise<void>|undefined,releaseReadGate=()=>{};
 const root=String(records.tasks[0].id);const nodes:any[]=Array.from({length:depth},(_,i)=>({id:'60000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),task_id:root,parent_subtask_id:i?'60000000-0000-4000-8000-'+String(i).padStart(12,'0'):null,lead_id:records.id,title:`Depth ${i+1} work`,assigned_to_ids:[records.id],sibling_order:0,depth:i+1,due_date:'2026-10-09',is_standalone:true,status:'todo',percent_complete:0,can_manage:role!=='admin',can_appoint:role==='head',can_order:role==='head',can_work:role!=='admin',can_review:false}));
 if(actorCase){const surface=surfaceSnapshot({root:{},nodes:nodes.map(node=>({...node}))},actorCase,records.id);for(const node of surface.nodes)records.subtasks.push({...records.subtasks[0],id:node.id,task_id:root,title:node.title,parent_subtask_id:node.parent_subtask_id,lead_id:node.lead_id,assigned_to:null,assigned_to_ids:node.assigned_to_ids,status:'todo',percent_complete:0,is_standalone:true,due_date:node.due_date,latest_submission_id:null});}
 if(actorCase)await page.route('**/rest/v1/subtasks?*',async route=>{const query=new URL(route.request().url()).searchParams,id=query.get('id')?.replace(/^eq\./,''),task=query.get('task_id');const rows=records.subtasks.filter(row=>(!id||row.id===id)&&(!task?.startsWith('eq.')||row.task_id===task.slice(3)));return route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows});});
 const capability=(allowed:boolean,reason='branch_denied')=>({allowed,reason_code:allowed?null:closed?'lifecycle_blocked':revoked?'branch_denied':reason});
 const snapshot=(id:string)=>surfaceSnapshot({root:{id,project:records.project,office:records.org,lead:id===root?records.tasks[0].assigned_to??(unassignedRoot?null:records.id):records.id,kind:'office',open:!closed,people:records.tasks[0].team_member_ids||[records.id],due:'2026-10-09',capabilities:{
  manage_contributors:capability(role!=='admin'&&!closed&&!revoked&&!(unassignedRoot&&id===root),'lifecycle_blocked'),
  appoint_lead:capability(role==='head'&&!closed&&!revoked,'appointment_denied'),
  create_child:capability(role!=='admin'&&!closed&&!revoked),order_children:capability(role!=='admin'&&!closed&&!revoked)}},revision,can_manage:role!=='admin'&&!closed&&!revoked,can_transfer:role==='head'&&!closed&&!revoked,nodes:id===root?nodes.map(n=>({...n,can_manage:n.can_manage&&!closed&&!revoked,can_work:n.can_work&&!closed&&!revoked,capabilities:{
   manage_contributors:capability(role!=='admin'&&!closed&&!revoked),appoint_lead:capability(role!=='admin'&&!closed&&!revoked,'appointment_denied'),
   create_child:capability(role!=='admin'&&!closed&&!revoked&&n.depth<8,'lifecycle_blocked'),order_children:capability(role!=='admin'&&!closed&&!revoked),
   edit_details:capability(role!=='admin'&&!closed&&!revoked),move:capability(role!=='admin'&&!closed&&!revoked),delete:capability(role!=='admin'&&!closed&&!revoked),
   execute:capability(role!=='admin'&&!closed&&!revoked),submit:capability(role!=='admin'&&!closed&&!revoked),review:capability(false),...(n.capabilities||{})}})):[],people:members.map(m=>({id:m.user_id,name:m.name,eligible:m.eligible})),leaf_total:id===root?1:0,leaf_completed:0},actorCase,records.id);
 await page.route('**/rest/v1/profiles?*',async route=>{
  const filter=new URL(route.request().url()).searchParams.get('id');if(!filter?.startsWith('eq.'))return route.fallback();
  const row=records.profiles.find(p=>p.id===filter.slice(3));return route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?row:[...(row?[row]:[])]});
 });
 await page.route(/\/rest\/v1\/rpc\/(r7_|nw_work_)/,async route=>{
  const op=new URL(route.request().url()).pathname.split('/').at(-1),payload=route.request().postDataJSON()||{};
  if(op==='r7_work_tree'){treeReads.set(payload.p_root,(treeReads.get(payload.p_root)||0)+1);if(readGate)await readGate;
   if(readFailure)return route.fulfill({status:readFailure==='denied'?403:503,json:{code:readFailure==='denied'?'42501':'PGRST000',message:readFailure==='denied'?'Nested work access denied':'Work temporarily offline'}});
   return route.fulfill({json:snapshot(payload.p_root)});}
  if(op==='r7_work_activity')return route.fulfill({json:{events:[],more:false}});
  if(op==='r7_office_work_roots'||op==='r7_pending_subtask_reviews'||op==='r7_personal_work_roots')return route.fulfill({json:[]});
  if(op==='r7_project_members')return route.fulfill({json:{kind:'office',members,offices:[{...records.projectOffices[0],name:'Planning Office',can_select:role==='head',eligible_count:records.profiles.length}]}});
  if(op==='r7_member_terms'){Object.assign(members.find(m=>m.user_id===payload.p_user)!,{engagement:payload.p_engagement,access_end:payload.p_end,until_close:payload.p_until_close});return route.fulfill({json:members.find(m=>m.user_id===payload.p_user)});}
  if(op==='r7_select_office_members'){
   const selected=payload.p_users as string[];records.officeMembers.splice(0,records.officeMembers.length,...selected.map(user_id=>({project_office_id:officeId,user_id})));members.splice(0,members.length,...selected.map(member));return route.fulfill({json:records.officeMembers});
  }
  if(op==='nw_work_impact'){
   previews.push(payload);return route.fulfill({json:nestedWorkImpactFixture(snapshot(payload.p_root) as WorkTreeSnapshot,{revision:payload.p_revision,command:payload.p_command,payload:payload.p_payload},
    {fingerprint:`fixture-impact-${revision}-${historyVersion}`,allowed:!impactBlocked,blocker_codes:impactBlocked?['history_blocked']:[],...(payload.p_command==='edit'&&Object.hasOwn(payload.p_payload,'due')?{requires_date_confirmation:materialDate}: {})})});
  }
  if(op==='r7_work_command'||op==='nw_work_command'){
   commands.push(payload);if(closed||revoked)return route.fulfill({status:403,json:{code:'42501',message:'Current branch authority denied'}});
   if(receipts.has(payload.p_request))return route.fulfill({json:snapshot(payload.p_root)});
   if(payload.p_revision!==revision)return route.fulfill({status:409,json:{code:'40001',message:'Work tree changed'}});
   if(op==='nw_work_command'&&(impactBlocked||payload.p_impact_fingerprint!==`fixture-impact-${revision}-${historyVersion}`))return route.fulfill({status:409,json:{code:'23514',message:'Affected work changed after preview. Review current work again.'}});
   const value=payload.p_payload;
   if(payload.p_command==='create')nodes.push({...nodes[0],id:value.id,title:value.title,parent_subtask_id:value.parent,lead_id:value.lead,assigned_to_ids:value.people,due_date:value.due,depth:value.parent?(nodes.find(n=>n.id===value.parent)?.depth||0)+1:1,sibling_order:0});
   if(payload.p_command==='contributors')Object.assign(records.tasks[0],{team_member_ids:value.people});
   if(payload.p_command==='edit')Object.assign(nodes.find(node=>node.id===value.id)!,{title:value.title,due_date:value.due,is_standalone:value.standalone});
   if(payload.p_command==='root_lead')Object.assign(records.tasks[0],{assigned_to:value.lead,team_member_ids:value.people});
   if(payload.p_command==='staff')Object.assign(nodes.find(node=>node.id===value.id)!,{lead_id:value.lead,assigned_to_ids:value.people});
   if(op==='nw_work_command'&&['root_lead','staff'].includes(payload.p_command))for(const node of nodes.filter(node=>node.id!==value.id))node.lead_id=null;
   if(payload.p_command==='delete'){const selected=new Set([value.id]);for(let i=0;i<8;i++)for(const node of nodes)if(selected.has(node.parent_subtask_id))selected.add(node.id);nodes.splice(0,nodes.length,...nodes.filter(node=>!selected.has(node.id)));}
   if(payload.p_command==='order')for(const node of nodes)if(value.order.includes(node.id))node.sibling_order=value.order.indexOf(node.id);
   revision++;receipts.set(payload.p_request,true);if(lostReceipt&&payload.p_command==='create'||lostCheckedReceipt&&op==='nw_work_command'){lostReceipt=false;lostCheckedReceipt=false;return route.fulfill({status:500,json:{code:'XX000',message:'Committed work receipt interrupted'}});}return route.fulfill({json:snapshot(payload.p_root)});
  }
  return route.fulfill({status:404,json:{code:'PGRST202',message:'No synthetic operation'}});
 });
 if(role==='admin'){
  // Admin's navigation boundary excludes project work, even via a direct URL.
  await page.goto(`/projects?workspace=${records.org}&project=${records.project}`);
  await expect(page.getByRole('heading',{name:'All Users',exact:true,level:1})).toBeVisible();
 }else{await page.reload();if(actorCase==='Subitem Lead'||actorCase==='Contributor')await expect(page.getByRole('button',{name:'Subitems for '+title,exact:true})).toBeVisible({timeout:30000});else await expect(page.getByRole('button',{name:'Choose task lead and contributors'}).first()).toBeVisible({timeout:30000});}
 return {records,nodes,members,commands,previews,treeReads,changeHistory(){historyVersion++;},set materialDate(value:boolean){materialDate=value;},set impactBlocked(value:boolean){impactBlocked=value;},set lostCheckedReceipt(value:boolean){lostCheckedReceipt=value;},blockReads(){readGate=new Promise<void>(resolve=>{releaseReadGate=resolve;});},releaseReads(){readGate=undefined;releaseReadGate();},set readFailure(value:'offline'|'denied'|null){readFailure=value;},set closed(value:boolean){closed=value;records.projects[0].status=value?'archived':'planning';},set revoked(value:boolean){revoked=value;}};
}
async function workAction(page:Page,trigger:string,action:string){await page.getByRole('button',{name:trigger,exact:true}).click();await page.getByRole('menuitem',{name:action,exact:true}).click();}
test('approved inline add preserves keyboard focus through a delayed authority refresh',async({page})=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const work=page.getByRole('region',{name:'Nested project work'}),add=work.getByRole('button',{name:'Add subitem',exact:true});await add.click();await expect(work.getByRole('form',{name:'Nested work changes'})).toBeVisible();fixture.blockReads();await work.getByRole('button',{name:'Cancel changes',exact:true}).click();await expect(work.getByRole('form',{name:'Nested work changes'})).toHaveCount(0);
 // A quiet read retains the verified same-actor snapshot. It must not invent a
 // new permission denial or steal focus while the refresh remains unfinished.
 await expect(add).toBeEnabled();await expect(add).toBeFocused();fixture.releaseReads();await expect(add).toBeFocused();expect(fixture.commands).toHaveLength(0);
});
for(const actorCase of ['Head','Task Lead','Subitem Lead','Contributor'] as const)test(`approved Main Table subitems retain ${actorCase} action boundaries`,async({page},info)=>{
 const fixture=await hierarchyFixture(page,actorCase==='Head'?'head':'member',2,false,actorCase);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const work=page.getByRole('region',{name:'Nested project work'});
 await expect(work.getByRole('table')).toHaveAttribute('data-density','compact');await expect(work.getByRole('heading',{name:'Subitems',exact:true})).toHaveCount(0);await expect(work.getByText('Subitems with no children:',{exact:false})).toHaveCount(0);
 const rootAdd=work.getByRole('button',{name:'Add subitem',exact:true});if(actorCase==='Head'||actorCase==='Task Lead'){await expect(rootAdd).toBeEnabled();await rootAdd.click();await expect(work.getByRole('form',{name:'Nested work changes',exact:true})).toBeVisible();await work.getByRole('button',{name:'Cancel changes',exact:true}).click();}else await expect(rootAdd).toHaveCount(0);
 await work.getByRole('button',{name:'Actions for Depth 1 work',exact:true}).click();const menu=page.getByRole('menu');if(actorCase==='Contributor'){await expect(menu.getByRole('menuitem',{name:'Choose people',exact:true})).toHaveCount(0);await expect(menu.getByRole('menuitem',{name:'Add subitem',exact:true})).toHaveCount(0);await expect(menu.getByRole('menuitem',{name:'Edit details',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');}else{await expect(menu.getByRole('menuitem',{name:'Add subitem',exact:true})).toBeVisible();await menu.getByRole('menuitem',{name:'Choose people',exact:true}).click();const people=page.getByRole('dialog',{name:'Subitem Lead and contributors'});if(actorCase==='Subitem Lead')await expect(people.getByRole('combobox',{name:'Appointed Lead'})).toBeDisabled();else await expect(people.getByRole('combobox',{name:'Appointed Lead'})).toBeEnabled();await people.getByRole('button',{name:'Close',exact:true}).click();}
 await page.screenshot({path:info.outputPath(`subitems-${actorCase.replaceAll(' ','-')}.png`),fullPage:true});await work.getByRole('button',{name:'Depth 1 work',exact:true}).click();const inspector=page.getByRole('dialog',{name:'Subtask details: Depth 1 work'});await expect(inspector).toBeVisible();if(actorCase==='Contributor'||actorCase==='Subitem Lead')await expect(inspector.getByRole('button',{name:'Save update',exact:true})).toBeEnabled();else await expect(inspector.getByRole('button',{name:'Save update',exact:true})).toBeDisabled();expect(fixture.commands).toHaveLength(0);
});
test('NW9.7 board editor shares canonical staffing and deep work while retaining metadata',async({page})=>{
 const fixture=await hierarchyFixture(page,'head',8);
 await page.getByRole('navigation',{name:'Workspace destinations'}).getByRole('button',{name:'Office tasks',exact:true}).click();
 await workAction(page,'Open actions for '+title,'Edit task details');
 const editor=page.getByRole('dialog',{name:title,exact:true});await expect(editor).toBeVisible();
 await expect(editor.getByRole('button',{name:'Edit Team',exact:true})).toHaveCount(0);
 await editor.getByRole('textbox',{name:'Task description',exact:true}).fill('Unsaved metadata remains open');
 await expect(editor.getByRole('button',{name:'Depth 8 work',exact:true})).toBeVisible();
 await editor.getByRole('button',{name:'Choose task lead and contributors',exact:true}).click();
 const people=page.getByRole('dialog',{name:'Task lead and contributors',exact:true});await expect(people).toBeVisible();
 await people.getByRole('button',{name:'Close',exact:true}).click();
 await expect(editor.getByRole('textbox',{name:'Task description',exact:true})).toHaveValue('Unsaved metadata remains open');
 await editor.getByRole('button',{name:'Choose task lead and contributors',exact:true}).click();
 await people.getByRole('button',{name:'Add contributor Bob selected for project',exact:true}).click();
 await people.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('alertdialog')).toContainText('Task/subitem people changes');
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(people).toBeVisible();
 await people.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();
 await expect(people).toHaveCount(0);await expect(editor.getByRole('textbox',{name:'Task description',exact:true})).toHaveValue('Unsaved metadata remains open');
 await editor.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('alertdialog')).toContainText('Task details');await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(editor.getByRole('textbox',{name:'Task description',exact:true})).toHaveValue('Unsaved metadata remains open');
 expect(fixture.commands).toHaveLength(0);
});
test('NW9.7 checked missing installation keeps legacy detail and archived project locks',async({page})=>{
 const fixture=await hierarchyFixture(page);Object.assign(fixture.records.subtasks[0],{assigned_to:fixture.records.id,assigned_to_ids:[fixture.records.id],is_standalone:true});
 await page.route('**/rest/v1/rpc/r7_work_tree',route=>route.fulfill({status:404,json:{code:'PGRST202',message:'Checked missing r7_work_tree'}}));
 await page.reload();await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();await page.getByRole('button',{name:'Open subitem Gather supporting evidence',exact:true}).click();
 let detail=page.getByRole('dialog',{name:'Subtask details: Gather supporting evidence'});await expect(detail).toBeVisible();await expect(detail.getByRole('navigation',{name:'Subitem sections'})).toHaveCount(0);await expect(detail.getByRole('navigation',{name:'Subitem path'})).toHaveCount(0);await expect(detail.getByRole('button',{name:'Save update'})).toBeVisible();
 await detail.getByRole('button',{name:'Close subtask detail',exact:true}).click();fixture.records.projects[0].status='archived';await page.reload();await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();await page.getByRole('button',{name:'Open subitem Gather supporting evidence',exact:true}).click();
 detail=page.getByRole('dialog',{name:'Subtask details: Gather supporting evidence'});await expect(detail).toBeVisible();await expect(detail.getByText('Team Leader view.',{exact:true})).toBeVisible();await expect(detail.getByRole('button',{name:'Save update'})).toHaveCount(0);await expect(detail.locator('input[type="date"]')).toHaveCount(0);expect(fixture.commands).toHaveLength(0);
});
test('NW9.7 denied and ordinary nested reads never open legacy editing',async({page})=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const work=page.getByRole('region',{name:'Nested project work'});await expect(work.getByRole('button',{name:'Depth 1 work',exact:true})).toBeVisible();
 fixture.readFailure='denied';await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(work.getByRole('alert')).toContainText('Nested work access denied');await expect(work.getByRole('button',{name:'Depth 1 work',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Open subitem Gather supporting evidence'})).toHaveCount(0);await expect(page.getByPlaceholder('Add a subtask for team members…')).toHaveCount(0);
 fixture.readFailure='offline';await work.getByRole('button',{name:'Retry work'}).click();await expect(work.getByRole('alert')).toContainText('Work temporarily offline');await expect(page.getByRole('button',{name:'Open subitem Gather supporting evidence'})).toHaveCount(0);expect(fixture.commands).toHaveLength(0);
});
async function inspectorWork(page:Page){
 await page.getByRole('button',{name:'Open '+title,exact:true}).click();
 const inspector=page.getByRole('dialog',{name:'Task details: '+title});
 await inspector.getByRole('tab',{name:'Work',exact:true}).click();return inspector;
}
async function notificationRows(page:Page,fixture:Awaited<ReturnType<typeof hierarchyFixture>>,pause?:{value:boolean;held:Route[]}){
 const addressed:string[]=[];
 await page.route('**/rest/v1/tasks?*',route=>{
  const filter=new URL(route.request().url()).searchParams.get('id');
  if(!filter?.startsWith('eq.')||!route.request().headers().accept?.includes('vnd.pgrst.object'))return route.fallback();
  return route.fulfill({json:fixture.records.tasks.find(task=>task.id===filter.slice(3))||null});
 });
 await page.route('**/rest/v1/subtasks?*',route=>{
  const params=new URL(route.request().url()).searchParams,filter=params.get('id');
  if(pause?.value&&!filter){pause.held.push(route);return;}
  const selected=filter?.startsWith('in.(')?filter.slice(4,-1).split(','):filter?.startsWith('eq.')?[filter.slice(3)]:undefined;
  if(filter?.startsWith('eq.'))addressed.push(filter.slice(3));
  const rows=fixture.nodes.filter(node=>!selected||selected.includes(node.id)).map((node,index)=>({...node,position:index,created_at:'2026-10-12T00:00:00Z',updated_at:'2026-10-12T00:00:00Z'}));
  return route.fulfill({json:rows,headers:{'access-control-expose-headers':'content-range','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`}});
 });
 return addressed;
}
async function notificationAlert(page:Page,fixture:Awaited<ReturnType<typeof hierarchyFixture>>,patch:Record<string,unknown>={}){
 const alert={id:'notification-nw95',type:'assignment',title:'Subtask appointment changed',message:'Assigned to "Old label".',task_id:fixture.nodes[7].task_id,task_title:title,work_node_id:fixture.nodes[7].id,read:false,created_at:'2026-10-12T00:00:00Z',...patch};
 const writes:unknown[]=[];
 await page.route('**/rest/v1/notifications?*',route=>{if(route.request().method()==='PATCH'){writes.push(route.request().postDataJSON());alert.read=true;return route.fulfill({json:[{id:alert.id}]});}return route.fulfill({json:[alert]});});
 return {alert,writes};
}
async function openNotificationAlert(page:Page){await page.getByTitle('1 unread notifications').first().click();await page.getByText('Subtask appointment changed',{exact:true}).click();}

test('NW9.5 pending canonical notification survives reload and opens only its authorized depth-eight ID',async({page})=>{
 const fixture=await hierarchyFixture(page,'member',8),leaf=fixture.nodes[7];for(const node of fixture.nodes)node.title='Same';leaf.assigned_to_ids=[];
 const pause={value:false,held:[] as Route[]};const addressed=await notificationRows(page,fixture,pause),notice=await notificationAlert(page,fixture);
 await page.reload();await expect(page.getByTitle('1 unread notifications').first()).toBeVisible();pause.value=true;await openNotificationAlert(page);
 const key=`eflow.notification-intent.v1:${fixture.records.id}`;
 await expect.poll(()=>page.evaluate(key=>sessionStorage.getItem(key),key)).toContain(leaf.id);
 pause.held.length=0;await page.reload({waitUntil:'domcontentloaded'});await expect.poll(()=>pause.held.length).toBeGreaterThan(0);pause.value=false;
 for(const route of pause.held.splice(0)){if(route.request().failure())continue;await route.fulfill({json:fixture.nodes.map((node,index)=>({...node,position:index}))});}
 const inspector=page.getByRole('dialog',{name:'Subtask details: Same'});await expect(inspector).toBeVisible();await expect(inspector.getByRole('heading',{name:'Same',exact:true})).toBeVisible();
 expect(addressed).toContain(leaf.id);expect(addressed.some(id=>id!==leaf.id)).toBe(false);await expect.poll(()=>page.evaluate(key=>sessionStorage.getItem(key),key)).toBeNull();
 expect(notice.writes).toEqual([{read:true}]);expect(fixture.commands).toHaveLength(0);
});

test('NW9.5 Inbox progress update keeps its canonical item and Leading Work section despite stale duplicate-title copy',async({page})=>{
 const fixture=await hierarchyFixture(page,'member',8),leaf=fixture.nodes[7];for(const node of fixture.nodes)node.title='Same';const addressed=await notificationRows(page,fixture);await notificationAlert(page,fixture,{type:'status_change',title:'Subtask progress updated'});
 await page.goto(`/inbox?workspace=${fixture.records.org}`);await page.getByRole('button',{name:'Updates',exact:true}).click();await page.getByRole('region',{name:'Recent updates'}).getByRole('button',{name:'Open update',exact:true}).click();
 const inspector=page.getByRole('dialog',{name:'Subtask details: Same'});await expect(inspector).toBeVisible();await expect(inspector.getByRole('button',{name:'Work',exact:true})).toBeVisible();expect(addressed).toContain(leaf.id);await expect(page.getByRole('dialog',{name:'Task details: '+title})).toHaveCount(0);expect(fixture.commands).toHaveLength(0);
});

test('NW9.5 canonical notification beyond discovery uses an exact authorized read without widening the checklist',async({page})=>{
 const fixture=await hierarchyFixture(page,'member',8),leaf=fixture.nodes[7];for(const node of fixture.nodes)node.title='Same';leaf.assigned_to_ids=[];const addressed=await notificationRows(page,fixture);await notificationAlert(page,fixture);
 await page.route('**/rest/v1/subtasks?*',route=>{if(new URL(route.request().url()).searchParams.has('id'))return route.fallback();return route.fulfill({json:fixture.nodes.slice(0,7)});});
 await page.reload();await openNotificationAlert(page);const inspector=page.getByRole('dialog',{name:'Subtask details: Same'});await expect(inspector).toBeVisible();await expect(inspector.getByRole('button',{name:'Save update',exact:true})).toBeEnabled();
 expect(addressed).toContain(leaf.id);expect(fixture.commands).toHaveLength(0);
});

for(const missing of [false,true])test(`NW9.5 ${missing?'missing canonical ID':'ambiguous legacy label'} cannot open an arbitrary same-title item`,async({page})=>{
 const fixture=await hierarchyFixture(page,'member',8);for(const node of fixture.nodes)node.title='Same';const addressed=await notificationRows(page,fixture);await notificationAlert(page,fixture,{work_node_id:missing?'60000000-0000-4000-8000-000000009999':null,message:'Assigned to "Same".'});
 await page.reload();await openNotificationAlert(page);await expect(page.getByRole('alert')).toContainText('unavailable or ambiguous');await expect(page.getByRole('dialog',{name:'Subtask details: Same'})).toHaveCount(0);expect(addressed).toEqual(missing?['60000000-0000-4000-8000-000000009999']:[]);expect(fixture.commands).toHaveLength(0);
});

test('NW9.5 canonical review notification opens the current Review Inspector and retains isolated feedback after access ends',async({page})=>{
 const fixture=await hierarchyFixture(page,'member',8),leaf=fixture.nodes[7];for(const node of fixture.nodes)node.title='Same';Object.assign(leaf,{status:'for_review',percent_complete:100,current_reviewer:fixture.records.id,capabilities:{execute:{allowed:false,reason_code:'review_pending'},submit:{allowed:false,reason_code:'review_pending'},review:{allowed:true,reason_code:null}}});
 await notificationRows(page,fixture);await notificationAlert(page,fixture,{type:'approval_needed',status_to:'for_review'});
 const attempt={id:'80000000-0000-4000-8000-000000000095',task_id:leaf.task_id,subtask_id:leaf.id,version:2,status:'pending',submitter_id:bob,submitter_name:'Historical submitter',reviewer_id:'recorded-original-reviewer',note:'Sealed canonical evidence',submitted_at:'2026-10-12T00:00:00Z'};let eligible=true;
 await page.route('**/rest/v1/rpc/r7_pending_subtask_reviews',route=>route.fulfill({json:eligible?[attempt]:[]}));await page.route('**/rest/v1/subtask_submissions?*',route=>route.fulfill({json:[attempt]}));
 await page.route('**/rest/v1/subtask_submission_attachments?*',route=>route.fulfill({json:[{id:'proof95',submission_id:attempt.id,file_name:'proof95.pdf',file_path:`subtasks/${leaf.id}/sealed/proof.pdf`}]}));
 await page.route('**/storage/v1/object/sign/task-attachments/**',route=>route.fulfill({json:{signedURL:'/object/sign/task-attachments/proof95.pdf?token=synthetic'}}));
 await page.reload();await openNotificationAlert(page);const review=page.getByRole('dialog',{name:'Subitem evidence review'});await expect(review).toBeVisible();await expect(review).toContainText('Historical submitter');await expect(review).toContainText('Sealed canonical evidence');await expect(review).toContainText('Current reviewer: Alex Rivera');
 const field=review.getByPlaceholder('Explain what needs correction…');await field.fill('Keep this actor review feedback');eligible=false;fixture.readFailure='denied';await page.evaluate(()=>window.dispatchEvent(new Event('eflow-project-access-changed')));
 await expect(field).toHaveValue('Keep this actor review feedback');await expect(review.getByRole('button',{name:'Approve evidence'})).toBeDisabled();await expect(review.getByRole('link',{name:'proof95.pdf'})).toHaveCount(0);expect(attempt.reviewer_id).toBe('recorded-original-reviewer');expect(fixture.commands).toHaveLength(0);
});

test('NW7.2 shared Task Lead edits contributors with one Inspector tree owner and guarded appointment',async({page})=>{
 const fixture=await hierarchyFixture(page,'member');const root=String(fixture.records.tasks[0].id),reads=fixture.treeReads.get(root)!;
 const inspector=await inspectorWork(page);
 await expect(inspector.getByRole('region',{name:'Nested project work'})).toContainText('Depth 1 work');
 expect(fixture.treeReads.get(root)).toBe(reads+1);
 await expect(inspector).not.toContainText('only the responsible Office Head');
 await inspector.getByRole('button',{name:'Choose task lead and contributors'}).click();
 const people=page.getByRole('dialog',{name:'Task lead and contributors'});
 await expect(people.getByLabel('Appointed Lead')).toBeDisabled();
 await people.getByRole('button',{name:'Add contributor Bob selected for project'}).click();
 await people.getByRole('button',{name:'Save work changes'}).click();await expect(people).toHaveCount(0);
 expect(fixture.commands).toHaveLength(1);expect(fixture.commands[0]).toMatchObject({p_command:'contributors',p_payload:{people:[fixture.records.id,bob]}});
 await expect(inspector.getByRole('region',{name:'Task lead and contributors'})).toContainText('Bob selected for project');
 await inspector.getByRole('tab',{name:'Overview',exact:true}).click();await inspector.getByRole('tab',{name:'Work',exact:true}).click();
 expect(fixture.treeReads.get(root)).toBe(reads+1);
 await inspector.getByRole('button',{name:'Task work actions'}).click();await page.getByRole('menuitem',{name:'Add subitem',exact:true}).click();
 await expect(inspector.getByLabel('Subitem title')).toBeFocused();await inspector.getByLabel('Subitem title').fill('Retained Inspector draft');
 await inspector.getByRole('tab',{name:'Files',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(inspector.getByLabel('Subitem title')).toHaveValue('Retained Inspector draft');expect(fixture.commands).toHaveLength(1);
});
test('NW7.2 responsible Head can staff and structure another Task Lead root in Work',async({page})=>{
 const fixture=await hierarchyFixture(page,'head');fixture.records.tasks[0].assigned_to=bob;await page.reload();
 const inspector=await inspectorWork(page);await inspector.getByRole('button',{name:'Choose task lead and contributors'}).click();
 const people=page.getByRole('dialog',{name:'Task lead and contributors'});await expect(people.getByLabel('Appointed Lead')).toBeEnabled();
 await people.getByRole('button',{name:'Cancel changes',exact:true}).click();
 await inspector.getByRole('button',{name:'Task work actions'}).click();await page.getByRole('menuitem',{name:'Add subitem',exact:true}).click();
 await expect(inspector.getByLabel('Subitem title')).toBeVisible();expect(fixture.commands).toHaveLength(0);
});
for(const mode of ['contributor','admin','closed','failed','proposed'] as const)test('NW7.2 Work fails closed for '+mode+' without starting legacy mutation controls',async({page})=>{
 const fixture=await hierarchyFixture(page,mode==='admin'?'admin':'member');
 if(mode==='contributor'){fixture.records.tasks[0].assigned_to=bob;fixture.revoked=true;}
 if(mode==='closed')fixture.closed=true;
 if(mode==='failed')fixture.readFailure='offline';
 if(mode==='proposed')fixture.records.tasks[0].proposed_office_identity_id='90000000-0000-4000-8000-000000000001';
 await page.reload();
 if(mode==='admin'){
  await expect(page.getByRole('heading',{name:'All Users',exact:true,level:1})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open '+title,exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Task details: '+title})).toHaveCount(0);
  expect(fixture.commands).toHaveLength(0);return;
 }
 const inspector=await inspectorWork(page);
 if(mode==='failed'){await expect(inspector.getByRole('button',{name:'Retry work'})).toBeVisible();await expect(inspector).toContainText('Work temporarily offline');}
 else if(mode==='proposed')await expect(inspector).toContainText('Proposed Office responsibility');
 else await expect(inspector.getByRole('region',{name:'Nested project work'})).toContainText('Depth 1 work');
 await expect(inspector.getByRole('button',{name:'Choose task lead and contributors'})).toHaveCount(0);
 await expect(inspector.getByRole('button',{name:'Task work actions'})).toHaveCount(0);
 await expect(inspector.getByRole('button',{name:'Manage',exact:true})).toHaveCount(0);
 await expect(inspector.getByRole('textbox',{name:'Add subitem'})).toHaveCount(0);expect(fixture.commands).toHaveLength(0);
});
test.beforeEach(async({page})=>{test.setTimeout(90000);await page.setViewportSize({width:1440,height:1000});});
for(const width of [320,1440])test(`R7 Owner refresh stays quiet and padded reassignment fits a minimum-width column at ${width}px`,async({page},info)=>{
 const fixture=await hierarchyFixture(page,'head',2,true);await page.setViewportSize({width,height:950});
 const table=page.getByRole('region',{name:'Project main table'}),row=table.locator('.pt-task-row').filter({has:page.getByRole('button',{name:'Open '+title,exact:true})}),owner=row.locator('.pt-cell--owner');
 await expect(owner.getByText('Lead: Needs reassignment',{exact:true})).toBeVisible();
 const resizer=table.getByRole('separator',{name:'Resize Owner column'}).first();await resizer.press('Home');await expect(resizer).toHaveAttribute('aria-valuenow','150');
 const bounds=await owner.boundingBox();expect(bounds).not.toBeNull();
 for(const element of [owner.getByText('Lead: Needs reassignment',{exact:true}),owner.getByRole('button',{name:'Choose task lead and contributors'})]){
  const rectangle=await element.boundingBox();expect(rectangle).not.toBeNull();expect(rectangle!.x-bounds!.x).toBeGreaterThanOrEqual(10);expect(bounds!.x+bounds!.width-rectangle!.x-rectangle!.width).toBeGreaterThanOrEqual(10);expect(rectangle!.y-bounds!.y).toBeGreaterThanOrEqual(8);expect(bounds!.y+bounds!.height-rectangle!.y-rectangle!.height).toBeGreaterThanOrEqual(8);
 }
 const status=row.locator('.pt-cell--status'),select=status.getByRole('combobox',{name:'Status for '+title,exact:true});await expect(select).toHaveValue('pending_assignment');
 const statusBounds=await status.boundingBox(),selectBounds=await select.boundingBox();expect(statusBounds).not.toBeNull();expect(selectBounds).not.toBeNull();
 expect(selectBounds!.x-statusBounds!.x).toBeGreaterThanOrEqual(10);expect(statusBounds!.x+statusBounds!.width-selectBounds!.x-selectBounds!.width).toBeGreaterThanOrEqual(10);expect(selectBounds!.y-statusBounds!.y).toBeGreaterThanOrEqual(8);expect(statusBounds!.y+statusBounds!.height-selectBounds!.y-selectBounds!.height).toBeGreaterThanOrEqual(8);
 await page.screenshot({path:info.outputPath(`r7-owner-status-spacing-${width}.png`),fullPage:true});
 if(width===1440)await page.screenshot({path:info.outputPath('r7-owner-status-detail.png'),clip:{x:bounds!.x,y:bounds!.y-40,width:bounds!.width+statusBounds!.width,height:bounds!.height+40}});
 const root=String(fixture.records.tasks[0].id),before=fixture.treeReads.get(root)||0;fixture.blockReads();
 try{
  await page.evaluate(()=>{for(let i=0;i<3;i++)dispatchEvent(new Event('focus'));});
  await expect.poll(()=>fixture.treeReads.get(root)).toBe(before+1);
  await expect(owner.getByText('Lead: Needs reassignment',{exact:true})).toBeVisible();await expect(owner.getByText('Loading project people…')).toHaveCount(0);await expect(owner.getByRole('button',{name:'Choose task lead and contributors'})).toBeVisible();
 }finally{fixture.releaseReads();}
 await owner.getByRole('button',{name:'Choose task lead and contributors'}).click();await expect(page.getByRole('dialog',{name:'Task lead and contributors'}).getByLabel('Appointed Lead')).toBeVisible();
 await page.screenshot({path:info.outputPath(`r7-owner-${width}.png`),fullPage:true});
});
test('R7 Members is an Add view and uses the same project-only Office selection and engagement terms',async({page},info)=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Add view',exact:true}).click();await page.getByRole('dialog',{name:'Add project view'}).getByRole('button',{name:'Members',exact:true}).click();
 const members=page.getByRole('region',{name:'Project Members'});await expect(members.getByRole('table',{name:'Selected project members'})).toContainText('Bob selected for project');await expect(members.getByRole('table')).not.toContainText('Charlie unselected');
 await members.getByRole('button',{name:'Add existing members · Planning Office'}).click();const selection=page.getByRole('dialog',{name:'Select project members · Planning Office'});await selection.getByRole('checkbox',{name:/Charlie unselected/}).check();await selection.getByRole('button',{name:'Save project team',exact:true}).click();await page.getByRole('alertdialog',{name:'Save project team?'}).getByRole('button',{name:'Save project team',exact:true}).click();
 await expect(selection).toHaveCount(0);await expect(members.getByRole('table')).toContainText('Charlie unselected');expect(fixture.records.officeMembers).toHaveLength(3);
 await members.getByRole('button',{name:'Edit access terms for Bob selected for project'}).click();const terms=page.getByRole('dialog',{name:'Project access terms'});await terms.getByLabel('Engagement').selectOption('OJT');await expect(terms.getByRole('button',{name:'Save access terms'})).toBeDisabled();await terms.getByRole('checkbox',{name:'Until project completion or archive'}).check();await terms.getByRole('button',{name:'Save access terms'}).click();await expect(terms).toContainText('Access terms saved.');await terms.getByRole('button',{name:'Done',exact:true}).click();await expect(members.getByRole('table')).toContainText('OJT');
 await page.screenshot({path:info.outputPath('r7-members-desktop.png'),fullPage:true});
 await page.setViewportSize({width:320,height:950});await page.evaluate(()=>document.documentElement.classList.add('dark'));await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);await page.screenshot({path:info.outputPath('r7-members-320-dark.png'),fullPage:true});
});
test('R7 nested creation preserves one request after lost receipt and guards unsaved navigation',async({page},info)=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await expect(tree).toContainText('Depth 2');
 await workAction(page,'Actions for Depth 2 work','Add subitem');await tree.getByLabel('Subitem title').fill('New depth 3 work');await tree.getByText('Advanced: Lead and contributors (optional)',{exact:true}).click();await tree.getByLabel('Appointed Lead').selectOption(bob);
 await page.getByRole('tab',{name:'Offices',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(tree.getByLabel('Subitem title')).toHaveValue('New depth 3 work');await tree.getByRole('button',{name:'Save work changes'}).dblclick();await expect(tree.getByRole('alert')).toContainText('Committed work receipt interrupted');expect(fixture.commands).toHaveLength(1);
 await tree.getByRole('button',{name:'Retry saved request'}).click();await expect(tree.getByRole('button',{name:'New depth 3 work',exact:true})).toBeVisible();expect(fixture.commands).toHaveLength(2);expect(fixture.commands[0]).toEqual(fixture.commands[1]);expect(fixture.nodes.filter(n=>n.title==='New depth 3 work')).toHaveLength(1);
 await page.screenshot({path:info.outputPath('r7-nested-desktop.png'),fullPage:true});
});
for(const width of [320,390])test(`R7 eight-level work and people picker stay reachable at ${width}px`,async({page},info)=>{
 await hierarchyFixture(page,'head',8);await page.setViewportSize({width,height:950});await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await expect(tree).toContainText('Depth 8');await tree.getByRole('button',{name:'Actions for Depth 8 work',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Add subitem',exact:true})).toHaveCount(0);await page.getByRole('menu').press('Escape');await workAction(page,'Actions for Depth 8 work','Choose people');const editor=page.getByRole('dialog',{name:'Subitem Lead and contributors'});await expect(editor.getByLabel('Find project people')).toBeVisible();await expect(editor.getByRole('button',{name:'Add contributor Charlie unselected'})).toHaveCount(0);await expect(editor.getByRole('button',{name:/Invite.*email/})).toHaveCount(0);await editor.getByRole('button',{name:'Save work changes'}).scrollIntoViewIfNeeded();for(const element of [editor.locator('form'),editor.getByRole('button',{name:'Save work changes'})]){const bounds=await element.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);}expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:info.outputPath(`r7-depth8-${width}.png`),fullPage:true});
});
test('R7 a Member root lead can choose contributors while root transfer stays absent',async({page})=>{
 const fixture=await hierarchyFixture(page,'member');fixture.records.projectOffices.push({...fixture.records.projectOffices[0],id:'50000000-0000-4000-8000-000000000009',office_id:'50000000-0000-4000-8000-000000000008',relationship_type:'collaborator'});await page.reload();await page.getByRole('button',{name:'Actions for '+title,exact:true}).click();const team=page.getByRole('menuitem',{name:'Task team & contributors',exact:true});await expect(team).toBeEnabled();await team.click();const editor=page.getByRole('dialog',{name:'Task lead and contributors'});await expect(editor.getByLabel('Appointed Lead')).toBeDisabled();await editor.getByRole('button',{name:'Add contributor Bob selected for project'}).click();await editor.getByRole('button',{name:'Save work changes'}).click();await expect(editor).toHaveCount(0);expect(fixture.commands[0]).toMatchObject({p_command:'contributors',p_payload:{people:[fixture.records.id,bob]}});
});
test('R7 current authority refresh keeps the draft and blocks a revoked branch',async({page})=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await workAction(page,'Task work actions','Add subitem');await tree.getByLabel('Subitem title').fill('Draft before revocation');fixture.revoked=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(tree.getByRole('alert')).toContainText('Your current branch authority changed');await expect(tree.getByLabel('Subitem title')).toHaveValue('Draft before revocation');await expect(tree.getByRole('button',{name:'Save work changes'})).toBeDisabled();expect(fixture.commands).toHaveLength(0);
});

test('NW3.3 a revoked canonical Team draft retains contributors and blocks saving',async({page})=>{
 const fixture=await hierarchyFixture(page,'member');await page.getByRole('button',{name:'Actions for '+title,exact:true}).click();await page.getByRole('menuitem',{name:'Task team & contributors',exact:true}).click();const editor=page.getByRole('dialog',{name:'Task lead and contributors'});await editor.getByRole('button',{name:'Add contributor Bob selected for project'}).click();fixture.revoked=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(editor.getByRole('button',{name:'Save work changes'})).toBeDisabled();await expect(editor.getByRole('button',{name:'Remove contributor Bob selected for project'})).toBeVisible();await expect(editor.getByRole('button',{name:'Remove contributor Bob selected for project'})).toBeDisabled();expect(fixture.commands).toHaveLength(0);
});

test('NW5.4 actual reload recovers a draft and collapse requires explicit discard',async({page})=>{
 const fixture=await hierarchyFixture(page);const toggle=page.getByRole('button',{name:'Subitems for '+title,exact:true});await toggle.click();const tree=page.getByRole('region',{name:'Nested project work'});
 await workAction(page,'Task work actions','Add subitem');await tree.getByLabel('Subitem title').fill('Reload draft');
 page.once('dialog',dialog=>dialog.accept());await page.reload();await toggle.click();await tree.getByRole('button',{name:'Recover new subitem draft'}).click();await expect(tree.getByLabel('Subitem title')).toHaveValue('Reload draft');await expect(tree).toContainText('Draft recovered after current access verification');expect(fixture.commands).toHaveLength(0);
 await toggle.click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(tree.getByLabel('Subitem title')).toHaveValue('Reload draft');await toggle.click();await page.getByRole('button',{name:'Discard',exact:true}).click();await expect(tree).toHaveCount(0);await toggle.click();await expect(tree.getByRole('button',{name:'Recover new subitem draft'})).toHaveCount(0);
});

test('NW5.4 actual reload retries a lost committed receipt with identical frozen terms',async({page})=>{
 const fixture=await hierarchyFixture(page);const toggle=page.getByRole('button',{name:'Subitems for '+title,exact:true});await toggle.click();const tree=page.getByRole('region',{name:'Nested project work'});
 await workAction(page,'Task work actions','Add subitem');await tree.getByLabel('Subitem title').fill('Receipt across reload');await tree.getByRole('button',{name:'Save work changes'}).click();await expect(tree.getByRole('alert')).toContainText('Committed work receipt interrupted');expect(fixture.commands).toHaveLength(1);
 page.once('dialog',dialog=>dialog.accept());await page.reload();await toggle.click();await tree.getByRole('button',{name:'Recover new subitem draft'}).click();await expect(tree).toContainText('Recovered draft is stale');await tree.getByRole('button',{name:'Retry saved request'}).click();await expect(tree.getByRole('button',{name:'Receipt across reload',exact:true})).toBeVisible();expect(fixture.commands).toHaveLength(2);expect(fixture.commands[1]).toEqual(fixture.commands[0]);expect(fixture.nodes.filter(node=>node.title==='Receipt across reload')).toHaveLength(1);
});

test('NW5.4 transient failure retains drafts and denied access quarantines them until renewed read',async({page})=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await workAction(page,'Task work actions','Add subitem');await tree.getByLabel('Subitem title').fill('Quarantined draft');
 fixture.readFailure='offline';await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(tree).toContainText('Work temporarily offline');await expect(tree.getByLabel('Subitem title')).toHaveValue('Quarantined draft');await expect(tree.getByRole('button',{name:'Save work changes'})).toBeDisabled();
 fixture.readFailure='denied';await tree.getByRole('button',{name:'Retry work'}).click();await expect(tree).toContainText('Nested work access denied');await expect(tree.getByLabel('Subitem title')).toHaveCount(0);await expect(tree.getByRole('button',{name:'Depth 1 work',exact:true})).toHaveCount(0);
 fixture.readFailure=null;await tree.getByRole('button',{name:'Retry work'}).click();await expect(tree.getByLabel('Subitem title')).toHaveValue('Quarantined draft');await expect(tree).toContainText('Draft recovered after current access verification');expect(fixture.commands).toHaveLength(0);
});

test('NW5.5 authoritative deletion blockers and cancel preserve all subitems',async({page})=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});
 fixture.impactBlocked=true;await workAction(page,'Actions for Depth 1 work','Delete subtree');await tree.getByRole('button',{name:'Review deletion'}).click();const review=page.getByRole('alertdialog',{name:'Delete untouched subtree?'});
 await expect(review).toContainText('2 subitems in the selected scope; 1 are child subitems');await expect(review).toContainText('financial commitments');await expect(review.getByRole('button',{name:'Delete subtree',exact:true})).toBeDisabled();await review.getByRole('button',{name:'Cancel',exact:true}).click();expect(fixture.commands).toHaveLength(0);expect(fixture.nodes).toHaveLength(2);
 fixture.impactBlocked=false;await tree.getByRole('button',{name:'Review deletion'}).click();await review.getByRole('button',{name:'Cancel',exact:true}).click();expect(fixture.previews).toHaveLength(2);expect(fixture.commands).toHaveLength(0);
 await tree.getByRole('button',{name:'Review deletion'}).click();await review.getByRole('button',{name:'Delete subtree',exact:true}).click();await expect(tree).toContainText('Work saved.');expect(fixture.nodes).toHaveLength(0);expect(fixture.commands[0].p_impact_fingerprint).toBeTruthy();
});

test('NW5.5 history changes reject a checked mode change; lost accepted receipt retries exactly after reload',async({page})=>{
 const fixture=await hierarchyFixture(page);const toggle=page.getByRole('button',{name:'Subitems for '+title,exact:true});await toggle.click();const tree=page.getByRole('region',{name:'Nested project work'});await workAction(page,'Actions for Depth 1 work','Edit details');await tree.getByLabel('Execution mode').selectOption('sequence');await tree.getByRole('button',{name:'Save work changes'}).click();const review=page.getByRole('alertdialog',{name:'Review execution mode change?'});
 await expect(review).toContainText('Can start independently → In sequence');fixture.changeHistory();await review.getByRole('button',{name:'Confirm changes',exact:true}).click();await expect(tree.getByRole('alert')).toContainText('Affected work changed after preview');expect(fixture.nodes[0].is_standalone).toBe(true);expect(fixture.commands).toHaveLength(1);
 fixture.lostCheckedReceipt=true;await tree.getByRole('button',{name:'Save work changes'}).click();await review.getByRole('button',{name:'Confirm changes',exact:true}).click();await expect(tree.getByRole('alert')).toContainText('Committed work receipt interrupted');expect(fixture.nodes[0].is_standalone).toBe(false);const accepted=fixture.commands[1];
 page.once('dialog',dialog=>dialog.accept());await page.reload();await toggle.click();await tree.getByRole('button',{name:'Recover details draft'}).click();await tree.getByRole('button',{name:'Retry saved request'}).click();await expect(tree).toContainText('Work saved.');expect(fixture.commands).toHaveLength(3);expect(fixture.commands[2]).toEqual(accepted);expect(fixture.previews).toHaveLength(2);expect(fixture.commands[0].p_request).not.toBe(accepted.p_request);
});

test('NW5.5 routine date saves through checked preview without an extra prompt',async({page})=>{
 const fixture=await hierarchyFixture(page,'head',1);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await workAction(page,'Actions for Depth 1 work','Edit details');await tree.getByLabel('Subitem due date').fill('2026-10-08');await tree.getByRole('button',{name:'Save work changes'}).click();await expect(tree.getByLabel('Subitem due date')).toHaveCount(0);expect(fixture.previews).toHaveLength(1);expect(fixture.commands).toHaveLength(1);expect(fixture.commands[0].p_impact_fingerprint).toBe('fixture-impact-7-0');expect(fixture.nodes[0].due_date).toBe('2026-10-08');await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('NW5.5 material date cancellation and changed-history denial retain the draft',async({page})=>{
 const fixture=await hierarchyFixture(page,'head',1);fixture.materialDate=true;await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await workAction(page,'Actions for Depth 1 work','Edit details');await tree.getByLabel('Subitem due date').fill('2026-10-08');await tree.getByRole('button',{name:'Save work changes'}).click();const review=page.getByRole('alertdialog',{name:'Review due-date impact?'});await expect(review).toContainText('2026-10-09 → 2026-10-08');await review.getByRole('button',{name:'Cancel',exact:true}).click();expect(fixture.commands).toHaveLength(0);await expect(tree.getByLabel('Subitem due date')).toHaveValue('2026-10-08');await tree.getByRole('button',{name:'Save work changes'}).click();fixture.changeHistory();await review.getByRole('button',{name:'Confirm changes',exact:true}).click();await expect(tree.getByRole('alert')).toContainText('Affected work changed after preview');expect(fixture.nodes[0].due_date).toBe('2026-10-09');expect(fixture.commands).toHaveLength(1);await tree.getByRole('button',{name:'Save work changes'}).click();await review.getByRole('button',{name:'Confirm changes',exact:true}).click();await expect(tree.getByLabel('Subitem due date')).toHaveCount(0);expect(fixture.nodes[0].due_date).toBe('2026-10-08');expect(fixture.commands[1].p_impact_fingerprint).toBe('fixture-impact-7-1');
});

test('NW5.5 Lead transfer binds disclosed staffing to authoritative checked impact',async({page})=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await workAction(page,'Actions for Depth 1 work','Choose people');const editor=page.getByRole('dialog',{name:'Subitem Lead and contributors'});await editor.getByLabel('Appointed Lead').selectOption(bob);await editor.getByRole('button',{name:'Save work changes'}).click();const review=page.getByRole('alertdialog',{name:'Transfer Lead appointment?'});
 await expect(review).toContainText('Bob selected for project');await expect(review).toContainText('1 child Lead appointments will be cleared');await expect(review).toContainText('Retained workers:');expect(fixture.commands).toHaveLength(0);await review.getByRole('button',{name:'Transfer Lead',exact:true}).click();await expect(editor).toHaveCount(0);expect(fixture.commands[0]).toMatchObject({p_command:'staff',p_payload:{lead:bob,people:[fixture.records.id,bob]}});expect(fixture.commands[0].p_impact_fingerprint).toBeTruthy();expect(fixture.nodes[1].lead_id).toBeNull();
});

test('NW5.5 sibling ordering uses labelled keyboard controls and the full authorized sequence',async({page})=>{
 const fixture=await hierarchyFixture(page);fixture.nodes.push({...fixture.nodes[0],id:'60000000-0000-4000-8000-000000000099',title:'Second sibling',sibling_order:1});await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await expect(tree.getByRole('button',{name:'Second sibling',exact:true})).toBeVisible();await workAction(page,'Task work actions','Reorder children');const list=tree.getByRole('list',{name:'Subitem sequence'});await expect(list.getByRole('listitem')).toHaveCount(2);await tree.getByRole('button',{name:'Move down Depth 1 work',exact:true}).press('Enter');await expect(list.getByRole('listitem').first()).toContainText('Second sibling');await tree.getByRole('button',{name:'Save work changes'}).click();await page.getByRole('alertdialog',{name:'Review subitem sequence?'}).getByRole('button',{name:'Confirm changes',exact:true}).click();await expect(tree).toContainText('Work saved.');expect(fixture.commands[0].p_payload).toEqual({parent:null,order:[fixture.nodes[2].id,fixture.nodes[0].id]});expect(fixture.commands[0].p_impact_fingerprint).toBeTruthy();
});


const acceptanceTitles=['Prepare an exceptionally long community assessment with detailed supporting evidence and continued coordination','Community interviews','Verify household records','Reconcile findings','Document changes','Resolve follow-up questions','Review supporting material','Publish the final evidence summary'];
const acceptanceActions=['Open work / evidence','Activity','Choose people','Add subitem','Reorder children','Edit details','Move','Delete subtree'];
for(const width of [320,390,768,1440])for(const theme of ['light','dark'])test('NW6.4 hierarchy acceptance at '+width+'px in '+theme,async({page},info)=>{
 const fixture=await hierarchyFixture(page,'head',8);await page.setViewportSize({width,height:950});
 fixture.nodes.forEach((node,index)=>{node.title=acceptanceTitles[index];node.percent_complete=index===7?43:0;node.status=['todo','in_progress','for_review','changes_requested','completed','todo','todo','todo'][index];});
 fixture.members[0].name='Alexandra Victoria del Rosario with a very long authorized project name';fixture.members[1].name='Bernardino Francisco de la Cruz with a very long selected contributor name';fixture.nodes[0].assigned_to_ids=[fixture.records.id,bob];fixture.nodes[6].lead_id='historical-person';fixture.nodes[6].assigned_to_ids=['historical-person'];fixture.nodes[7].lead_id=null;fixture.nodes[7].assigned_to_ids=[];
 fixture.blockReads();await page.reload();await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
 const toggle=page.getByRole('button',{name:'Subitems for '+title,exact:true});await toggle.click();const tree=page.getByRole('region',{name:'Nested project work'});
 await expect(tree.getByRole('status')).toContainText('Loading subitems');fixture.releaseReads();await expect(tree.getByRole('button',{name:acceptanceTitles[7],exact:true})).toBeVisible();
 const hierarchy=tree.getByRole('region',{name:'Subitem work'}),rows=hierarchy.locator('[data-work-row]');await expect(rows).toHaveCount(8);
 await expect(hierarchy.getByRole('table',{name:'Subitem hierarchy',exact:true})).toHaveCount(1);await expect(hierarchy.getByRole('list',{name:'Subitem hierarchy',exact:true})).toHaveCount(0);
 expect(await rows.evaluateAll(elements=>elements.map(element=>Number((element.querySelector('.nw-hierarchy-title') as HTMLElement).style.getPropertyValue('--nw-indent'))))).toEqual([0,1,2,3,3,3,3,3]);
 await expect(rows.nth(7).getByLabel('Path for '+acceptanceTitles[7],{exact:true})).toHaveText(acceptanceTitles.join(' / '));
 await expect(rows.nth(0)).toContainText(fixture.members[0].name);await expect(rows.nth(0)).toContainText(fixture.members[1].name);await expect(rows.nth(6)).toContainText('Previously assigned person');await expect(rows.nth(7)).toContainText('Needs reassignment');await expect(rows.nth(7)).toContainText('No contributors');
 for(const [index,status] of ['To do','In progress','For review','Changes requested','Completed'].entries())await expect(rows.nth(index)).toContainText(status);
 await expect(rows.nth(7).getByRole('group',{name:'Progress for '+acceptanceTitles[7],exact:true}).getByRole('progressbar',{name:'43% complete',exact:true})).toHaveAttribute('aria-valuenow','43');await expect(tree).not.toContainText('Task progress is managed separately');await expect(hierarchy.getByRole('columnheader')).toHaveText(['Subitem','Lead','Contributors','Status','Due date','Progress','Actions']);
 const actions=rows.nth(0).getByRole('button',{name:'Actions for '+acceptanceTitles[0],exact:true});await actions.focus();await actions.press('Enter');await expect(page.getByRole('menuitem')).toHaveText(acceptanceActions);await page.getByRole('menu').press('Escape');await expect(actions).toBeFocused();
 const disclosure=hierarchy.getByRole('button',{name:'Collapse children of '+acceptanceTitles[0],exact:true});await expect(disclosure).toHaveAttribute('aria-expanded','true');await disclosure.press('Space');await expect(rows).toHaveCount(1);const expand=hierarchy.getByRole('button',{name:'Expand children of '+acceptanceTitles[0],exact:true});await expect(expand).toHaveAttribute('aria-expanded','false');await expand.press('Enter');await expect(rows).toHaveCount(8);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.getByRole('separator',{name:'Resize Owner column',exact:true}).first().press('End');await page.getByRole('separator',{name:'Resize Task column',exact:true}).first().press('End');const scroll=page.locator('.pt-table-scroll').first();expect(await scroll.evaluate(element=>getComputedStyle(element).overflowX)).toBe('auto');expect(await scroll.evaluate(element=>element.scrollWidth>element.clientWidth)).toBe(true);
 const nestedHeaders=hierarchy.getByRole('columnheader');expect((await nestedHeaders.nth(0).boundingBox())!.width).toBeLessThanOrEqual(280);expect((await nestedHeaders.nth(1).boundingBox())!.width).toBeGreaterThanOrEqual(100);
 if(width<640){for(const node of fixture.nodes){const row=hierarchy.locator('[data-work-row="'+node.id+'"]');for(const control of [row.getByRole('button',{name:node.title,exact:true}),row.getByRole('button',{name:'Actions for '+node.title,exact:true})]){await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);}}}
 if(width>=640){const button=rows.nth(0).getByRole('button',{name:'Actions for '+acceptanceTitles[0],exact:true});expect(await button.evaluate(element=>getComputedStyle(element).whiteSpace)).toBe('nowrap');expect(await rows.nth(0).locator('td').nth(3).evaluate(element=>getComputedStyle(element).whiteSpace)).toBe('nowrap');expect(await rows.nth(0).locator('td').nth(4).evaluate(element=>getComputedStyle(element).whiteSpace)).toBe('nowrap');expect(await button.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);for(const pill of await rows.locator('.eflow-status-pill').all()){expect(await pill.evaluate(element=>getComputedStyle(element).whiteSpace)).toBe('nowrap');expect(await pill.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);}}
 await page.screenshot({path:info.outputPath('nw64-hierarchy-'+width+'-'+theme+'.png'),fullPage:true});
 fixture.readFailure='offline';await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(tree.getByRole('alert')).toContainText('Work temporarily offline');await expect(rows).toHaveCount(8);await actions.click();await expect(page.getByRole('menuitem',{name:'Edit details',exact:true})).toHaveAttribute('aria-disabled','true');await page.getByRole('menu').press('Escape');fixture.readFailure=null;await tree.getByRole('button',{name:'Retry work'}).click();await actions.click();await expect(page.getByRole('menuitem',{name:'Edit details',exact:true})).not.toHaveAttribute('aria-disabled','true');await page.getByRole('menu').press('Escape');
 fixture.nodes.splice(0);await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(hierarchy).toContainText('No subitems yet.');expect(fixture.commands).toHaveLength(0);
});

for(const width of [320,1440])test('NW6.4 keyboard editor focus and dirty Escape/collapse at '+width+'px',async({page})=>{
 const fixture=await hierarchyFixture(page);await page.setViewportSize({width,height:950});const toggle=page.getByRole('button',{name:'Subitems for '+title,exact:true});await toggle.press('Enter');const tree=page.getByRole('region',{name:'Nested project work'}),node=fixture.nodes[0],trigger=tree.getByRole('button',{name:'Actions for '+node.title,exact:true});
 await trigger.focus();await trigger.press('Enter');const edit=page.getByRole('menuitem',{name:'Edit details',exact:true});await edit.focus();await edit.press('Enter');const input=tree.getByLabel('Subitem title');await expect(input).toBeFocused();await tree.getByRole('button',{name:'Cancel changes',exact:true}).press('Enter');await expect(tree.getByRole('button',{name:node.title,exact:true})).toBeFocused();
 await trigger.press('Enter');await page.getByRole('menuitem',{name:'Edit details',exact:true}).click();await input.fill('Retained keyboard draft');await input.press('Escape');await expect(input).toHaveValue('Retained keyboard draft');await expect(toggle).toHaveAttribute('aria-expanded','true');
 const collapse=tree.getByRole('button',{name:'Collapse children of '+node.title,exact:true});await collapse.press('Enter');await expect(page.getByRole('button',{name:'Keep editing',exact:true})).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).press('Escape');await expect(input).toHaveValue('Retained keyboard draft');await expect(collapse).toHaveAttribute('aria-expanded','true');await expect(tree.getByRole('button',{name:fixture.nodes[1].title,exact:true})).toBeVisible();
 await toggle.press('Enter');await page.getByRole('button',{name:'Keep editing',exact:true}).press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(input).toHaveValue('Retained keyboard draft');await toggle.press('Enter');await page.getByRole('button',{name:'Discard',exact:true}).press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','false');await toggle.press('Enter');await expect(input).toHaveCount(0);
 const rootMenu=tree.getByRole('button',{name:'Task work actions',exact:true});await rootMenu.press('Enter');await page.getByRole('menuitem',{name:'Reorder children',exact:true}).press('Enter');await expect(tree.getByRole('button',{name:'Cancel changes',exact:true})).toBeFocused();await tree.getByRole('button',{name:'Cancel changes',exact:true}).press('Enter');await expect(rootMenu).toBeFocused();
 const taskMenu=page.getByRole('button',{name:'Actions for '+title,exact:true});await taskMenu.press('Enter');await page.getByRole('menuitem',{name:'Add subitem',exact:true}).press('Enter');await expect(input).toBeFocused();await tree.getByRole('button',{name:'Cancel changes',exact:true}).press('Enter');await expect(taskMenu).toBeFocused();expect(fixture.commands).toHaveLength(0);
});


for(const width of [320,1440])test('NW8.1 canonical deep Subitem context, parent navigation and retained draft at '+width,async({page})=>{
 await page.setViewportSize({width,height:900});const fixture=await hierarchyFixture(page,'member',8);
 fixture.nodes[7].lead_id=bob;fixture.nodes[7].assigned_to_ids=[bob];fixture.nodes[7].percent_complete=43;
 await page.route('**/rest/v1/subtasks?*',async route=>{
  const query=new URL(route.request().url()).searchParams;
  const selected=query.get('id')?.replace(/^eq\./,'');
  const rows=fixture.nodes.filter(node=>!selected||node.id===selected);
  const object=route.request().headers().accept?.includes('vnd.pgrst.object');
  return route.fulfill({json:object?rows[0]||null:rows});
 });
 const reads:{table:string;item:string|null;root:string|null}[]=[];
 for(const table of ['subtask_submissions','subtask_progress_updates'])await page.route('**/rest/v1/'+table+'?*',async route=>{
  const query=new URL(route.request().url()).searchParams;reads.push({table,item:query.get('subtask_id'),root:query.get('task_id')});return route.fulfill({json:[]});
 });
 await page.reload();await expect(page.getByRole('button',{name:'Choose task lead and contributors'}).first()).toBeVisible();
 await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();
 const opener=page.locator('[data-work-open="'+fixture.nodes[7].id+'"]');await opener.click();
 let inspector=page.getByRole('dialog',{name:'Subtask details: Depth 8 work'});await expect(inspector).toBeVisible();
 await expect(inspector.getByRole('navigation',{name:'Subitem path'})).toContainText('Depth 1 work / Depth 2 work / Depth 3 work / Depth 4 work / Depth 5 work / Depth 6 work / Depth 7 work / Depth 8 work');
 await expect(inspector.getByText('Bob selected for project',{exact:true})).toHaveCount(2);
 await expect(inspector.getByRole('progressbar',{name:'43% complete'})).toHaveAttribute('aria-valuenow','43');
 expect(reads).toEqual(expect.arrayContaining(['subtask_submissions','subtask_progress_updates'].map(table=>({table,item:'eq.'+fixture.nodes[7].id,root:'eq.'+fixture.nodes[7].task_id}))));
 const rootReads=fixture.treeReads.get(fixture.nodes[7].task_id);
 await inspector.getByRole('navigation',{name:'Subitem path'}).getByRole('button',{name:'Depth 7 work',exact:true}).click();
 inspector=page.getByRole('dialog',{name:'Subtask details: Depth 7 work'});await expect(inspector).toBeVisible();
 await expect(inspector.locator('[data-work-open]')).toHaveCount(1);await expect(inspector.locator('[data-work-open]')).toHaveAttribute('data-work-open',fixture.nodes[7].id);
 expect(fixture.treeReads.get(fixture.nodes[7].task_id)).toBe(rootReads);
 await inspector.getByLabel('Progress note (optional)').fill('Retain my scoped evidence draft');
 await inspector.getByRole('navigation',{name:'Subitem path'}).getByRole('button',{name:'Depth 6 work',exact:true}).click();
 const guard=page.getByRole('alertdialog');await expect(guard).toBeVisible();await guard.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(inspector.getByLabel('Progress note (optional)')).toHaveValue('Retain my scoped evidence draft');
 expect(fixture.commands).toHaveLength(0);
});

async function inspectorFixture(page:Page,review=false){
 const fixture=await hierarchyFixture(page,'member',2),selected=fixture.nodes[1];
 selected.assigned_to_ids=review?[bob]:[];selected.status=review?'for_review':'todo';selected.percent_complete=review?100:20;selected.current_reviewer=review?fixture.records.id:null;
 const entry=(allowed:boolean)=>({allowed,reason_code:allowed?null:'branch_denied'});
 selected.capabilities={execute:entry(!review),submit:entry(!review),review:entry(review),manage_contributors:entry(!review),appoint_lead:entry(false),edit_details:entry(!review),create_child:entry(!review),order_children:entry(!review),move:entry(!review),delete:entry(!review)};
 // Legacy flags deliberately disagree with current maps.
 selected.can_work=review;selected.can_manage=review;
 await page.route('**/rest/v1/subtasks?*',async route=>{const query=new URL(route.request().url()).searchParams,filter=query.get('id');const ids=filter?.startsWith('eq.')?[filter.slice(3)]:filter?.startsWith('in.(')?filter.slice(4,-1).split(','):undefined;const rows=fixture.nodes.filter(node=>!ids||ids.includes(node.id));return route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows});});
 const submission={id:'80000000-0000-4000-8000-000000000082',subtask_id:selected.id,task_id:selected.task_id,submitter_id:bob,submitter_name:'Recorded contributor',reviewer_id:'recorded-original-reviewer',status:'pending',version:1,note:'Recorded Office evidence',submitted_at:'2026-10-12T00:00:00Z'};
 await page.route('**/rest/v1/subtask_submissions?*',route=>route.fulfill({json:review?[submission]:[]}));
 await page.route('**/rest/v1/subtask_progress_updates?*',route=>route.fulfill({json:[]}));
 await page.route('**/rest/v1/rpc/r7_pending_subtask_reviews',route=>route.fulfill({json:review?[submission]:[]}));
 await page.reload();await expect(page.getByRole('button',{name:'Choose task lead and contributors'}).first()).toBeVisible();await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();await page.locator('[data-work-open="'+selected.id+'"]').click();
 const inspector=page.getByRole('dialog',{name:'Subtask details: Depth 2 work'});await expect(inspector).toBeVisible();return {fixture,selected,inspector,submission};
}
test('NW8.2 own eligible Subitem Lead executes without contributor assignment and manages only current branch actions',async({page})=>{
 const {fixture,inspector}=await inspectorFixture(page);await expect(inspector.getByRole('button',{name:'Save update'})).toBeEnabled();await expect(inspector.getByText('No contributors',{exact:true})).toBeVisible();
 await expect(inspector.getByText('Can start independently',{exact:true})).toBeVisible();await inspector.getByRole('button',{name:'Child work actions'}).click();await expect(page.getByRole('menuitem',{name:'Choose people',exact:true})).toBeVisible();await expect(page.getByRole('menuitem',{name:'Edit details',exact:true})).toBeVisible();await page.keyboard.press('Escape');expect(fixture.commands).toHaveLength(0);
});
test('NW8.2 reviewer-only Inspector retains feedback on revocation without acquiring execution management or cash controls',async({page})=>{
 const {fixture,selected,inspector}=await inspectorFixture(page,true);await expect(inspector.getByRole('button',{name:'Save update'})).toHaveCount(0);await expect(inspector.getByRole('button',{name:'Child work actions'})).toHaveCount(0);await expect(inspector.getByRole('button',{name:'Request cash'})).toHaveCount(0);
 await inspector.getByRole('button',{name:'Review evidence'}).click();const review=page.getByRole('dialog',{name:'Subitem evidence review'});await expect(review.getByRole('button',{name:'Approve evidence'})).toBeEnabled();await expect(review).toContainText('Recorded contributor');
 await review.getByPlaceholder('Explain what needs correction…').fill('Retain reviewer feedback');selected.capabilities.review={allowed:false,reason_code:'branch_denied'};selected.current_reviewer=null;fixture.members.find(member=>member.user_id===fixture.records.id)!.eligible=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(review.getByRole('button',{name:'Approve evidence'})).toBeDisabled();await expect(review.getByPlaceholder('Explain what needs correction…')).toHaveValue('Retain reviewer feedback');expect(fixture.commands).toHaveLength(0);
});


test('NW8.3 shared review detail preserves permitted context, denied evidence and failed-decision feedback',async({page})=>{
 const {fixture,selected,inspector,submission}=await inspectorFixture(page,true);
 await page.route('**/rest/v1/subtask_submission_attachments?*',route=>route.fulfill({json:[{id:'nw83-proof',submission_id:submission.id,file_name:'private-proof.pdf',file_path:'subtasks/'+selected.id+'/sealed/proof.pdf',file_size:12,mime_type:'application/pdf'}]}));
 const signed:string[]=[],decisions:any[]=[];
 await page.route('**/storage/v1/object/sign/task-attachments/**',route=>{signed.push(route.request().url());return route.fulfill({status:403,json:{message:'Evidence access denied'}});});
 await page.route('**/rest/v1/rpc/decide_subtask_review',route=>{decisions.push(route.request().postDataJSON());return route.fulfill({status:403,json:{code:'42501',message:'Current independent reviewer required'}});});
 await inspector.getByRole('button',{name:'Review evidence'}).click();const review=page.getByRole('dialog',{name:'Subitem evidence review'}),detail=review.getByRole('region',{name:'Subitem review detail'});
 await expect(detail.getByRole('navigation',{name:'Review work path'})).toContainText('Depth 1 work / Depth 2 work');await expect(detail).toContainText('Parent: Depth 1 work');await expect(detail).toContainText('Progress: 100%');await expect(detail).toContainText('Submitted by Recorded contributor');await expect(detail).toContainText('Current reviewer: '+fixture.members[0].name);
 await expect(detail.getByText('private-proof.pdf').locator('..')).not.toHaveAttribute('href',/.+/);await expect.poll(()=>signed.length).toBe(1);
 await detail.getByPlaceholder('Explain what needs correction…').fill('Retain failed decision feedback');await detail.getByRole('button',{name:'Request changes'}).click();await expect(page.getByText('Current independent reviewer required',{exact:true})).toBeVisible();await expect(detail.getByPlaceholder('Explain what needs correction…')).toHaveValue('Retain failed decision feedback');expect(decisions).toEqual([{p_subtask_id:selected.id,p_approve:false,p_feedback:'Retain failed decision feedback'}]);expect(submission.reviewer_id).toBe('recorded-original-reviewer');
 await review.getByRole('button',{name:'Close',exact:true}).click();const guard=page.getByRole('alertdialog');await expect(guard).toBeVisible();await guard.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(detail.getByPlaceholder('Explain what needs correction…')).toHaveValue('Retain failed decision feedback');expect(fixture.commands).toHaveLength(0);
});

test('NW9.4 standalone queue searches authorized depth-eight context and keeps feedback without stale evidence links after reviewer access ends',async({page})=>{
 const fixture=await hierarchyFixture(page,'member',8),leaf=fixture.nodes[7];
 for(const node of fixture.nodes)node.title='Same';
 leaf.status='for_review';leaf.percent_complete=100;leaf.assigned_to_ids=[bob,fixture.records.id,bob];
 const attempt={id:'80000000-0000-4000-8000-000000000094',subtask_id:leaf.id,task_id:leaf.task_id,submitter_id:bob,submitter_name:'Original submitter',reviewer_id:'recorded-original-reviewer',status:'pending',version:2,note:'Immutable evidence note',submitted_at:'2026-10-12T00:00:00Z'};
 const state={eligible:true};
 await page.route('**/rest/v1/rpc/r7_pending_subtask_reviews',route=>route.fulfill({json:state.eligible?[attempt]:[]}));
 await page.route('**/rest/v1/subtasks?*',route=>{
  const query=new URL(route.request().url()).searchParams,filter=query.get('id');
  const selected=filter?.startsWith('in.(')?filter.slice(4,-1).split(','):undefined;
  const rows=fixture.nodes.filter(node=>!selected||selected.includes(node.id));
  return route.fulfill({json:rows,headers:{'access-control-expose-headers':'content-range','content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`}});
 });
 await page.route('**/rest/v1/subtask_submission_attachments?*',route=>route.fulfill({json:[{id:'proof94',submission_id:attempt.id,file_name:'private-proof.pdf',file_path:`subtasks/${leaf.id}/sealed/proof.pdf`,file_size:12,mime_type:'application/pdf'}]}));
 await page.route('**/storage/v1/object/sign/task-attachments/**',route=>route.fulfill({json:{signedURL:'/object/sign/task-attachments/private-proof.pdf?token=synthetic'}}));
 await page.goto(`/reviews?section=leader&page=For%20Review&view=subtasks&workspace=${fixture.records.org}`);
 const detail=page.getByRole('region',{name:'Subitem review detail'});
 const path=[title,...Array(8).fill('Same')].join(' / ');
 await expect(detail.getByRole('navigation',{name:'Review work path'})).toHaveText(path);
 await expect(detail).toContainText('Current reviewer: Alex Rivera');
 await expect(detail).toContainText('Lead: Alex Rivera · Contributors (1): Bob selected for project');
 // Verify the debounced filter has actually applied before beginning a
 // feedback draft; a late filter request must not be mistaken for revocation.
 await page.getByLabel('Search subtask evidence',{exact:true}).fill('No matching authorized review path');
 await expect(detail).toHaveCount(0);
 await page.getByLabel('Search subtask evidence',{exact:true}).fill(path);
 await expect(detail.getByRole('navigation',{name:'Review work path'})).toHaveText(path);
 await expect(detail).toContainText('Immutable evidence note');
 await expect(detail.getByRole('link',{name:'private-proof.pdf'})).toHaveAttribute('href',/synthetic/);
 await detail.getByPlaceholder('Explain what needs correction…').fill('Keep authorized review feedback');
 state.eligible=false;await page.evaluate(()=>window.dispatchEvent(new Event('eflow-project-access-changed')));
 await expect(detail.getByRole('button',{name:'Approve evidence'})).toBeDisabled();
 await expect(detail.getByPlaceholder('Explain what needs correction…')).toHaveValue('Keep authorized review feedback');
 await expect(detail.getByRole('link',{name:'private-proof.pdf'})).toHaveCount(0);
 await expect(detail).toContainText('Evidence unavailable until current review access is verified.');
 expect(attempt.reviewer_id).toBe('recorded-original-reviewer');expect(fixture.commands).toHaveLength(0);
});


for(const [width,dark] of [[320,false],[1440,true]] as const)test('NW8.4 scoped Activity keeps dirty Work and raw historical page cursor at '+width+(dark?' dark':' light'),async({page})=>{
 await page.setViewportSize({width,height:900});const {fixture,selected,inspector}=await inspectorFixture(page);if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
 const snapshots=(nodes:any[])=>({root:{id:selected.task_id,project:fixture.records.project,office:fixture.records.org,kind:'office'},nodes});
 const current=snapshots(fixture.nodes),past=snapshots([...fixture.nodes,{...selected,id:'nw84-deleted',parent_subtask_id:selected.id,title:'Deleted descendant'}]);const event=(id:string,node:string|null,actor:string,before=current,after=current)=>({id,root_id:selected.task_id,node_id:node,command:'edit',actor_name:actor,occurred_at:'2026-10-12T00:00:00Z',before_data:before,after_data:after});
 const calls:any[]=[];await page.route('**/rest/v1/rpc/r7_work_activity',route=>{const payload=route.request().postDataJSON();calls.push(payload);return route.fulfill({json:payload.p_id?{events:[event('own',selected.id,'Own branch actor'),{...event('delete','nw84-deleted','Historical descendant actor',past,current),command:'delete'}],more:false}:{events:[event('raw-last',fixture.nodes[0].id,'Unrelated ancestor actor')],more:true}});});
 await inspector.getByLabel('Progress note (optional)').fill('Keep my Work draft');await inspector.getByRole('button',{name:'Activity',exact:true}).click();let guard=page.getByRole('alertdialog');await expect(guard).toBeVisible();await guard.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(inspector.getByLabel('Progress note (optional)')).toHaveValue('Keep my Work draft');expect(calls).toHaveLength(0);
 await inspector.getByRole('button',{name:'Activity',exact:true}).click();guard=page.getByRole('alertdialog');await guard.getByRole('button',{name:'Discard',exact:true}).click();const activity=inspector.getByRole('region',{name:'Subitem activity'});await expect(activity).toContainText('No permitted work changes on this page.');await expect(activity).not.toContainText('Unrelated ancestor actor');await activity.getByRole('button',{name:'Older work changes'}).click();await expect(activity).toContainText('Own branch actor');await expect(activity).toContainText('Historical descendant actor');await expect(activity).toContainText('Deleted descendant');expect(calls).toEqual([{p_roots:[selected.task_id],p_before:null,p_id:null},{p_roots:[selected.task_id],p_before:'2026-10-12T00:00:00Z',p_id:'raw-last'}]);
 await expect(activity).toContainText('Subitem deleted');await expect(activity).toContainText('Removed 1 subitem(s)');await expect(activity).toContainText('Path:');await expect(activity).not.toContainText('Unrelated ancestor actor');
 await expect(inspector.getByRole('button',{name:'Task work actions'})).toHaveCount(0);await page.keyboard.press('Escape');await expect(inspector).not.toBeVisible();await expect(page.locator('[data-work-open="'+selected.id+'"]').first()).toBeFocused();expect(fixture.commands).toHaveLength(0);
});

test('NW8.4 Work Review opens canonical ID and keeps feedback through current reviewer changes',async({page})=>{
 const {fixture,selected,inspector}=await inspectorFixture(page,true);await inspector.getByRole('button',{name:'Close subtask detail'}).click();await expect(inspector).not.toBeVisible();await page.getByRole('button',{name:'Actions for '+title,exact:true}).click();await page.getByRole('menuitem',{name:'Task details, evidence & review',exact:true}).click();const taskInspector=page.getByRole('dialog',{name:'Task details: '+title});await taskInspector.getByRole('tab',{name:'Work',exact:true}).click();await taskInspector.getByRole('button',{name:'Actions for Depth 2 work',exact:true}).click();await page.getByRole('menuitem',{name:'Review',exact:true}).click();const canonical=page.getByRole('dialog',{name:'Subtask details: Depth 2 work',includeHidden:true}),review=page.getByRole('dialog',{name:'Subitem evidence review'});await expect(canonical).toBeVisible();await expect(review.getByRole('navigation',{name:'Review work path'})).toContainText('Depth 1 work / Depth 2 work');await review.getByPlaceholder('Explain what needs correction…').fill('Keep current review feedback');
 fixture.members.push({...fixture.members[1],user_id:charlie,name:'Eligible parent reviewer'});fixture.nodes[0].lead_id=charlie;selected.current_reviewer=charlie;selected.capabilities.review={allowed:false,reason_code:'branch_denied'};fixture.members[0].eligible=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(review).toContainText('Current reviewer: Eligible parent reviewer');await expect(review.getByRole('button',{name:'Approve evidence'})).toBeDisabled();await expect(review.getByPlaceholder('Explain what needs correction…')).toHaveValue('Keep current review feedback');await page.keyboard.press('Escape');const guard=page.getByRole('alertdialog');await expect(guard).toBeVisible();await guard.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(review.getByPlaceholder('Explain what needs correction…')).toHaveValue('Keep current review feedback');expect(fixture.commands).toHaveLength(0);
});
