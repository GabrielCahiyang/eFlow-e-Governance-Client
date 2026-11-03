import {test,expect} from '@playwright/test';
import {phase16FinancialFixture} from './fixtures/phase16Financial';

for(const role of ['head','accounting_staff'] as const)test(`dated budget releases and Q4 target for ${role} on desktop`,async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});
 const {state}=await phase16FinancialFixture(page,role);
 const account={id:'81000000-0000-4000-8000-000000000001',name:'Community services',amount:50000,heldAmount:15000,position:0,releaseSchedule:[{id:'82000000-0000-4000-8000-000000000001',date:'2026-11-01',amount:10000,status:'pending'},{id:'82000000-0000-4000-8000-000000000002',date:'2026-12-01',amount:5000,status:'pending'}]};
 const writes:string[]=[];
 await page.route('**/rest/v1/rpc/get_office_budget_sections',route=>route.fulfill({json:{sections:[account],version:2,canAdjust:role==='head',releaseScheduleAvailable:true,canConfirmReleases:role==='accounting_staff',itemizedCashAvailable:true,versions:[]}}));
 await page.route('**/rest/v1/rpc/confirm_office_budget_release',route=>{writes.push('confirm');account.heldAmount=5000;account.releaseSchedule[0].status='confirmed';return route.fulfill({json:state.budget});});
 await page.goto(role==='head'?'/office-budget?page=Office+Budget&view=annual&fy=2026':'/office-budget-ledgers?page=Office+Budget+Ledgers&view=annual&fy=2026');
 const calendar=page.getByRole('region',{name:'Office budget release calendar'});
 await expect(calendar).toBeVisible({timeout:45000});await expect(calendar.getByText('November 2026',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(role==='head'){
  await expect(calendar.getByRole('button',{name:'Confirm availability'})).toHaveCount(0);
  await page.getByRole('button',{name:'Readjust budget',exact:true}).click();
  await expect(page.getByLabel('Q4 utilization target (%)',{exact:true})).toBeEnabled();
  await page.getByLabel('Q4 utilization target (%)',{exact:true}).fill('90');
  await page.getByRole('button',{name:'Add another release',exact:true}).click();
  await page.getByLabel('Release 3 date for Community services',{exact:true}).fill('2026-12-15');
  await page.getByLabel('Release 3 amount for Community services',{exact:true}).fill('2500');
  await page.getByLabel('Release 3 date for Community services',{exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('head-dated-releases.jpg'),fullPage:true});
  expect(writes).toEqual([]);
 }else{
  await expect(page.getByLabel('Q4 utilization target (%)',{exact:true})).toBeDisabled();
  await calendar.getByRole('button',{name:'Confirm availability',exact:true}).click();
  const confirmation=page.getByRole('dialog',{name:'Confirm budget availability?',exact:true});
  await expect(confirmation).toBeVisible();expect(writes).toEqual([]);
  await confirmation.getByLabel('Release reference or note',{exact:true}).fill('QA funding notice');
  await page.screenshot({path:info.outputPath('accounting-release-confirmation.jpg'),fullPage:true});
  await confirmation.getByRole('button',{name:'Yes, confirm availability',exact:true}).click();
  await expect(calendar.getByText('Confirmed',{exact:true})).toBeVisible();expect(writes).toEqual(['confirm']);
 }
 await page.setViewportSize({width:1280,height:800});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
