import {test,expect,type Page} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
const title='Prepare community assessment',bob='00000000-0000-4000-8000-000000000002',charlie='00000000-0000-4000-8000-000000000003',officeId='50000000-0000-4000-8000-000000000001';
async function hierarchyFixture(page:Page,role:'head'|'member'|'admin'='head',depth=2){
 const records=await projectWorkspaceFixture(page,role,true,{compactLayout:true});
 records.profiles.push({...records.profile,id:bob,full_name:'Bob selected for project',email:'bob@example.test',role:'member'},{...records.profile,id:charlie,full_name:'Charlie unselected',email:'charlie@example.test',role:'member'});
 records.projectOffices.push({id:officeId,project_id:records.project,office_id:records.org,relationship_type:'lead',invitation_status:'joined'});
 records.officeMembers.push({project_office_id:officeId,user_id:records.id},{project_office_id:officeId,user_id:bob});
 const member=(id:string)=>({user_id:id,project_office_id:officeId,office:records.org,office_name:'Planning Office',name:String(records.profiles.find(p=>p.id===id)?.full_name),engagement:'Permanent',access_end:null,until_close:false,access_ended_at:null,eligible:true,can_read:true,access:'member',state:'joined',responsibilities:id===records.id?[{root:records.tasks[0].id,title,role:'Task Lead'}]:[]});
 const members=[member(records.id),member(bob)],commands:any[]=[],receipts=new Map<string,unknown>();let revision=7,lostReceipt=true,closed=false,revoked=false;
 const root=String(records.tasks[0].id);const nodes:any[]=Array.from({length:depth},(_,i)=>({id:'60000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),task_id:root,parent_subtask_id:i?'60000000-0000-4000-8000-'+String(i).padStart(12,'0'):null,lead_id:records.id,title:`Depth ${i+1} work`,assigned_to_ids:[records.id],sibling_order:0,depth:i+1,due_date:'2026-10-09',is_standalone:true,status:'todo',percent_complete:0,can_manage:role!=='admin',can_appoint:role==='head',can_order:role==='head',can_work:role!=='admin',can_review:false}));
 const snapshot=(id:string)=>({root:{id,project:records.project,office:records.org,lead:records.id,kind:'office',open:!closed,people:[records.id],due:'2026-10-09'},revision,can_manage:role!=='admin'&&!closed&&!revoked,can_transfer:role==='head'&&!closed&&!revoked,nodes:id===root?nodes.map(n=>({...n,can_manage:n.can_manage&&!closed&&!revoked,can_work:n.can_work&&!closed&&!revoked})):[],people:members.filter(m=>m.eligible).map(m=>({id:m.user_id,name:m.name})),leaf_total:id===root?1:0,leaf_completed:0});
 await page.route('**/rest/v1/profiles?*',async route=>{
  const filter=new URL(route.request().url()).searchParams.get('id');if(!filter?.startsWith('eq.'))return route.fallback();
  const row=records.profiles.find(p=>p.id===filter.slice(3));return route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?row:[...(row?[row]:[])]});
 });
 await page.route('**/rest/v1/rpc/r7_*',async route=>{
  const op=new URL(route.request().url()).pathname.split('/').at(-1),payload=route.request().postDataJSON()||{};
  if(op==='r7_work_tree')return route.fulfill({json:snapshot(payload.p_root)});
  if(op==='r7_work_activity')return route.fulfill({json:{events:[],more:false}});
  if(op==='r7_office_work_roots'||op==='r7_pending_subtask_reviews'||op==='r7_personal_work_roots')return route.fulfill({json:[]});
  if(op==='r7_project_members')return route.fulfill({json:{kind:'office',members,offices:[{...records.projectOffices[0],name:'Planning Office',can_select:role==='head',eligible_count:records.profiles.length}]}});
  if(op==='r7_member_terms'){Object.assign(members.find(m=>m.user_id===payload.p_user)!,{engagement:payload.p_engagement,access_end:payload.p_end,until_close:payload.p_until_close});return route.fulfill({json:members.find(m=>m.user_id===payload.p_user)});}
  if(op==='r7_select_office_members'){
   const selected=payload.p_users as string[];records.officeMembers.splice(0,records.officeMembers.length,...selected.map(user_id=>({project_office_id:officeId,user_id})));members.splice(0,members.length,...selected.map(member));return route.fulfill({json:records.officeMembers});
  }
  if(op==='r7_work_command'){
   commands.push(payload);if(closed||revoked)return route.fulfill({status:403,json:{code:'42501',message:'Current branch authority denied'}});
   if(receipts.has(payload.p_request))return route.fulfill({json:snapshot(payload.p_root)});
   if(payload.p_revision!==revision)return route.fulfill({status:409,json:{code:'40001',message:'Work tree changed'}});
   const value=payload.p_payload;
   if(payload.p_command==='create')nodes.push({...nodes[0],id:value.id,title:value.title,parent_subtask_id:value.parent,lead_id:value.lead,assigned_to_ids:value.people,due_date:value.due,depth:value.parent?(nodes.find(n=>n.id===value.parent)?.depth||0)+1:1,sibling_order:0});
   if(payload.p_command==='contributors')Object.assign(records.tasks[0],{team_member_ids:value.people});
   revision++;receipts.set(payload.p_request,true);if(lostReceipt&&payload.p_command==='create'){lostReceipt=false;return route.fulfill({status:500,json:{code:'XX000',message:'Committed work receipt interrupted'}});}return route.fulfill({json:snapshot(payload.p_root)});
  }
  return route.fulfill({status:404,json:{code:'PGRST202',message:'No synthetic operation'}});
 });
 await page.reload();await expect(page.getByRole('button',{name:'Choose task lead and contributors'}).first()).toBeVisible({timeout:30000}).catch(()=>{if(role!=='admin')throw new Error('Root picker missing');});
 return {records,nodes,members,commands,set closed(value:boolean){closed=value;records.projects[0].status=value?'archived':'planning';},set revoked(value:boolean){revoked=value;}};
}
test.beforeEach(async({page})=>{test.setTimeout(90000);await page.setViewportSize({width:1440,height:1000});});
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
 await tree.getByRole('button',{name:'Add child to Depth 2 work',exact:true}).click();await tree.getByLabel('Subitem title').fill('New depth 3 work');await tree.getByLabel('Appointed lead').selectOption(bob);
 await page.getByRole('tab',{name:'Offices',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(tree.getByLabel('Subitem title')).toHaveValue('New depth 3 work');await tree.getByRole('button',{name:'Save work changes'}).dblclick();await expect(tree.getByRole('alert')).toContainText('Committed work receipt interrupted');expect(fixture.commands).toHaveLength(1);
 await tree.getByRole('button',{name:'Retry saved request'}).click();await expect(tree.getByText('New depth 3 work', {exact:true})).toBeVisible();expect(fixture.commands).toHaveLength(2);expect(fixture.commands[0]).toEqual(fixture.commands[1]);expect(fixture.nodes.filter(n=>n.title==='New depth 3 work')).toHaveLength(1);
 await page.screenshot({path:info.outputPath('r7-nested-desktop.png'),fullPage:true});
});
for(const width of [320,390])test(`R7 eight-level work and people picker stay reachable at ${width}px`,async({page},info)=>{
 await hierarchyFixture(page,'head',8);await page.setViewportSize({width,height:950});await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await expect(tree).toContainText('Depth 8');await expect(tree.getByRole('button',{name:'Add child to Depth 8 work',exact:true})).toHaveCount(0);await tree.getByRole('button',{name:'Staff Depth 8 work',exact:true}).click();await expect(tree.getByLabel('Find project people')).toBeVisible();await expect(tree.getByRole('checkbox',{name:/Charlie unselected/})).toHaveCount(0);await expect(tree.getByRole('button',{name:/Invite.*email/})).toHaveCount(0);await tree.getByRole('button',{name:'Save work changes'}).scrollIntoViewIfNeeded();for(const element of [tree.locator('form'),tree.getByRole('button',{name:'Save work changes'})]){const bounds=await element.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);}expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:info.outputPath(`r7-depth8-${width}.png`),fullPage:true});
});
test('R7 a Member root lead can choose contributors while root transfer stays absent',async({page})=>{
 const fixture=await hierarchyFixture(page,'member');await page.getByRole('button',{name:'Choose task lead and contributors'}).first().click();const editor=page.getByRole('dialog',{name:'Task lead and contributors'});await expect(editor.getByLabel('Appointed lead')).toHaveCount(0);await editor.getByRole('checkbox',{name:'Bob selected for project · Contributor'}).check();await editor.getByRole('button',{name:'Save work changes'}).click();await expect(editor).toHaveCount(0);expect(fixture.commands[0]).toMatchObject({p_command:'contributors',p_payload:{people:[fixture.records.id,bob]}});
});
test('R7 current authority refresh keeps the draft and blocks a revoked branch',async({page})=>{
 const fixture=await hierarchyFixture(page);await page.getByRole('button',{name:'Subitems for '+title,exact:true}).click();const tree=page.getByRole('region',{name:'Nested project work'});await tree.getByRole('button',{name:'Add root subitem'}).click();await tree.getByLabel('Subitem title').fill('Draft before revocation');fixture.revoked=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(tree.getByRole('alert')).toContainText('Your current branch authority changed');await expect(tree.getByLabel('Subitem title')).toHaveValue('Draft before revocation');await expect(tree.getByRole('button',{name:'Save work changes'})).toBeDisabled();expect(fixture.commands).toHaveLength(0);
});
