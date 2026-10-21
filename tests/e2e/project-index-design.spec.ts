import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test('project index keeps long names readable and last-row actions usable', async ({page}, info) => {
  test.setTimeout(150000);
  await page.setViewportSize({width:1920,height:1080});
  const r=await projectWorkspaceFixture(page,'head');
  const title='Settings acceptance — a project with a long name that must stay readable';
  const description='Coordinate office activities, prepare the detailed work plan, and track project delivery with the selected team.';
  r.projects.push({...r.projects[0],id:'10000000-0000-4000-8000-000000000002',title,description,updated_at:new Date(Date.now()-1000).toISOString()});
  r.projects.push({...r.projects[0],id:'10000000-0000-4000-8000-000000000003',title:'Completed coordination project',status:'completed',description:'Final outputs reviewed and accepted.',updated_at:new Date(Date.now()-2000).toISOString()});
  await page.reload();
  await page.getByRole('button',{name:'← All projects',exact:true}).click();
  const index=page.getByRole('region',{name:'All projects',exact:true});
  const row=index.getByRole('row').filter({has:page.getByRole('button',{name:title,exact:true})});
  await expect(row).toBeVisible();
  await page.screenshot({path:info.outputPath('all-projects-desktop.png'),fullPage:true});
  const dimensions=await row.evaluate(el=>{
    const title=el.querySelector('.eflow-project-row-title')!, desc=el.querySelector('.eflow-project-row-description')!;
    const row=el.getBoundingClientRect(), t=title.getBoundingClientRect(), d=desc.getBoundingClientRect();
    return {height:row.height,readable:t.top>=row.top&&d.bottom<=row.bottom&&d.top>=t.bottom,titleFits:title.scrollHeight<=title.clientHeight};
  });
  expect(dimensions.height).toBeGreaterThanOrEqual(92);
  expect(dimensions.readable).toBe(true);expect(dimensions.titleFits).toBe(true);
  await expect(row.getByText(description,{exact:true})).toBeVisible();
  await expect(index.getByRole('progressbar',{name:'Community outreach progress'})).toHaveAttribute('aria-valuenow','33');
  const last=index.getByRole('row').filter({has:page.getByRole('button',{name:'Completed coordination project',exact:true})});
  await last.getByRole('button',{name:'More actions for Completed coordination project'}).click();
  const action=page.getByRole('menuitem',{name:'Open project workspace',exact:true});
  await expect(action).toBeVisible();
  const box=await action.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(1080);
  await page.keyboard.press('Escape');
  await last.getByRole('button',{name:'More actions for Completed coordination project'}).focus();
  await page.keyboard.press('Enter');await expect(action).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(last.getByRole('button',{name:'More actions for Completed coordination project'})).toBeFocused();
  await page.screenshot({path:info.outputPath('all-projects-desktop.png'),fullPage:true});
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(row.getByRole('button',{name:title,exact:true})).toBeVisible();
  }
  await page.setViewportSize({width:1920,height:1080});
  await index.getByLabel('Search projects').fill('long name');
  await expect(index.getByRole('status').filter({hasText:'1 of 3 projects'})).toBeVisible();
  await index.getByRole('button',{name:'Clear filters',exact:true}).click();
  await index.getByRole('button',{name:'More actions for Community outreach',exact:true}).click();
  await page.getByRole('menuitem',{name:'Open project workspace',exact:true}).click();
  await expect(page.getByRole('region',{name:'Project main table',exact:true})).toBeVisible();
});
