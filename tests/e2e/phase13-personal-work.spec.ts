import { test,expect,type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';
const title='Prepare community assessment';
async function personal(page:Page,destination:'My Work'|'Inbox') {
 // WebKit can report the old desktop layout immediately after a resize.
 // Select the intended surface from the configured viewport, then wait for it.
 const navigation=page.getByRole('navigation',{name:(page.viewportSize()?.width??1280)<1024?'Mobile primary navigation':'Global navigation'});
 await expect(navigation).toBeVisible();
 await navigation.getByRole('button',{name:destination,exact:true}).click();
 await expect(page.getByRole('heading',{name:destination,exact:true,level:1})).toBeVisible();
}
for(const role of ['head','member','accounting_staff'] as const) test(`${role} discovers personal work and keeps legacy task and subtask URLs`,async({page},info)=>{
 const records=await projectWorkspaceFixture(page,role,false,{landingOnly:true});
 await personal(page,'My Work');
 await expect(page.locator('[data-personal-task]')).toHaveCount(2);
 await page.getByRole('button',{name:'Leading',exact:true}).click();await expect(page.locator('[data-personal-task]')).toHaveCount(2);
 await page.getByRole('button',{name:'Recently completed',exact:true}).click();await expect(page.locator('[data-personal-task]')).toHaveCount(1);
 await page.getByRole('button',{name:'All my work',exact:true}).click();await page.getByRole('searchbox',{name:'Search personal work'}).fill('briefing');await expect(page.locator('[data-personal-task]')).toHaveCount(1);
 await page.getByRole('button',{name:'Clear search',exact:true}).click();
 await page.screenshot({path:info.outputPath(`${role}-my-work.png`),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'My subtasks',exact:true}).click();await expect.poll(()=>new URL(page.url()).pathname).toBe('/subtasks');
 await page.goto(role==='head'?'/tasks?page=Task%20Board':'/tasks?page=My%20Tasks');await expect(page.getByRole('heading',{name:role==='head'?'Board':'My Tasks',exact:true})).toBeVisible();
 expect(records.tasks).toHaveLength(3);
});
test('mobile personal inspector retains dirty discussion and returns focus',async({page},info)=>{
 await projectWorkspaceFixture(page,'member',false,{landingOnly:true});await page.setViewportSize({width:390,height:844});await personal(page,'My Work');
 const origin=page.locator('[data-personal-task]').filter({hasText:title});await origin.click();const inspector=page.getByRole('dialog',{name:'Task details: '+title});await inspector.getByRole('tab',{name:'Discussion',exact:true}).click();
 await inspector.getByRole('textbox',{name:'Task discussion comment'}).fill('Personal work draft');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(inspector.getByRole('textbox')).toHaveValue('Personal work draft');
 await page.screenshot({path:info.outputPath('personal-inspector-mobile.png'),fullPage:true,animations:'disabled'});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Discard',exact:true}).click();await expect(origin).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('My Work read failure is retryable and never a clear queue',async({page})=>{
 await projectWorkspaceFixture(page,'member',false,{landingOnly:true});await personal(page,'My Work');let denied=true;
 await page.route('**/rest/v1/tasks?**',route=>denied?route.fulfill({status:403,json:{message:'Personal read interrupted'}}):route.fallback());
 await page.getByRole('button',{name:'Refresh work',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Personal read interrupted');await expect(page.locator('[data-personal-task]')).toHaveCount(0);
 denied=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('[data-personal-task]')).toHaveCount(2);
});
test('Inbox keeps independent task and subtask discovery and exposes partial source denial',async({page},info)=>{
 const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});Object.assign(records.tasks[0],{status:'for_review',reviewer_id:records.id,assigned_to:'00000000-0000-4000-8000-000000000099'});
 let denied=true;await page.route('**/rest/v1/subtask_submissions?**',route=>denied?route.fulfill({status:403,json:{message:'Subtask feed denied'}}):route.fulfill({json:[]}));
 await personal(page,'Inbox');await page.getByRole('button',{name:'Refresh actions',exact:true}).click();await expect(page.locator('[data-action-key]')).toHaveCount(1);await expect(page.getByRole('alert')).toContainText('Subtask feed denied');
 await page.screenshot({path:info.outputPath('inbox-partial-error.png'),fullPage:true,animations:'disabled'});
 await page.locator('[data-action-key]').click();const inspector=page.getByRole('dialog',{name:'Task details: '+title});await expect(inspector.getByRole('tab',{name:'Review',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 denied=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/^Approve/,exact:false})).toHaveCount(0);
});
test('recent Updates verify read writes, retain denied read state and explain missing targets at 390px',async({page},info)=>{
 const records=await projectWorkspaceFixture(page,'member',false,{landingOnly:true});await page.setViewportSize({width:390,height:844});let denied=true,writes=0;
 const updates=[{id:'n1',type:'assignment',title:'Task assigned',message:'Review your personal task',task_id:records.tasks[0].id,read:false,created_at:new Date().toISOString()},{id:'n2',type:'assignment',title:'Deleted task',message:'Older task pointer',task_id:'missing',read:false,created_at:new Date().toISOString()}];
 await page.route('**/rest/v1/notifications?**',async route=>{if(route.request().method()==='PATCH'){writes++;if(denied){await route.fulfill({status:403,json:{message:'Read state denied'}});return;}updates[0].read=true;await route.fulfill({json:[{id:'n1'}]});return;}await route.fulfill({json:updates});});
 await personal(page,'Inbox');await page.getByRole('button',{name:'Updates',exact:true}).click();const feed=page.getByRole('region',{name:'Recent updates'});const first=feed.getByRole('listitem').filter({hasText:'Task assigned'});
 await first.getByRole('button',{name:'Mark read',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Read state denied');await expect(first.getByText('Unread',{exact:true})).toBeVisible();
 denied=false;await first.getByRole('button',{name:'Mark read',exact:true}).click();await expect(first.getByText('Read',{exact:true})).toBeVisible();expect(writes).toBe(2);
 await first.getByRole('button',{name:'Open update',exact:true}).click();await expect(page.getByRole('dialog',{name:'Task details: '+title})).toBeVisible();await page.keyboard.press('Escape');
 await feed.getByRole('listitem').filter({hasText:'Deleted task'}).getByRole('button',{name:'Open update',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Update destination unavailable'})).toContainText('outside your access');
 await page.screenshot({path:info.outputPath('inbox-updates-mobile.png'),fullPage:true,animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Admin Inbox does not acquire task, financial or review authority',async({page},info)=>{
 await projectWorkspaceFixture(page,'admin',false,{landingOnly:true});await personal(page,'Inbox');await expect(page.getByRole('button',{name:'My Work',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Recent updates'})).toBeVisible();await page.getByRole('button',{name:'Needs action',exact:true}).click();await expect(page.getByText('No review queue under your current access',{exact:true})).toBeVisible();await expect(page.locator('[data-action-key]')).toHaveCount(0);await expect(page.getByRole('button',{name:'Open all review queues',exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('admin-inbox.png'),fullPage:true,animations:'disabled'});
});

test('subtask discovery delegates a stable identity and guards review feedback across navigation',async({page},info)=>{
 const records=await projectWorkspaceFixture(page,'member',false,{landingOnly:true});Object.assign(records.subtasks[0],{status:'for_review',reviewer_id:records.id,assigned_to_ids:['00000000-0000-4000-8000-000000000099']});
 const submission={id:'70000000-0000-4000-8000-000000000001',subtask_id:records.subtasks[0].id,task_id:records.tasks[0].id,version:1,submitter_id:'00000000-0000-4000-8000-000000000099',submitter_name:'Contributor',reviewer_id:records.id,note:'Submitted evidence',status:'pending',submitted_at:new Date().toISOString()};
 await page.route('**/rest/v1/subtask_submissions?**',route=>route.fulfill({json:[submission]}));
 await personal(page,'Inbox');await expect(page.locator('[data-action-key]')).toHaveCount(1);await page.locator('[data-action-key]').click();await expect.poll(()=>new URL(page.url()).pathname).toBe('/reviews');await expect(page.getByRole('heading',{name:'Gather supporting evidence',exact:true})).toBeVisible();
 const feedback=page.getByRole('textbox',{name:'Feedback (required when requesting changes)'});await feedback.fill('Correct the evidence');await personalNavigationAttempt(page);
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(feedback).toHaveValue('Correct the evidence');let decisions=0;
 await page.route('**/rest/v1/rpc/decide_subtask_review',route=>{decisions++;return route.fulfill({status:403,json:{message:'Review decision denied'}});});await page.getByRole('button',{name:'Request changes',exact:true}).click();await expect(page.getByText('Review decision denied',{exact:false})).toBeVisible();await expect(feedback).toHaveValue('Correct the evidence');expect(decisions).toBe(1);
 await page.screenshot({path:info.outputPath('delegated-review-draft.png'),fullPage:true,animations:'disabled'});
 await personalNavigationAttempt(page);await page.getByRole('button',{name:'Discard',exact:true}).click();await expect(page.getByRole('heading',{name:'Inbox',exact:true,level:1})).toBeVisible();
});
async function personalNavigationAttempt(page:Page) {await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'Inbox',exact:true}).click();}

test('Inbox update opening respects a revoked navigation grant',async({page},info)=>{
 const records=await projectWorkspaceFixture(page,'member',false,{landingOnly:true,leading:false,overrides:{'navigation.tasks':false,'navigation.reviews':false}});
 await page.route('**/rest/v1/notifications?**',route=>route.fulfill({json:[{id:'restricted',type:'assignment',title:'Task update',message:'An existing task pointer',task_id:records.tasks[0].id,read:false,created_at:new Date().toISOString()}]}));
 await personal(page,'Inbox');await page.getByRole('button',{name:'Updates',exact:true}).click();await page.getByRole('region',{name:'Recent updates'}).getByRole('button',{name:'Open update',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Update destination unavailable'})).toContainText('current access');await expect(page.getByRole('dialog',{name:'Task details: '+title})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('inbox-denied-navigation.png'),fullPage:true,animations:'disabled'});
});
test('Accounting updates retain both personal task and financial destinations',async({page})=>{
 const records=await projectWorkspaceFixture(page,'accounting_staff',false,{landingOnly:true});
 const updates=[{id:'personal',type:'assignment',title:'Personal task assigned',message:'Task work',task_id:records.tasks[0].id,read:false,created_at:new Date().toISOString()},{id:'financial',type:'petty_cash_liquidation',title:'Financial record updated',message:'Accounting record',read:false,created_at:new Date().toISOString()}];
 await page.route('**/rest/v1/notifications?**',route=>route.fulfill({json:updates}));await personal(page,'Inbox');await page.getByRole('button',{name:'Updates',exact:true}).click();const feed=page.getByRole('region',{name:'Recent updates'});await feed.getByRole('listitem').filter({hasText:'Personal task assigned'}).getByRole('button',{name:'Open update'}).click();await expect(page.getByRole('dialog',{name:'Task details: '+title})).toBeVisible();await page.keyboard.press('Escape');await feed.getByRole('listitem').filter({hasText:'Financial record updated'}).getByRole('button',{name:'Open update'}).click();await expect.poll(()=>new URL(page.url()).pathname).toBe('/voucher-cash-releases');
});

test('personal inspector returns to search when its originating row disappears',async({page})=>{
 await projectWorkspaceFixture(page,'member',false,{landingOnly:true});await personal(page,'My Work');const source=page.locator('[data-personal-task]').filter({hasText:title});await source.click();await expect(page.getByRole('dialog',{name:'Task details: '+title})).toBeVisible();await source.evaluate(element=>element.remove());await page.keyboard.press('Escape');await expect(page.getByRole('searchbox',{name:'Search personal work'})).toBeFocused();
});
