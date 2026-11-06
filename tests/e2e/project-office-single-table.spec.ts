import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test('Project Offices retains one table and one Lead Office through automatic updates', async ({ page }) => {
  test.setTimeout(180_000);
  const duplicateKeys: string[] = [];
  page.on('console', message => {
    if (message.text().includes('same key')) duplicateKeys.push(message.text());
  });
  const r = await projectWorkspaceFixture(page, 'head');
  r.projectOffices.push({ id:'lead',project_id:r.project,office_id:r.org,relationship_type:'lead',invitation_status:'joined' });
  await page.goto('/projects?page=Projects&project=' + r.project + '&view=offices');
  const panel = page.getByRole('region', {name:'Project Office collaboration'});
  await expect(panel).toBeVisible({timeout:30_000});
  await expect(panel.getByRole('table')).toHaveCount(1,{timeout:30_000});
  const filter=panel.getByRole('textbox',{name:'Search project Offices'});
  await filter.fill('Planning');
  for (let i=0;i<4;i++) {
    const read=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/rest/v1/project_offices')&&response.ok());
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await read;
    await expect(panel.getByRole('table')).toHaveCount(1);
    await expect(panel.locator('.po-office-table tbody tr')).toHaveCount(1);
    await expect(filter).toHaveValue('Planning');
  }
  await expect(panel.getByText('Named project Offices',{exact:true})).toHaveCount(0);
  await page.reload();
  await expect(panel.getByRole('table')).toHaveCount(1,{timeout:30_000});
  await expect(panel.locator('.po-office-table tbody tr')).toHaveCount(1);
  expect(duplicateKeys).toEqual([]);
});
