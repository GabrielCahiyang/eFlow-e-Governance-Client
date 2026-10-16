import { test, expect } from '@playwright/test';
import { globalUiP4Fixture } from './fixtures/globalUiP4';
const views = {overview:'Overview',annual:'Annual Budget',funding:'Proposal & Task Funding',approvals:'Funding Requests',releases:'Releases & Settlement',expenses:'Expenses',vouchers:'Petty Cash Vouchers',journal:'General Journal',audit:'Accounting Trail'};
test.skip(process.env.EFLOW_E2E!=='1','Opt-in synthetic browser suite');

for(const role of ['head','accounting_staff'] as const) test(`P4 ${role} retains all nine Budget links and one local view picker`,async({page})=>{
  await globalUiP4Fixture(page,role);
  const path=role==='head'?'/office-budget':'/office-budget-ledgers';
  for(const [view,label] of Object.entries(views)){
    await page.goto(`${path}?view=${view}&fy=2025`);
    await expect(page.getByRole('combobox',{name:'Budget view',exact:true})).toContainText(label);
    await expect(page.locator('#office-budget-area-list')).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('fy')).toBe('2025');
  }
  const selector=page.getByRole('combobox',{name:'Budget view',exact:true}); await selector.click();
  await expect(page.getByRole('option')).toHaveCount(9); await page.getByRole('option',{name:'Annual Budget',exact:true}).click();
  await page.goBack(); await expect(selector).toContainText('Accounting Trail');
  if(role==='accounting_staff')await expect(page.getByRole('button',{name:/Reclassify/})).toHaveCount(0);
});

test('P4 financial draft keeps view and FY until a guarded switch is accepted',async({page})=>{
  await globalUiP4Fixture(page); await page.goto('/office-budget?view=annual&fy=2026');
  await page.getByRole('button',{name:/Reclassify/}).click();
  await page.getByLabel(/Required adjustment reason/).fill('Keep this adjustment draft');
  await page.getByRole('combobox',{name:'Budget view',exact:true}).click(); await page.getByRole('option',{name:'General Journal',exact:true}).click();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page.getByLabel(/Required adjustment reason/)).toHaveValue('Keep this adjustment draft'); expect(new URL(page.url()).searchParams.get('view')).toBe('annual');
  await page.getByRole('button',{name:'Open fiscal year 2027',exact:true}).click(); await page.getByRole('button',{name:'Keep editing',exact:true}).click(); expect(new URL(page.url()).searchParams.get('fy')).toBe('2026');
  await page.getByRole('combobox',{name:'Budget view',exact:true}).click(); await page.getByRole('option',{name:'General Journal',exact:true}).click(); await page.getByRole('button',{name:'Discard',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Budget view',exact:true})).toContainText('General Journal');
});

test('P4 Office groups and loaded-project search preserve authorized destinations',async({page})=>{
  await globalUiP4Fixture(page); await page.goto('/team-supervision?page=Office+Team');
  const tools=page.getByRole('region',{name:'Office tools',exact:true});
  for(const heading of ['Office','People','Reports'])await expect(tools.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  await expect(tools.getByRole('heading',{name:'Office Team',exact:true})).toHaveCount(0);
  await expect(tools.getByRole('button',{name:'Office tasks',exact:true})).toBeVisible();
  await expect(tools.getByRole('button',{name:'Office Budget',exact:true})).toHaveCount(1);
  await page.getByRole('button',{name:'Workspace options',exact:true}).click(); await expect(page.getByRole('menuitem',{name:'Find pages and projects',exact:true})).toHaveCount(0); await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Find pages and projects',exact:true}).click(); const dialog=page.getByRole('dialog',{name:'Find pages and projects',exact:true});
  await expect(dialog).toContainText('Authorized pages and loaded projects only'); await dialog.getByRole('textbox',{name:'Search navigation and projects'}).fill('Community outreach');
  await dialog.getByRole('button',{name:'Community outreach Project',exact:true}).click();
  expect(new URL(page.url()).searchParams.get('project')).toBe('20000000-0000-4000-8000-000000000001');
});

for(const theme of ['light','dark'] as const) test(`P4 ${theme} Office search, long rows, empty/error and responsive Budget`,async({page},info)=>{
  const fixture=await globalUiP4Fixture(page,'head',theme); await page.goto('/team-supervision?page=Office+Team');
  const team=page.getByRole('region',{name:'Office Team',exact:true}); await expect(team.getByRole('button',{name:/Maria Santos/})).toBeVisible();
  await team.getByRole('textbox',{name:'Search Office Team'}).fill('no matching account'); await expect(team.getByText('No matching results',{exact:true})).toBeVisible(); await team.getByRole('button',{name:'Clear filters',exact:true}).click();
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:950}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`office-team-${theme}-${width}.png`),animations:'disabled'});
  }
  await team.getByRole('tab',{name:/Invitations/}).click(); await expect(team.getByRole('textbox',{name:'Search Office Team'})).toHaveAttribute('placeholder','Search invitation email');
  await page.goto('/office-budget?view=funding&fy=2026'); const selector=page.getByRole('combobox',{name:'Budget view',exact:true}); await expect(selector).toContainText('Proposal & Task Funding');
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:950}); await expect(selector).toBeVisible(); if(width<1024)expect((await selector.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); await selector.click(); await expect(page.getByRole('option')).toHaveCount(9); await page.keyboard.press('Escape');
    await page.screenshot({path:info.outputPath(`budget-${theme}-${width}.png`),animations:'disabled'});
  }
  fixture.state.budgetError=true; await page.goto('/office-budget?view=overview&fy=2026');
  await expect(page.getByRole('alert')).toContainText('Budget data unavailable');
  await expect(page.getByText('No 2026 annual budget yet',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Create annual budget',exact:true})).toHaveCount(0);
  fixture.state.budgetError=false; await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  fixture.state.officeError=true; await page.goto('/team-supervision?page=Office+Team'); await expect(team.getByRole('alert')).toContainText('Synthetic Office read denied');
  await expect(team.getByText('No active Office members',{exact:true})).toHaveCount(0);
});

test('P4 no-budget and empty Office states retain their authorized actions',async({page})=>{
  await globalUiP4Fixture(page,'head','light',true); await page.goto('/office-budget?view=overview&fy=2026');
  await expect(page.getByText('No 2026 annual budget yet',{exact:true})).toBeVisible(); await expect(page.getByRole('button',{name:'Create annual budget',exact:true})).toBeVisible();
  await page.goto('/team-supervision?page=Office+Team'); await expect(page.getByText('No active Office members',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Invite Member',exact:true})).toHaveCount(2);
});

test('P4 mobile drawer hands keyboard focus to search and returns to navigation',async({page})=>{
  await page.setViewportSize({width:320,height:950}); await globalUiP4Fixture(page);
  await page.goto('/office-budget?view=overview&fy=2026');
  const opener=page.getByRole('button',{name:'Open navigation',exact:true}); await opener.click();
  await page.getByRole('button',{name:'Find pages and projects',exact:true}).click();
  const search=page.getByRole('textbox',{name:'Search navigation and projects',exact:true});
  await expect(search).toBeFocused(); await search.fill('Community outreach');
  await expect(page.getByRole('button',{name:'Community outreach Project',exact:true})).toBeVisible();
  await search.press('Escape'); await expect(search).toHaveCount(0); await expect(opener).toBeFocused();
});
