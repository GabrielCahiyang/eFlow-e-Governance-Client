import { test, expect, type Page } from '@playwright/test';
import { globalUiP5bFixture } from './fixtures/globalUiP5b';
test.skip(process.env.EFLOW_E2E!=='1','Opt-in local synthetic browser suite');
async function rail(page:Page){const nav=page.getByRole('navigation',{name:'Accounting destinations',exact:true});if((page.viewportSize()?.width||1440)<1024&&!await nav.isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click();await expect(nav).toBeVisible();return nav;}

for(const theme of ['light','dark'] as const)test(`P5b ${theme} Overview hands off to one guarded settlement owner`,async({page})=>{
  const {state}=await globalUiP5bFixture(page,'accounting_staff',theme);await page.goto('/accounting-overview?fy=2026');
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await expect(page.getByRole('region',{name:'Accounting summary'})).toContainText('Pending settlement1');
  await expect(page.getByRole('heading',{name:'Accounting settlement queue'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Settle & post'})).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Accounting destination'})).toBeHidden();
  await expect((await rail(page)).getByRole('button')).toHaveCount(6);
  await page.getByRole('button',{name:'View settlements',exact:true}).click();
  await expect(page).toHaveURL(/page=Settlements/);await expect(page.getByRole('heading',{name:'Accounting settlement queue'})).toHaveCount(1);
  await page.getByRole('button',{name:'Request changes',exact:true}).click();await page.getByLabel('Required liquidation correction',{exact:true}).fill('Retain this evidence review reason');
  await (await rail(page)).getByRole('button',{name:'Accounting Overview',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page.getByLabel('Required liquidation correction',{exact:true})).toHaveValue('Retain this evidence review reason');
  await page.getByRole('button',{name:'Open fiscal year 2027',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page).toHaveURL(/fy=2026/);expect(state.writes).toHaveLength(0);
});

for(const theme of ['light','dark'] as const)test(`P5b ${theme} responsive fallback and embedded Budget preserve one heading and data owner`,async({page},info)=>{
  test.setTimeout(90_000);await globalUiP5bFixture(page,'accounting_staff',theme);
  const reads={budget:0,journal:0};page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/department_budget_summary'))reads.budget++;if(new URL(r.url()).pathname.endsWith('/general_journal_entries'))reads.journal++;});
  await page.goto('/office-budget-ledgers?fy=2026&view=overview');await expect(page.getByRole('region',{name:'Budget position summary',exact:true})).toBeVisible();
  await expect(page.getByRole('main').getByText('Planning Office · FY 2026',{exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await expect(page.getByRole('main').getByRole('heading',{level:1})).toHaveCount(1);expect(reads.budget).toBe(1);
  await page.getByRole('combobox',{name:'Budget view',exact:true}).click();await page.getByRole('option',{name:'General Journal',exact:true}).click();
  await expect(page.getByRole('heading',{name:'No journal entries match',exact:true})).toBeVisible();expect(reads.journal).toBe(1);expect(reads.budget).toBe(1);
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:950});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const fallback=page.getByRole('combobox',{name:'Accounting destination',exact:true});
    if(width<1024){await expect(fallback).toBeVisible();expect(await fallback.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);}else await expect(fallback).toBeHidden();
    await page.screenshot({path:info.outputPath(`budget-${theme}-${width}.png`),animations:'disabled'});
  }
  await page.getByRole('combobox',{name:'Accounting destination',exact:true}).click();await expect(page.getByRole('option')).toHaveCount(6);await page.getByRole('option',{name:'Settlements',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Accounting Settlements',exact:true})).toBeVisible();await expect(page.getByText(/long distinguishing work title/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await (await rail(page)).getByRole('button',{name:'General Journal',exact:true}).click();await expect(page.getByRole('heading',{name:'General Journal',exact:true,level:1})).toBeVisible();
});

test('P5b financial read failure and empty settlement remain distinct',async({page})=>{
  const {state}=await globalUiP5bFixture(page);state.failRead=true;await page.goto('/accounting-overview?fy=2026');
  await expect(page.getByText('The settlement count is unavailable.',{exact:false})).toBeVisible();
  await expect(page.getByRole('region',{name:'Accounting summary'}).getByText('Unavailable',{exact:true})).toHaveCount(4);
  await page.getByRole('button',{name:'View settlements',exact:true}).click();await expect(page.getByRole('heading',{name:'Accounting settlement queue'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Refresh financial records',exact:true})).toBeVisible();
  state.failRead=false;state.liquidations[0].status='approved';await page.getByRole('button',{name:'Refresh financial records',exact:true}).click();
  await expect(page.getByText('0 pending',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Settle & post',exact:true})).toHaveCount(0);expect(state.writes).toHaveLength(0);
});

test('P5b collapsed rail exposes the same six destinations through one compact fallback',async({page})=>{
  await globalUiP5bFixture(page);await page.goto('/accounting-overview?fy=2026');
  await page.getByRole('button',{name:'Collapse accounting sidebar',exact:true}).click();const picker=page.getByRole('combobox',{name:'Accounting destination',exact:true});await expect(picker).toBeVisible();
  await picker.click();await expect(page.getByRole('option')).toHaveCount(6);await page.getByRole('option',{name:'History',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Financial Audit Trail',exact:true,level:1})).toBeVisible();await page.getByRole('button',{name:'Restore accounting sidebar',exact:true}).click();await expect(picker).toBeHidden();
});
