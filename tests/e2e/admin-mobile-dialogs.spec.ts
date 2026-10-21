import { expect, test } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test('Admin user management remains usable on a narrow phone',async({page},info)=>{
  test.setTimeout(90_000); await page.setViewportSize({width:320,height:740});
  await projectWorkspaceFixture(page,'admin');
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Navigation',exact:true});
  const destination=drawer.getByRole('button',{name:'All Users',exact:true});
  await expect(destination).toHaveAttribute('aria-current','page');
  await expect(drawer.getByRole('button',{name:'Workspaces',exact:true})).toHaveCount(0);
  const bounds=(await destination.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(320);
  await destination.click(); await page.getByRole('button',{name:'Create LEDIPO User',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Create LEDIPO User',exact:true}); await expect(dialog).toBeVisible();
  const dialogBounds=(await dialog.boundingBox())!;expect(dialogBounds.x).toBeGreaterThanOrEqual(0);expect(dialogBounds.x+dialogBounds.width).toBeLessThanOrEqual(320);
  await expect(dialog.getByPlaceholder('Juan Dela Cruz')).toBeVisible();
  await page.screenshot({path:info.outputPath('admin-mobile-dialog.png')});
  await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
});

test('project PDF import stays inside the workspace on narrow screens',async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width:320,height:740});await projectWorkspaceFixture(page,'head');
 await page.getByRole('button',{name:'Import PDF',exact:true}).click();const panel=page.getByRole('region',{name:'Import PDF into project'});await expect(panel.getByLabel('Import project PDF')).toBeAttached();
 await expect(page.getByRole('dialog',{name:'Create a work plan',exact:true})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('project-pdf-320.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
