import { test, expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';
async function view(page: Page, name: string) {
 const tab = page.getByRole('tab', { name, exact: true });
 if (await tab.count()) await tab.click();
 else { await page.getByRole('button', {name: 'Add view', exact: true}).click(); await page.getByRole('button', {name: new RegExp('^'+name+'\\b')}).last().click(); }
}
const title = 'Prepare community assessment';
test('shared inspector keeps discussion drafts and returns focus to each view origin', async ({page}, info) => {
 test.setTimeout(120000);
 await page.setViewportSize({width: 1440,height:1000}); await projectWorkspaceFixture(page,'head',true);
 for (const name of ['Board','Gantt','Calendar','Project Dashboard','Offices']) {
  await view(page,name);
  if (name==='Offices') await page.locator('.pv-office-row summary').click();
  const trigger = name==='Board' ? page.locator('.eflow-figma-task-card').filter({hasText:title}).first() : name==='Gantt' ? page.getByRole('button',{name:'Gantt task '+title,exact:true}) : name==='Calendar' ? page.locator('.fc-daygrid-event').filter({hasText:title}).first() : name==='Project Dashboard' ? page.locator('.pv-deadline-list button').filter({hasText:title}).first() : page.locator('.pv-office-row details button').filter({hasText:title});
  await trigger.focus(); await trigger.click();
  const inspector = page.getByRole('dialog',{name:'Task details: '+title}); await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('tab',{name:'Files',exact:true})).toBeVisible();
  await inspector.getByRole('button',{name:'Details',exact:true}).click();
  await expect(inspector.getByLabel('Task team and subtasks')).toBeVisible();
  await inspector.getByRole('tab',{name:'Updates',exact:true}).click();
  await inspector.getByRole('textbox',{name:'Task discussion comment'}).fill('Unsaved discussion from '+name);
  await inspector.getByRole('button',{name:'Close task detail'}).click();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(inspector.getByRole('textbox',{name:'Task discussion comment'})).toHaveValue('Unsaved discussion from '+name);
  await inspector.getByRole('button',{name:'Close task detail'}).click();
  await page.getByRole('button',{name:'Discard',exact:true}).click(); await expect(inspector).not.toBeVisible();
  await expect(trigger).toBeFocused();
 }
 await page.screenshot({path:info.outputPath('office-origin.png'),fullPage:true,animations:'disabled'});
});
test('date range is consistent across views and personal after reload',async({page})=>{
 test.setTimeout(90000); await projectWorkspaceFixture(page,'head',true);
 await page.getByLabel('Filter date from',{exact:true}).fill('2026-10-10');
 await page.getByLabel('Filter date to',{exact:true}).fill('2026-10-12');
 await expect(page.locator('.pt-task-row')).toHaveCount(1);
 await view(page,'Board'); await expect(page.locator('.pv-board-card')).toHaveCount(1);
 await view(page,'Gantt'); await expect(page.locator('.pv-gantt-bar-title')).toHaveCount(1);
 await view(page,'Project Dashboard'); await expect(page.locator('.pv-stat-strip')).toContainText('All tasks1');
 await page.reload(); await expect(page.getByLabel('Filter date from',{exact:true})).toHaveValue('2026-10-10');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect(page.getByLabel('Filter date from',{exact:true})).toHaveValue('');
});
test('mobile observer inspector stays read only and traps and returns focus',async({page},info)=>{
 test.setTimeout(90000); await projectWorkspaceFixture(page,'member',true,{shared:true}); await page.setViewportSize({width:390,height:844});
 await view(page,'Board');
 const trigger=page.locator('.eflow-figma-task-card').filter({hasText:title}).first(); await trigger.focus(); await trigger.press('Enter');
 const inspector=page.getByRole('dialog',{name:'Task details: '+title}); await expect(inspector).toBeVisible();
 await expect(inspector.getByText('Read-only oversight record')).toBeVisible();
 await inspector.getByRole('tab',{name:'Updates',exact:true}).click(); await expect(inspector.getByRole('textbox')).toHaveCount(0);
 await inspector.getByRole('tab',{name:'Files',exact:true}).click();
 await page.screenshot({path:info.outputPath('inspector-mobile.png'),fullPage:true,animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.keyboard.press('Escape'); await expect(inspector).not.toBeVisible(); await expect(trigger).toBeFocused();
});

test('Board keyboard action prevents duplicate requests and recovers from denial',async({page})=>{
 const records=await projectWorkspaceFixture(page,'member',true);await view(page,'Board');
 let calls=0, denied=true;
 await page.route('**/rpc/transition_task_status',async route=>{calls++;if(denied)await route.fulfill({status:403,json:{message:'Board move denied',code:'42501'}});else await route.fallback();});
 const start=page.getByRole('button',{name:'Start Coordinate Office briefing',exact:true});
 await start.evaluate(element=>{(element as HTMLButtonElement).click();(element as HTMLButtonElement).click();});
 await expect(page.getByRole('alert')).toContainText('Board move denied');expect(calls).toBe(1);expect(records.tasks[1].status).toBe('todo');
 denied=false;await start.press('Enter');await expect(page.getByRole('region',{name:'IN PROGRESS lane',exact:true})).toContainText('Coordinate Office briefing');expect(calls).toBe(2);
});
test('shared Task Lead team mutations stay gated by G2 while details remain available',async({page},info)=>{
 const records=await projectWorkspaceFixture(page,'member',true,{shared:true});
 records.projectOffices[0].relationship_type='collaborating'; records.officeMembers.push({project_office_id:records.projectOffices[0].id,user_id:records.id});
 await page.reload();await view(page,'Board');await page.locator('.eflow-figma-task-card').filter({hasText:title}).first().click();
 const inspector=page.getByRole('dialog',{name:'Task details: '+title});await expect(inspector).toContainText('only the responsible Office Head can change the task team');
 await expect(inspector.getByRole('button',{name:'Manage',exact:true})).toHaveCount(0);await expect(inspector.getByText('Read-only oversight record')).toHaveCount(0);
 await page.screenshot({path:info.outputPath('shared-lead-gate.png'),fullPage:true,animations:'disabled'});
});
test('review drafts stay protected and evidence loading denial has an explicit retry',async({page})=>{
 const records=await projectWorkspaceFixture(page,'head',true);Object.assign(records.tasks[0],{status:'for_review',reviewer_id:records.id});
 await page.reload();await view(page,'Board');await page.locator('.eflow-figma-task-card').filter({hasText:title}).first().click();
 const inspector=page.getByRole('dialog',{name:'Task details: '+title});await inspector.getByRole('button',{name:'Review submission',exact:true}).click();
 await inspector.getByRole('button',{name:'Request changes',exact:true}).click();await inspector.getByRole('textbox').fill('Review draft retained');
 await inspector.getByRole('tab',{name:'Files',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(inspector.getByRole('textbox')).toHaveValue('Review draft retained');
 await inspector.getByRole('tab',{name:'Files',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();
 await inspector.getByRole('button',{name:'Close task detail'}).click();
 await page.route('**/rest/v1/task_submissions?**',route=>route.fulfill({status:403,json:{message:'Evidence denied',code:'42501'}}));
 await page.locator('.eflow-figma-task-card').filter({hasText:title}).first().click();await inspector.getByRole('tab',{name:'Files',exact:true}).click();
 await expect(inspector.getByRole('alert')).toContainText('Evidence denied');await page.unroute('**/rest/v1/task_submissions?**');await inspector.getByRole('button',{name:'Retry workflow files'}).click();await expect(inspector.getByRole('alert')).toHaveCount(0);
});

test('removed canonical task closes mutation controls and explains unavailable access',async({page})=>{
 const records=await projectWorkspaceFixture(page,'head',true,{taskChanges:true});await view(page,'Board');await page.locator('.eflow-figma-task-card').filter({hasText:title}).first().click();
 await expect(page.getByRole('dialog',{name:'Task details: '+title})).toBeVisible();records.tasks.splice(0,1);
 records.emitTaskDelete('40000000-0000-4000-8000-000000000001');
 // R9 protected feeds revalidate on focus rather than retaining task subscriptions.
 await page.evaluate(() => window.dispatchEvent(new Event('focus')));
 const unavailable=page.getByRole('dialog',{name:'Task unavailable',exact:true});await expect(unavailable).toBeVisible();await expect(unavailable).toContainText('removed or your access changed');
 await expect(page.getByRole('button',{name:'Start work',exact:true})).toHaveCount(0);await unavailable.getByRole('button',{name:'Close task details',exact:true}).click();await expect(unavailable).not.toBeVisible();
});

test('successful inspector lifecycle change returns focus to the refreshed Board card',async({page})=>{
 await projectWorkspaceFixture(page,'member',true);await view(page,'Board');const name='Coordinate Office briefing';
 const trigger=page.locator('.eflow-figma-task-card').filter({hasText:name}).first();await trigger.focus();await trigger.click();
 const inspector=page.getByRole('dialog',{name:'Task details: '+name});await inspector.getByRole('button',{name:'Start work',exact:true}).click();await expect(inspector).not.toBeVisible();
 const moved=page.getByRole('region',{name:'IN PROGRESS lane',exact:true}).locator('.eflow-figma-task-card').filter({hasText:name});await expect(moved).toBeFocused();
});

test('mobile team dialog guards drafts and retains a denied member change',async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width:390,height:844});const records=await projectWorkspaceFixture(page,'head',true);
 records.profiles.push({...records.profile,id:'00000000-0000-4000-8000-000000000088',role:'member',full_name:'Sam Contributor'});
 await page.reload();await view(page,'Board');await page.locator('.eflow-figma-task-card').filter({hasText:title}).first().click();
 const inspector=page.getByRole('dialog',{name:'Task details: '+title});await inspector.getByRole('button',{name:'Details',exact:true}).click();await inspector.getByRole('button',{name:'Manage',exact:true}).click();
 const team=page.getByRole('dialog',{name:'Manage members',exact:true});await team.getByRole('button',{name:/Sam Contributor/}).click();
 await team.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(team).toBeVisible();
 await page.route('**/rpc/assign_task_with_details',route=>route.fulfill({status:403,json:{message:'Task team access denied',code:'42501'}}));
 await team.getByRole('button',{name:'Save members',exact:true}).click();const confirmation=page.getByRole('alertdialog');await expect(confirmation).toContainText('1 added');await confirmation.getByRole('button',{name:'Save members',exact:true}).click();
 await expect(team).toContainText('Task team access denied');expect(records.tasks[0].team_member_ids).toEqual([records.id]);
 await page.screenshot({path:info.outputPath('team-mobile-denial.png'),fullPage:true,animations:'disabled'});
 await team.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();await expect(team).not.toBeVisible();await expect(inspector.getByRole('button',{name:'Manage',exact:true})).toBeFocused();
});
