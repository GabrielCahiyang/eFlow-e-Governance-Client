import { test, expect, type Page } from '@playwright/test';
import { globalUiP5aFixture } from './fixtures/globalUiP5a';
test.skip(process.env.EFLOW_E2E!=='1','Opt-in local synthetic browser suite');
const pages=['All Users','Locked out accounts','Role Defaults','User Access','Office Structure','Account Audit','System Settings','Workspace Policy','Email & Integrations','Runtime / AI Health','Backup & Export'];
const headings:Record<string,string>={'Workspace Policy':'Workspaces & project access policy','Email & Integrations':'Email & integrations','Runtime / AI Health':'Runtime / AI health'};
async function nav(page:Page){const region=page.getByRole('navigation',{name:'Admin Center destinations',exact:true});if((page.viewportSize()?.width||1440)<1024&&!await region.isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(region).toBeVisible();return region;}

for(const theme of ['light','dark'] as const)test(`P5a ${theme} has eleven leaves, one selector and one selected tool`,async({page})=>{
  test.setTimeout(90_000);await globalUiP5aFixture(page,'admin',theme);await page.goto('/users?page=All+Users');
  const rail=await nav(page);await expect(rail.getByRole('button')).toHaveCount(11);
  await expect(rail).toHaveAttribute('data-tour-section','users');
  await expect(rail.locator('[data-tour-section="users"]')).toHaveCount(0);
  for(const name of ['People','Offices','Access','Configuration','Audit','Data'])await expect(rail.getByRole('heading',{name,exact:true})).toBeVisible();
  for(const name of pages){
    await (await nav(page)).getByRole('button',{name,exact:true}).click();
    await expect(page.getByRole('heading',{name:headings[name]||name,exact:true,level:1})).toBeVisible();
    await expect(page.getByRole('main').getByRole('heading',{level:1})).toHaveCount(1);
    await expect(page.getByRole('tablist',{name:'Administration tools',exact:true})).toHaveCount(0);
    await expect(page.getByRole('group',{name:'People views',exact:true})).toHaveCount(0);
    await expect((await nav(page)).getByRole('button',{name,exact:true})).toHaveAttribute('aria-current','page');
  }
});

for(const role of ['head','member','accounting_staff'] as const)test(`P5a ${role} single configuration grant retains four tools and no Admin-only leaves`,async({page})=>{
  await globalUiP5aFixture(page,role,'light',false,{'navigation.system_settings':true});await page.goto('/system-settings?page=System+Settings');
  const rail=await nav(page);await expect(rail.getByRole('button')).toHaveCount(4);
  for(const name of ['System Settings','Workspace Policy','Email & Integrations','Runtime / AI Health']){
    await (await nav(page)).getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name:headings[name]||name,exact:true,level:1})).toBeVisible();
  }
  for(const name of ['Locked out accounts','Role Defaults','User Access','All Users'])await expect(rail.getByRole('button',{name,exact:true})).toHaveCount(0);
  await page.goto('/users?page=User+Access');await expect(page.getByRole('heading',{name:'Access denied',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Set exception',exact:true})).toHaveCount(0);
});

for(const theme of ['light','dark'] as const)test(`P5a ${theme} responsive long accounts, matrix and empty/unavailable states`,async({page},info)=>{
  test.setTimeout(90_000);const fixture=await globalUiP5aFixture(page,'admin',theme);await page.goto('/users?page=User+Access');
  await page.getByRole('button',{name:/Maria Santos with a long distinguishing/}).click();
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByRole('heading',{name:/Maria Santos with a long distinguishing/,level:2})).toBeVisible();
    await page.screenshot({path:info.outputPath(`access-${theme}-${width}.png`),animations:'disabled'});
  }
  await page.getByRole('textbox',{name:'Search account access',exact:true}).fill('no matching account');await expect(page.getByText('No active users match this search.',{exact:true})).toBeVisible();
  await (await nav(page)).getByRole('button',{name:'Role Defaults',exact:true}).click();
  await expect(page.getByRole('button',{name:'Admin: Allowed',exact:true})).toHaveCount(9);
  for(const control of await page.getByRole('button',{name:'Admin: Allowed',exact:true}).all())await expect(control).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await (await nav(page)).getByRole('button',{name:'Account Audit',exact:true}).click();await expect(page.getByText('No permitted administrative events.',{exact:true})).toBeVisible();
  fixture.state.unavailable=true;await page.getByRole('button',{name:'Refresh audit',exact:true}).click();await expect(page.getByRole('alert')).toContainText('could not be read');
  await (await nav(page)).getByRole('button',{name:'Backup & Export',exact:true}).click();await expect(page.getByRole('heading',{name:'Backup gateway route unavailable',exact:true})).toBeVisible();
  await expect(page.getByText('One-time server setup required',{exact:true})).toHaveCount(0);
  fixture.state.unavailable=false;await page.getByRole('button',{name:'Check connection again',exact:true}).click();await expect(page.getByText('One-time server setup required',{exact:true})).toBeVisible();
  expect(fixture.state.writes).toEqual([]);
});

test('P5a account selection stays independent of the filtered directory return target',async({page})=>{
  await globalUiP5aFixture(page);await page.goto('/users?page=All+Users');
  const search=page.getByRole('searchbox',{name:'Search by name, email, role, or organization…',exact:true});await search.fill('Maria');
  const source=page.getByRole('row').filter({hasText:'maria.planning.and.coordination@example.test'}).getByRole('button',{name:'Access',exact:true});await source.click();
  await page.getByRole('button',{name:/Ari another authorized account/}).click();await expect(page.getByRole('heading',{name:'Ari another authorized account',exact:true,level:2})).toBeVisible();
  await page.getByRole('button',{name:'Back to accounts',exact:true}).click();await expect(search).toHaveValue('Maria');await expect(source).toBeFocused();
  expect(await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('eflow:context:')).some(([,value])=>value.includes('ari@example.test')||value.includes('maria.planning.and.coordination@example.test')))).toBe(false);
});
