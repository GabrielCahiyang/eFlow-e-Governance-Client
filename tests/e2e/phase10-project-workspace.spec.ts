import { test, expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

async function projectAction(page: Page, label: string) {
  await page.getByRole('button',{name:'Project actions',exact:true}).click();
  await page.getByRole('menuitem',{name:label,exact:true}).click();
}

test('project identity, settings retry, favorites and browser history use one project',async({page},info)=>{
  test.setTimeout(120_000);
  const records=await projectWorkspaceFixture(page,'head',true);
  for(const name of ['Main table','Board','Gantt','Calendar','Project Dashboard','Offices']) await expect(page.getByRole('tab',{name,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add project to favorites',exact:true}).click();
  await expect(page.getByRole('complementary',{name:'Projects context'}).getByRole('button',{name:'Remove Community outreach from favorites',exact:true}).first()).toHaveAttribute('aria-pressed','true');
  await page.getByRole('tab',{name:'Board',exact:true}).click();
  await projectAction(page,'Project settings'); const settings=page.getByRole('dialog',{name:'Project settings',exact:true});
  await settings.getByLabel('Description',{exact:true}).fill('Retained metadata revision');
  await page.goBack(); await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(settings.getByLabel('Description')).toHaveValue('Retained metadata revision'); expect(new URL(page.url()).searchParams.get('view')).toBe('board');
  let attempts=0;const patches:unknown[]=[];
  await page.route('**/rest/v1/projects?**',async route=>{
    if(route.request().method()!=='PATCH')return route.fallback(); attempts++;patches.push(route.request().postDataJSON());
    if(attempts===1)return route.fulfill({status:403,json:{message:'Synthetic metadata denial'}});
    Object.assign(records.projects[0],route.request().postDataJSON());return route.fulfill({json:null});
  });
  await settings.getByRole('button',{name:'Save changes',exact:true}).click(); await expect(settings.getByRole('alert')).toContainText('Synthetic metadata denial');
  await expect(settings.getByLabel('Description')).toHaveValue('Retained metadata revision');
  await page.screenshot({path:info.outputPath('project-settings-error-desktop.png')});
  await settings.getByRole('button',{name:'Save changes',exact:true}).click(); await expect(settings.getByRole('status')).toContainText('Project settings saved.');
  expect(attempts).toBe(2);expect(patches[1]).toEqual({description:'Retained metadata revision'});
  await settings.getByRole('contentinfo').getByRole('button',{name:'Close',exact:true}).click(); await expect(page.getByRole('button',{name:'Project actions',exact:true})).toBeFocused();
  await page.goBack(); await expect(page.getByRole('tab',{name:'Main table',exact:true})).toHaveAttribute('aria-selected','true');
  await page.goForward(); await expect(page.getByRole('tab',{name:'Board',exact:true})).toHaveAttribute('aria-selected','true');
  await projectAction(page,'Project settings');await settings.getByLabel('Description').fill('Discarded later revision');await page.goBack();await page.getByRole('button',{name:'Discard',exact:true}).click();await expect(settings).toHaveCount(0);expect(attempts).toBe(2);
  await page.screenshot({path:info.outputPath('project-workspace-desktop.png'),fullPage:true});
});

test('existing lifecycle dialogs retain notes, server denials and deletion impact',async({page})=>{
  test.setTimeout(90_000);const records=await projectWorkspaceFixture(page,'head');
  await page.route('**/rest/v1/rpc/get_project_completion_readiness',route=>route.fulfill({json:{projectId:records.project,title:'Community outreach',status:'planning',canComplete:true,blockers:[]}}));
  let mutations=0;await page.route('**/rest/v1/rpc/complete_project',route=>{mutations++;return route.fulfill({status:403,json:{message:'Synthetic lifecycle denial'}});});
  await projectAction(page,'Mark project complete');const complete=page.getByRole('dialog',{name:'Mark project complete',exact:true});
  await complete.getByLabel('Completion note (optional)').fill('Retained closeout note');await complete.getByRole('button',{name:'Confirm completion',exact:true}).click();await expect(complete.getByRole('alert')).toContainText('Synthetic lifecycle denial');expect(mutations).toBe(1);
  await complete.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(complete.getByLabel('Completion note (optional)')).toHaveValue('Retained closeout note');
  await complete.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();await expect(complete).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Project actions',exact:true})).toBeFocused();
  await projectAction(page,'Delete project');const deletion=page.getByRole('dialog',{name:'Permanently delete project',exact:true});await expect(deletion).toContainText('Existing tasks and audit history remain');
  await deletion.getByLabel('Reason for deletion').fill('Retained reason');await deletion.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(deletion.getByLabel('Reason for deletion')).toHaveValue('Retained reason');
  await deletion.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();expect(mutations).toBe(1);
  await expect(page.getByRole('button',{name:'Project actions',exact:true})).toBeFocused();
});

test('Observer utilities stay read-only and sharing keeps current access requirements at 390px',async({page},info)=>{
  test.setTimeout(90_000);await page.setViewportSize({width:390,height:844});await projectWorkspaceFixture(page,'member',false,{shared:true});
  await expect(page.getByRole('button',{name:'Edit project name',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Project actions',exact:true}).click();await expect(page.getByRole('menuitem',{name:/Delete project|Mark project complete|Archive project/})).toHaveCount(0);
  await page.getByRole('menuitem',{name:'Project settings',exact:true}).click();const settings=page.getByRole('dialog',{name:'Project settings',exact:true});await expect(settings.getByLabel('Project name')).toBeDisabled();await expect(settings.getByRole('button',{name:'Save changes'})).toHaveCount(0);await page.screenshot({path:info.outputPath('project-settings-mobile.png'),animations:'disabled'});await settings.getByRole('contentinfo').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Invite / share',exact:true}).click();const share=page.getByRole('dialog',{name:'Share project',exact:true});await expect(share).toContainText('copying it does not invite anyone or grant permissions');await expect(share.getByLabel('Project link')).toHaveValue(/project=20000000/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:info.outputPath('project-share-mobile.png')});await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Invite / share',exact:true})).toBeFocused();
  await page.screenshot({path:info.outputPath('project-workspace-mobile.png'),fullPage:true});
});

test('participant failure retries its source and long project identity stays within the viewport',async({page},info)=>{
  test.setTimeout(90_000);const records=await projectWorkspaceFixture(page,'head');records.projects[0].title='A very long community project identity with several participating Offices and a detailed public service delivery title';
  let failures=true;let officeReads=0;await page.route('**/rest/v1/project_offices?**',route=>{officeReads++;return failures?route.fulfill({status:403,json:{message:'Participant source unavailable'}}):route.fallback();});
  await page.reload();const error=page.getByRole('alert').filter({hasText:'Project participants unavailable'});await expect(error).toContainText('Participant source unavailable');failures=false;await error.getByRole('button',{name:'Retry',exact:true}).click();await expect(error).toHaveCount(0);expect(officeReads).toBeGreaterThanOrEqual(2);
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('heading',{name:/A very long community/})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:info.outputPath('project-long-title-mobile.png'),fullPage:true});
  await page.goto('/projects?page=Projects&project='+records.project+'&view=work');await expect(page.getByRole('tab',{name:'Main table',exact:true})).toHaveAttribute('aria-selected','true');
  await page.goto('/projects?page=Projects&project='+records.project+'&view=people');await expect(page.getByRole('tab',{name:'Workload & Team',exact:true})).toHaveAttribute('aria-selected','true');
});
