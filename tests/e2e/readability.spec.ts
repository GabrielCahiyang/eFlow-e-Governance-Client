import { expect,test } from '@playwright/test';
for(const width of [1600,1366,768,390]) test(`readable errors and recovery remain usable at ${width}px`,async({page},info)=>{
  test.setTimeout(120000);
  await page.setViewportSize({width,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/tests/e2e/fixtures/readabilityCoverage.html');
  await page.waitForLoadState('networkidle');
  const setup=page.getByRole('region',{name:'Project setup error'});
  await expect(setup).toContainText('Project setup needs attention');
  await expect(setup).toContainText("couldn't confirm the result");
  await page.getByRole('button',{name:'Feature unavailable'}).click();
  await expect(setup).toContainText('administrator');
  await expect(page.locator('body')).not.toContainText('private_project_save');
  await expect(page.locator('body')).not.toContainText('schema cache');
  await page.getByRole('button',{name:'Date rule'}).click();
  await expect(setup).toContainText("A subtask's due date must be on or before its task's due date.");
  const reload=page.getByRole('button',{name:'Reload view'});await reload.focus();await reload.press('Enter');
  await expect(page.getByLabel('Reload attempts')).toHaveText('1');
  await expect(page.getByRole('region',{name:'Loading error'})).toContainText("Couldn't load this view");
  for(const theme of ['light','dark']){
    if(theme==='dark')await page.getByRole('button',{name:'Switch theme'}).click();
    await expect(page.locator('html')).toHaveClass(theme==='dark'?'dark':'');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`readability-${theme}-${width}.png`),fullPage:true});
  }
});
