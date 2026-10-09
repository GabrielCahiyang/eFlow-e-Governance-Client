import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

for (const width of [320, 390, 768, 1024, 1440]) test(`R2 persistent sections and workspace controls at ${width}px`, async ({page}, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({width,height:900});
  await projectWorkspaceFixture(page,'head');
  const panel=page.getByRole('region',{name:'Workspace content'});
  const open = async () => { if(width<1024) await page.getByRole('navigation',{name:'Mobile primary navigation'}).getByRole('button',{name:'More',exact:true}).click(); };
  await open();
  await expect(panel.getByRole('button',{name:'Planning Office Workspace',exact:true})).toBeVisible();
  for(const label of ['Home','Search','Planning','Drafts','Waiting for approval','Team Members']) await expect(page.locator('.eflow-productivity-sidebar').getByRole('button',{name:label,exact:true})).toHaveCount(0);
  await expect(panel.getByRole('button',{name:'Office tools',exact:true})).toHaveAttribute('aria-expanded','true');
  await panel.getByRole('button',{name:'Tasks',exact:true}).click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/tasks');
  await open();
  await expect(panel.getByRole('button',{name:'Tasks',exact:true})).toHaveAttribute('aria-current','page');
  await expect(panel.getByRole('button',{name:'Community outreach',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Reports',exact:true}).click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/reports');
  await open();
  await expect(panel.getByRole('button',{name:'Office tools',exact:true})).toHaveAttribute('aria-expanded','true');
  await panel.getByRole('button',{name:'Add Community outreach to favorites',exact:true}).click();
  await panel.getByRole('button',{name:'Add or hide workspace sections',exact:true}).click();
  await page.getByRole('checkbox',{name:'Favorites',exact:true}).uncheck();
  await expect(panel.getByRole('region',{name:'Favorites',exact:true})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'Favorites',exact:true}).check();
  await page.keyboard.press('Escape');
  // Popover dismissal restores focus to its tooltip trigger. Move focus and
  // pointer away before targeting a control underneath the hoverable tooltip.
  await expect(panel.getByRole('button',{name:'Add or hide workspace sections',exact:true})).toBeFocused();
  await page.keyboard.press('Tab');
  await page.mouse.move(width-8,0);
  await expect(page.getByRole('tooltip').filter({hasText:'Show or hide workspace sections'})).toBeHidden();
  await expect(page.locator('[data-testid="tooltip"]').filter({hasText:'Show or hide workspace sections'})).toHaveCount(0);
  expect(await panel.locator('.eflow-workspace-section').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))).toEqual(['Office tools','Projects','Archived projects','Favorites']);
  await expect(panel.getByRole('region',{name:'Favorites',exact:true}).getByRole('button',{name:'Community outreach',exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'Search workspace',exact:true}).click();
  await page.getByRole('textbox',{name:'Search navigation and projects'}).fill('Community outreach');
  await page.getByRole('dialog',{name:'Search available content'}).getByRole('button',{name:'Community outreach Project',exact:true}).click();
  await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
  if(width>=1024) {
    await panel.getByRole('button',{name:'Collapse workspace sidebar'}).click();
    await expect(page.getByRole('navigation',{name:'Global navigation'})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button',{name:'Edit task Prepare community assessment',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Restore workspace sidebar'}).click();
  } else {
    await page.reload();
    await expect(page.getByRole('button',{name:'Edit task Prepare community assessment',exact:true})).toBeVisible();
    await open();
  }
  await expect(panel.getByRole('region',{name:'Favorites',exact:true}).getByRole('button',{name:'Community outreach',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.mouse.move(width-8,0);
  await panel.getByRole('button',{name:'Office tools',exact:true}).focus();
  await expect(page.getByText('Select workspace',{exact:true})).toBeHidden();
  await page.screenshot({path:info.outputPath(`r2-sidebar-${width}.png`),fullPage:true});
});

test('R2 keeps project creation and saved proposal workflows distinct from section adding',async({page})=>{
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page,'head');
  await page.getByRole('button',{name:'Projects and proposals',exact:true}).click();
  for(const label of ['Create project','Create a work plan','Import proposal','Saved work plans','Proposal review']) await expect(page.getByRole('menuitem',{name:label,exact:true})).toBeVisible();
  await page.getByRole('menuitem',{name:'Saved work plans',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Drafts',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Drafts',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Projects and proposals',exact:true}).click();
  await page.getByRole('menuitem',{name:'Proposal review',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Waiting for approval',exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading',{name:'Drafts',exact:true})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading',{name:'Waiting for approval',exact:true})).toBeVisible();
  await expect(page.locator('.eflow-getting-started-banner')).toHaveCount(0);
});
