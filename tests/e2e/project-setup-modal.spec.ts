import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {nestedWorkStaffingFixture} from './fixtures/nestedWorkStaffing';
test.setTimeout(120000);
test('project setup is a bounded desktop modal with close and no active-project trigger',async({page},info)=>{
 await page.setViewportSize({width:1920,height:1080});
 const r=await projectWorkspaceFixture(page,'head',false,{compactLayout:true});
 const confirmed=new Set(['work','office_identity','invitations','responsibilities']);
 const checks=[['structure','Project structure reviewed','Lead Head review is needed for this revision.'],['dates','Project dates confirmed','Lead Head review is needed for this revision.'],['budget','Budget information reviewed','Lead Head review is needed for this revision.'],['schedule','Project schedule is valid','Set both project dates in the Timeline view.'],['staffing','Required task owners assigned','10 tasks need eligible owners selected by their own Office.'],['work','Delivery work exists','10 required tasks'],['office_identity','Office names confirmed','All Office names confirmed'],['invitations','Invitations accepted','Office participation confirmed'],['responsibilities','Responsibilities confirmed','Offices have confirmed their responsibilities']];
 await page.route('**/rest/v1/rpc/phase7_project_readiness',route=>route.fulfill({json:{projectId:r.project,stage:'Planning',governed:false,ready:false,canActivate:false,checks:checks.map(([key,label,detail])=>({key,label,detail,ok:confirmed.has(key)}))}}));
 await page.route('**/rest/v1/rpc/phase7_review_project',route=>{confirmed.add(route.request().postDataJSON().p_kind);return route.fulfill({json:null});});
 await page.getByRole('button',{name:'Setup & activation',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Project setup',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Get your project ready'})).toBeVisible();
 await expect(dialog.getByRole('navigation',{name:'Project setup shortcuts'})).toBeVisible();
 await expect(dialog).toContainText('4 of 9 checks confirmed');
 await expect(dialog.getByRole('region',{name:'Readiness blockers'}).getByRole('listitem')).toHaveCount(5);
 const title=page.getByRole('heading',{name:'Community outreach',exact:true});
 for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}]){
  await page.setViewportSize(size);
  const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(size.width);expect(box!.y+box!.height).toBeLessThanOrEqual(size.height);
  await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Done for now'})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Activate project',exact:true})).toBeVisible();
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  const footer=await dialog.getByRole('button',{name:'Activate project',exact:true}).boundingBox();expect(footer!.y+footer!.height).toBeLessThan(size.height);
  expect((await title.boundingBox())!.width).toBeGreaterThan(250);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:info.outputPath('setup-desktop.png')});
 await dialog.getByRole('button',{name:'Confirm review: Project structure reviewed',exact:true}).click();
 await expect(dialog).toContainText('5 of 9 checks confirmed');
 await dialog.getByText('Confirmed checks (5)',{exact:true}).click();
 await expect(dialog.getByText('Work plan review',{exact:true})).toBeVisible();
 await expect(dialog.getByText('Current plan reviewed.',{exact:true})).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:info.outputPath('setup-desktop-confirmed.png')});
 await dialog.getByRole('button',{name:'Close dialog'}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Setup & activation'}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 r.projects[0].status='active';await page.reload();
 await expect(page.getByRole('button',{name:'Edit project name'})).toBeVisible();await expect(page.getByRole('button',{name:'Setup & activation'})).toHaveCount(0);
});
test('contributor remove controls stay inside their chips',async({page},info)=>{
 await page.setViewportSize({width:1440,height:900});
 const r=await projectWorkspaceFixture(page,'head',false,{compactLayout:true});
 const ids=['00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000033'];
 ids.forEach((id,index)=>{r.profiles.push({...r.profile,id,full_name:['Crisostomo Ibarra','Gabriel Cahiyang','Basilio Santos'][index],role:'member'});r.officeMembers.push({user_id:id,project_office_id:'fixture-office'});});
 Object.assign(r.tasks[0],{assigned_to:r.id,team_member_ids:[r.id,...ids]});
 await nestedWorkStaffingFixture(page,r);await page.reload();
 await page.getByRole('button',{name:'Choose task lead and contributors',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Task lead and contributors'});await expect(dialog).toBeVisible();
 const list=dialog.getByRole('list',{name:'Selected contributors'});await expect(list.getByRole('button',{name:/Remove contributor/})).toHaveCount(3);
 for(const button of await list.getByRole('button').all()){
  const bounds=await button.evaluate(element=>{const outer=element.parentElement!.getBoundingClientRect(),inner=element.getBoundingClientRect();return {inside:inner.top>=outer.top&&inner.bottom<=outer.bottom&&inner.left>=outer.left&&inner.right<=outer.right};});expect(bounds.inside).toBe(true);
 }
 await page.screenshot({path:info.outputPath('contributors-desktop.png')});
 await list.getByRole('button',{name:'Remove contributor Crisostomo Ibarra'}).click();await expect(list.getByRole('button')).toHaveCount(2);
});
