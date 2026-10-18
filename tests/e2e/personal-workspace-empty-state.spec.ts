import { test, expect } from '@playwright/test';
import { personalWorkspaceFixture } from './fixtures/personalWorkspace';

for (const width of [375, 1918]) test(`personal workspace centers empty and unselected states without timezone at ${width}px`, async ({page}, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({width,height:914});
  const fixture=await personalWorkspaceFixture(page,{seed:true});
  const project=fixture.personalProjects[0];
  fixture.personalProjects.length=0;
  await page.goto(`/projects?workspace=${fixture.personalId}`);
  const workspace=page.locator('.r3-personal-workspace');
  await expect(workspace.getByText('No personal projects yet.',{exact:true})).toBeVisible();
  await expect(workspace.locator('.eflow-workspace-header').first()).toContainText('Personal workspace · Owner: Alex Rivera');
  await expect(workspace).not.toContainText('Asia/Singapore');
  const empty=workspace.locator('.eflow-illustrated-empty');
  async function centered() {
    return empty.evaluate(element=>{
      const r=element.getBoundingClientRect();
      const children=Array.from(element.children).map(child=>child.getBoundingClientRect());
      const center=(Math.min(...children.map(c=>c.top))+Math.max(...children.map(c=>c.bottom)))/2;
      const shell=element.closest('.eflow-app-shell__workspace')!.getBoundingClientRect();
      return Math.abs(center-(r.top+r.bottom)/2)<3 && Math.abs(shell.bottom-r.bottom)<45;
    });
  }
  await expect.poll(centered).toBe(true);
  await expect.poll(()=>empty.locator('img').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`personal-empty-${width}.png`),fullPage:true});
  fixture.personalProjects.push(project);
  await page.reload();
  await expect(workspace.getByText('Select a personal project to view its work and members.',{exact:true})).toBeVisible();
  await expect.poll(centered).toBe(true);
  await workspace.getByRole('button',{name:'Create personal project',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Create personal project'})).toBeVisible();
  await expect(page.getByLabel('Workspace timezone')).toHaveCount(0);
});
