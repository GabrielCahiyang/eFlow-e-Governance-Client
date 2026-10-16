import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';
import { phase16FinancialFixture } from './fixtures/phase16Financial';
import AxeBuilder from '@axe-core/playwright';
test.skip(process.env.EFLOW_E2E!=='1','Opt-in local synthetic browser suite');

test('P6 dark first-run retains its readable controls and original dismissal receipt',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});const fixture=await projectWorkspaceFixture(page,'member',false,{landingOnly:true,theme:'dark'});
  let record={user_id:fixture.id,tour_key:'member-v1',tour_version:1,status:'not_started',current_step:'welcome',state:{completed_steps:['account']}};
  await page.route(/\/controlpanelEflow\/.*\/onboarding\/me(?:\?|$)/,async route=>{if(route.request().method()==='PATCH'){const patch=route.request().postDataJSON();record={...record,...patch,state:{...record.state,...patch}};}await route.fulfill({json:record});});
  await page.goto('/my-work');const welcome=page.getByRole('dialog',{name:/Welcome to eFlow/});await expect(welcome).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(welcome.getByRole('button',{name:'Skip for now',exact:true})).toBeVisible();await expect(welcome.getByRole('button',{name:'Continue',exact:true})).toBeVisible();
  const findings=await new AxeBuilder({page}).include('.eflow-onboarding-dialog').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  await info.attach('dark-first-run-a11y',{body:JSON.stringify(findings.violations),contentType:'application/json'});expect(findings.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  await page.setViewportSize({width:320,height:568});expect(await welcome.getByRole('button').evaluateAll(items=>items.every(e=>e.getBoundingClientRect().height>=44))).toBe(true);
  await welcome.getByRole('button',{name:'Skip for now',exact:true}).click();await expect(welcome).toHaveCount(0);expect(record.status).toBe('dismissed');
  await page.getByRole('button',{name:'Open help',exact:true}).click();await page.getByRole('menuitem',{name:'Getting started',exact:true}).click();await expect(page.getByRole('dialog',{name:'Help & Getting Started',exact:true})).toBeVisible();
});

test('P6 system tour respects the existing financial draft guard before it navigates',async({page})=>{
  const {state}=await phase16FinancialFixture(page);await page.goto('/voucher-cash-releases?page=Settlements&fy=2026');
  await page.getByRole('button',{name:'Request changes',exact:true}).click();await page.getByLabel('Required liquidation correction',{exact:true}).fill('Keep the receipt review reason');
  await page.getByRole('button',{name:'Open help',exact:true}).click();await page.getByRole('menuitem',{name:'Tour of eFlow',exact:true}).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();await expect(page.getByRole('dialog',{name:'Guided walkthrough',exact:true})).toHaveCount(0);
  await page.getByRole('alertdialog').getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByLabel('Required liquidation correction',{exact:true})).toHaveValue('Keep the receipt review reason');expect(state.writes).toHaveLength(0);
  await page.getByRole('button',{name:'Open help',exact:true}).click();await page.getByRole('menuitem',{name:'Tour of eFlow',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Discard',exact:true}).click();
  const tour=page.getByRole('dialog',{name:'Guided walkthrough',exact:true});await expect(tour).toBeVisible();await expect(tour.getByRole('button',{name:'Next',exact:true})).toBeFocused();expect(state.writes).toHaveLength(0);
});

for(const role of ['head','member','accounting_staff','admin'] as const)for(const theme of ['light','dark'] as const)test(`P6 ${role} ${theme} shared Help retains eligible guides and provider focus`,async({page},info)=>{
  test.setTimeout(90_000);await page.emulateMedia({reducedMotion:'reduce'});await projectWorkspaceFixture(page,role,false,{landingOnly:true,theme,leading:true});
  if(role==='admin')await page.goto('/users?page=All+Users');else await page.goto('/my-work');
  const topHelp=page.getByRole('button',{name:'Open help',exact:true});await expect(topHelp).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await expect(page.locator('[data-tour-id="page-walkthrough"], [data-tour-id="system-walkthrough"]')).toHaveCount(0);
  await topHelp.click();await expect(page.getByRole('menuitem')).toHaveCount(role==='admin'?2:3);
  if(role==='admin')await expect(page.getByRole('menuitem',{name:'Getting started',exact:true})).toHaveCount(0);
  else{
    await page.getByRole('menuitem',{name:'Getting started',exact:true}).click();const getting=page.getByRole('dialog',{name:'Help & Getting Started',exact:true});await expect(getting).toBeVisible();
    await expect(getting.getByRole('button',{name:'Review your professional profile',exact:true})).toBeVisible();await getting.getByRole('button',{name:'Close',exact:true}).click();await expect(topHelp).toBeFocused();await topHelp.click();
  }
  await page.getByRole('menuitem',{name:'Guide for this page',exact:true}).click();const tour=page.getByRole('dialog',{name:'Guided walkthrough',exact:true});await expect(tour).toBeVisible();await expect(tour.getByText('Step 1 of 4',{exact:true})).toBeVisible();
  await page.keyboard.press('Tab');expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('[aria-label="Guided walkthrough"]')))).toBe(true);await page.keyboard.press('Shift+Tab');await expect(tour.getByRole('button',{name:'Next',exact:true})).toBeFocused();
  await tour.getByRole('button',{name:'Next',exact:true}).click();await expect(tour.getByText('Step 2 of 4',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(tour).toHaveCount(0);await expect(topHelp).toBeFocused();
  await topHelp.click();await page.getByRole('menuitem',{name:'Tour of eFlow',exact:true}).click();await expect(tour).toBeVisible();await expect(tour.getByRole('heading',{name:'Welcome to eFlow',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(topHelp).toBeFocused();
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:950});await topHelp.click();await expect(page.getByRole('menuitem',{name:'Guide for this page',exact:true})).toBeVisible();
    await expect.poll(()=>page.getByRole('menuitem').evaluateAll(items=>items.length?Math.min(...items.map(e=>e.getBoundingClientRect().height)):0)).toBeGreaterThanOrEqual(width<1024?44:40);
    expect(await page.getByRole('menu').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.evaluate(()=>{const a=document.querySelector('.eflow-topbar__leading')!.getBoundingClientRect(),b=document.querySelector('.eflow-topbar__utilities')!.getBoundingClientRect();return a.right<=b.left+1&&b.right<=innerWidth;}),'Help, communications and Account must all fit beside the brand').toBe(true);
    await page.screenshot({path:info.outputPath(`help-${width}.png`),animations:'disabled'});await page.keyboard.press('Escape');await expect(topHelp).toBeFocused();
  }
  const openNavigation=page.getByRole('button',{name:'Open navigation',exact:true});await openNavigation.click();const drawer=page.getByRole('dialog',{name:'Navigation',exact:true});await drawer.getByRole('button',{name:'Help',exact:true}).click();await expect(drawer).toHaveCount(0);expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('[role="menu"]')))).toBe(true);await page.keyboard.press('Home');await expect(page.getByRole('menuitem',{name:role==='admin'?'Guide for this page':'Getting started',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(openNavigation).toBeFocused();
  await openNavigation.click();await page.getByRole('dialog',{name:'Navigation',exact:true}).getByRole('button',{name:'Help',exact:true}).click();await page.getByRole('menuitem',{name:'Guide for this page',exact:true}).click();await expect(tour).toBeVisible();await page.keyboard.press('Escape');await expect(openNavigation).toBeFocused();
  if(role!=='admin'){
    await page.setViewportSize({width:320,height:568});await topHelp.click();await page.getByRole('menuitem',{name:'Getting started',exact:true}).click();const getting=page.getByRole('dialog',{name:'Help & Getting Started',exact:true});
    expect(await getting.evaluate(e=>{const b=e.getBoundingClientRect();return b.top>=-1&&b.bottom<=innerHeight+1&&getComputedStyle(e).overflowY==='auto';})).toBe(true);
    const profile=getting.getByRole('button',{name:'Review your professional profile',exact:true});await profile.scrollIntoViewIfNeeded();await expect(profile).toBeInViewport();await page.keyboard.press('Escape');await expect(topHelp).toBeFocused();
  }
  await page.setViewportSize({width:320,height:568});await topHelp.click();await page.getByRole('menuitem',{name:'Guide for this page',exact:true}).click();await expect(tour).toBeVisible();
  await expect.poll(()=>page.getByTestId('guided-tour-card').evaluate(e=>{const b=e.getBoundingClientRect();return b.top>=-1&&b.bottom<=innerHeight+1;})).toBe(true);await page.keyboard.press('Escape');await expect(topHelp).toBeFocused();
  await page.setViewportSize({width:1440,height:950});await page.getByRole('button',{name:/Collapse .* sidebar/}).click();const railHelp=page.getByRole('complementary',{name:'Primary navigation'}).getByRole('button',{name:'Help',exact:true});await railHelp.click();await expect(page.getByRole('menuitem',{name:'Tour of eFlow',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(railHelp).toBeFocused();
});
