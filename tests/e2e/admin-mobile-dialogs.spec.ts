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
  await destination.click(); await page.getByRole('button',{name:'Create user',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Create New User',exact:true}); await expect(dialog).toBeVisible();
  const dialogBounds=(await dialog.boundingBox())!;expect(dialogBounds.x).toBeGreaterThanOrEqual(0);expect(dialogBounds.x+dialogBounds.width).toBeLessThanOrEqual(320);
  await expect(dialog.getByPlaceholder('Juan Dela Cruz')).toBeVisible();
  await page.screenshot({path:info.outputPath('admin-mobile-dialog.png')});
  await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
});

test('workspace proposal import and existing manual planning remain reachable in the phone drawer',async({page},info)=>{
  test.setTimeout(90_000);await page.setViewportSize({width:320,height:740});
  await projectWorkspaceFixture(page,'head');
  await page.getByRole('navigation',{name:'Mobile primary navigation'}).getByRole('button',{name:'More',exact:true}).click();
  await page.getByRole('dialog',{name:'Navigation',exact:true}).getByRole('button',{name:'Add to workspace',exact:true}).click();
  await page.getByRole('menuitem',{name:'Import proposal',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Create a work plan',exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Drop a government proposal PDF here',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'New work plan',exact:true}).click();
  const input=dialog.getByPlaceholder(/2026 Coastal/i);await expect(input).toBeVisible(); expect((await input.boundingBox())!.width).toBeGreaterThan(150);
  await page.screenshot({path:info.outputPath('planning-mobile-dialog.png')});
  await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
