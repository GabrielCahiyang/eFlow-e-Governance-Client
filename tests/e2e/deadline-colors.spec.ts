import {test, expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';

test('task deadlines show readable green, yellow and red countdowns on desktop', async ({page}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({width:1440,height:1000});
  await page.clock.setFixedTime(new Date('2026-11-03T12:00:00+08:00'));
  const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
  records.tasks.forEach((task,index)=>Object.assign(task,{status:'todo',deadline:['2026-11-08','2026-11-05','2026-11-02'][index],due_date:['2026-11-08','2026-11-05','2026-11-02'][index]}));
  await page.goto(`/projects?page=Projects&project=${records.project}&view=tasks`);
  const green=page.locator('.pt-date .eflow-deadline[data-tone=green]');
  await expect(green).toHaveText('5 days left',{timeout:45000});
  await expect(page.locator('.pt-date .eflow-deadline[data-tone=yellow]')).toHaveText('2 days left');
  await expect(page.locator('.pt-date .eflow-deadline[data-tone=red]')).toHaveText('1 day overdue');
  await green.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('deadline-colors-desktop.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for (const badge of await page.locator('.pt-date .eflow-deadline').all()) {
    const box=await badge.boundingBox(); expect(box?.height).toBeGreaterThan(10);
  }
});
