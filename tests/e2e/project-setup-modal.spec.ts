import {test,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:30000});
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {nestedWorkStaffingFixture} from './fixtures/nestedWorkStaffing';
test.setTimeout(120000);
test('project setup is a bounded desktop modal with close and no active-project trigger',async({page},info)=>{
 await page.setViewportSize({width:1920,height:1080});
 const r=await projectWorkspaceFixture(page,'head',false,{compactLayout:true});
 await page.getByRole('button',{name:'Setup & activation',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Project setup',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Plan reviews and activation'})).toBeVisible();
 const title=page.getByRole('heading',{name:'Community outreach',exact:true});
 for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720}]){
  await page.setViewportSize(size);
  const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(size.width);expect(box!.y+box!.height).toBeLessThanOrEqual(size.height);
  await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeVisible();
  expect((await title.boundingBox())!.width).toBeGreaterThan(250);
 }
 await page.screenshot({path:info.outputPath('setup-desktop.png')});
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
