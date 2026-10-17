import {expect,test} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
test.use({timezoneId:'Asia/Manila'});

test('a Head replaces the previous Admin route with a useful office dashboard',async({page},info)=>{
  test.setTimeout(120_000);
  await page.clock.setSystemTime(new Date('2026-10-17T04:00:00Z'));
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem('previous-admin-scenario')){
      sessionStorage.setItem('previous-admin-scenario','1');
      history.replaceState({eflowActorId:'previous-admin',eflowActorRole:'admin'},'', '/users?page=All+Users');
    }
  });
  const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
  const dashboard=page.getByRole('region',{name:'Head dashboard'});
  await expect(page.getByRole('heading',{name:'Office dashboard',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/overview\?/);
  await expect(page.getByText('Access denied',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Workspace destinations'}).getByRole('button',{name:'Open projects',exact:true})).toHaveCount(0);
  await expect(dashboard.locator('.head-home__metric').filter({hasText:'Open tasks'}).locator('strong')).toHaveText('2');
  await expect(dashboard.getByRole('region',{name:'Project progress'})).toContainText('1 of 3 tasks completed');
  await expect(dashboard.getByRole('region',{name:'Project progress'})).toContainText('33%');
  await expect(dashboard.getByRole('region',{name:'Tasks needing attention'}).getByRole('button',{name:/Prepare community assessment/})).toBeVisible();
  await page.screenshot({path:info.outputPath('head-dashboard-desktop.png')});
  await page.evaluate(()=>history.replaceState({},'', '/users?page=All+Users'));
  await page.reload();
  await expect(page.getByRole('heading',{name:'Office dashboard',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/overview\?/);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await dashboard.getByRole('heading',{name:'Office dashboard'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('head-dashboard-phone.png'),fullPage:true});
  const projectButton=dashboard.getByRole('region',{name:'Project progress'}).getByRole('button',{name:/Community outreach/});
  await projectButton.click();await expect(page).toHaveURL(new RegExp(`project=${records.project}`));
});

test('logout clears the prior account URL before a Head signs in',async({page})=>{
  test.setTimeout(120_000);
  await projectWorkspaceFixture(page,'admin',false,{landingOnly:true});
  await page.getByRole('button',{name:'Open account menu'}).click();
  await page.getByRole('menuitem',{name:'Log out',exact:true}).click();
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
  await expect(page.getByText('Loading view…',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Office dashboard'})).toBeVisible();
});

test('a deferred view shows the brand and skeleton instead of Loading view text',async({page},info)=>{
  test.setTimeout(120_000);
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const assets=join(process.cwd(),'dist','assets');
  const chunk=existsSync(assets)?readdirSync(assets).find(name=>name.endsWith('.js')&&readFileSync(join(assets,name),'utf8').includes('Office dashboard')):undefined;
  await page.route(url=>url.pathname==='/src/app/features/personal-work/components/WorkspaceOverview.tsx'||!!chunk&&url.pathname===`/assets/${chunk}`,async route=>{await gate;await route.continue();});
  try{
    await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
    const loader=page.locator('.eflow-view-loading').first();
    await expect(loader).toBeVisible();
    await expect(loader.getByRole('img',{name:'eFlow',exact:true})).toBeVisible();
    await expect(loader.locator('.eflow-view-loading__cards>div')).toHaveCount(4);
    await expect(page.getByText('Loading view…',{exact:true})).toHaveCount(0);
    await page.screenshot({path:info.outputPath('workspace-skeleton.png')});
    release();
    await expect(page.getByRole('heading',{name:'Office dashboard'})).toBeVisible();
  }finally{release();}
});
