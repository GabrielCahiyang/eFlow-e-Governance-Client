import { test, expect as baseExpect } from '@playwright/test';
const expect=baseExpect.configure({timeout:20_000});
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test.setTimeout(120_000);
test.use({actionTimeout:20_000});
test('All projects remains an index; repeat creation guides staffing without recreating on reload', async ({page}, info) => {
  const r=await projectWorkspaceFixture(page,'head');
  await page.getByRole('button',{name:'← All projects',exact:true}).click();
  const index=page.getByRole('region',{name:'All projects',exact:true});
  await expect(index).toBeVisible();await expect(index.getByRole('button',{name:'Community outreach',exact:true})).toBeVisible();
  expect(new URL(page.url()).searchParams.has('project')).toBe(false);
  await page.reload();await expect(index).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'+ New',exact:true}).click();
  await page.getByRole('menuitem',{name:'Create project',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Let’s start working together',exact:true});
  await dialog.getByLabel('Project name').fill('Second project');
  await dialog.getByRole('button',{name:'Create project →',exact:true}).click();
  const people=page.getByRole('region',{name:'Add people to project',exact:true});await expect(people).toBeVisible();
  expect(r.projects).toHaveLength(2);const created=new URL(page.url()).searchParams.get('project');expect(created).toBe(r.projects[1].id);
  await people.getByRole('button',{name:'Skip for now',exact:true}).click();
  await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
  await expect(page.getByRole('button',{name:'+ Add people',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();expect(r.projects).toHaveLength(2);
  expect(new URL(page.url()).searchParams.get('project')).toBe(created);
  await page.getByRole('button',{name:'← All projects',exact:true}).click();await expect(index).toBeVisible();
  await page.goBack();await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
  await page.goForward();await expect(index).toBeVisible();
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`all-projects-${width}.png`)});
  }
});

test('Board creates a canonical task in a table group, and task detail returns to its source view',async({page},info)=>{
  const r=await projectWorkspaceFixture(page,'head',true);
  await page.getByRole('tab',{name:'Board',exact:true}).click();
  await page.getByRole('button',{name:'+ Task',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'New task',exact:true});
  await dialog.getByLabel('Task name').fill('Verify public venue');
  await dialog.getByRole('button',{name:'Add task',exact:true}).click();
  await expect(page.locator('.pv-board-card').filter({hasText:'Verify public venue'})).toBeVisible();
  const task=r.tasks.find(task=>task.title==='Verify public venue')!;expect(task.group_id).toBe(r.groups[0].id);expect(task.linked_project_id).toBe(r.project);
  await page.getByRole('tab',{name:'Main table',exact:true}).click();await expect(page.locator('.pt-task-row').filter({hasText:'Verify public venue'})).toBeVisible();
  await page.getByRole('button',{name:'Open Prepare community assessment',exact:true}).click();
  const detail=page.getByRole('region',{name:'Task details: Prepare community assessment'});await expect(detail).toBeVisible();
  expect(await page.getByRole('dialog').count()).toBe(0);
  await expect(page.getByRole('region',{name:'Project main table'})).toBeHidden();
  await page.screenshot({path:info.outputPath('project-task-page.png')});
  await detail.getByRole('button',{name:'Back to project',exact:true}).click();await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
  for(const name of ['Gantt','Calendar','Project Dashboard','Offices']){
    await page.getByRole('tab',{name,exact:true}).click();await expect(page.getByRole('button',{name:'+ Task',exact:true})).toBeVisible();
  }
});

test('Direct Add people uses canonical checked selection and retains its draft after denial',async({page},info)=>{
  const r=await projectWorkspaceFixture(page,'head');
  const member='00000000-0000-4000-8000-000000000002';
  r.projectOffices.push({id:'own',project_id:r.project,office_id:r.org,relationship_type:'lead',invitation_status:'joined'});
  r.profiles.push({...r.profile,id:member,role:'member',full_name:'Office colleague',email:'colleague@example.test'});
  r.profiles.push({...r.profile,id:'foreign',org_id:'other',full_name:'Other office person'});
  r.profiles.push({...r.profile,id:'pending',is_active:false,full_name:'Pending activation'});
  let attempts=0;const requests:Record<string,unknown>[]=[];
  await page.route('**/rest/v1/rpc/r7_select_office_members',async route=>{
    const payload=route.request().postDataJSON();requests.push(payload);attempts++;
    if(attempts===1)return route.fulfill({status:403,json:{message:'Synthetic staffing denied'}});
    r.officeMembers.splice(0,r.officeMembers.length,...payload.p_users.map((id:string)=>({project_office_id:'own',user_id:id})));
    return route.fulfill({json:r.officeMembers});
  });
  await page.reload();await page.getByRole('button',{name:'+ Add people',exact:true}).click();
  const people=page.getByRole('region',{name:'Add people to project',exact:true});await expect(people).toBeVisible();
  await expect(people).not.toContainText('Other office person');await expect(people).not.toContainText('Pending activation');
  await people.getByRole('checkbox',{name:/Office colleague/}).check();
  await people.getByRole('button',{name:'Save project team',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Save project team',exact:true}).click();
  await expect(people.getByRole('alert')).toContainText('Synthetic staffing denied');await expect(people.getByRole('checkbox',{name:/Office colleague/})).toBeChecked();
  await people.getByRole('button',{name:'Save project team',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Save project team',exact:true}).click();
  await expect(people).toHaveCount(0);expect(requests[1]).toEqual(requests[0]);expect(requests[1].p_users).toEqual([member]);expect(r.tasks[0].assigned_to).not.toBe(member);
  await page.getByRole('button',{name:'+ Add people',exact:true}).click();await expect(people.getByRole('checkbox',{name:/Office colleague/})).toBeChecked();
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`add-people-${width}.png`)});}
});

for(const role of ['member','accounting_staff','admin'] as const)test(`${role} keeps project creation and staffing read-only`,async({page})=>{
  const r=await projectWorkspaceFixture(page,role,false,{landingOnly:true});
  await page.goto(`/projects?page=Projects&project=${r.project}&view=board`);
  if(role==='admin')await expect(page.locator('.eflow-app-shell')).toBeVisible();
  else await expect(page.getByRole('tab',{name:'Board',exact:true})).toHaveAttribute('aria-selected','true',{timeout:20_000});
  await expect(page.getByRole('button',{name:'+ Add people',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'+ New',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'+ Task',exact:true})).toHaveCount(0);
});
