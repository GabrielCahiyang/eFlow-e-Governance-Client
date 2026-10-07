import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test('Offices quietly recover reads and remove revoked and accepted named entries', async ({ page }, info) => {
  test.setTimeout(90_000);
  const r = await projectWorkspaceFixture(page, 'head');
  const partner = '10000000-0000-4000-8000-000000000002';
  r.organizations.push({ id: partner, name: 'New Dept 1', is_active: true });
  r.projectOffices.push(
    { id: 'lead', project_id: r.project, office_id: r.org, relationship_type: 'lead', invitation_status: 'joined' },
    { id: 'random', project_id: r.project, office_id: partner, relationship_type: 'collaborating', invitation_status: 'revoked', contact_email: 'contact@example.test' },
  );
  const identities = [
    { id: 'backfill', project_id: r.project, project_office_id: 'random', canonical_office_id: partner, display_name: 'New Dept 1', relationship_type: 'collaborating', contact_status: 'revoked', provenance: { source: 'canonical_backfill' } as Record<string, unknown> },
    { id: 'named', project_id: r.project, canonical_office_id: null, project_office_id: null, display_name: 'Random named Office', relationship_type: 'collaborating', contact_status: 'accepted', provenance: { source: 'manual' } as Record<string, unknown> },
  ];
  let failures = 2, historyReads = 0, removals = 0;
  await page.route('**/rest/v1/project_office_identities*', route => route.fulfill({ json: identities }));
  await page.route('**/rest/v1/user_invitations*', route => {
    historyReads++;
    if (failures-- > 0) return route.fulfill({ status: 503, json: { message: 'Invalid or expired Supabase session.' } });
    return route.fulfill({ json: [] });
  });
  await page.route('**/rest/v1/rpc/phase65_remove_project_office', route => {
    removals++;
    const p = route.request().postDataJSON();
    identities.filter(i => i.id === p.p_identity || i.project_office_id === p.p_participation)
      .forEach(i => { i.provenance.removed = true; });
    return route.fulfill({ json: null });
  });
  await page.goto('/projects?page=Projects&project=' + r.project + '&view=offices');
  const panel = page.getByRole('region', { name: 'Project Office collaboration' });
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole('table')).toHaveCount(1);
  await expect(panel.getByText('Named project Offices', { exact: true })).toHaveCount(0);
  await expect(panel.getByText('No named Offices yet.', { exact: true })).toHaveCount(0);
  await expect(panel.getByText('Invalid or expired Supabase session.')).toHaveCount(0);
  await expect(panel.locator('.po-error')).toHaveCount(0);
  await expect.poll(() => historyReads).toBeGreaterThan(2);
  await expect(panel.getByRole('status').filter({ hasText: 'Updating Offices' })).toHaveCount(0);
  const remove = panel.getByRole('button', { name: 'Remove New Dept 1 from project', exact: true });
  await expect(remove).toBeVisible();
  await remove.click();
  const confirm = page.getByRole('alertdialog', { name: 'Remove Office?' });
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(removals).toBe(0);
  await remove.click();
  await confirm.getByRole('button', { name: 'Remove Office', exact: true }).click();
  await expect(panel.locator('.po-office-table tbody tr').filter({ hasText: 'New Dept 1' })).toHaveCount(0);
  const card = panel.locator('.po-office-table tbody tr').filter({ hasText: 'Random named Office' });
  await card.getByRole('button', { name: 'Remove Random named Office from project', exact: true }).click();
  await panel.getByRole('button', { name: 'Confirm change', exact: true }).click();
  await expect(card).toHaveCount(0);
  expect(removals).toBe(2);
  await page.reload();
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.locator('.po-office-table tbody tr').filter({ hasText: 'New Dept 1' })).toHaveCount(0);
  await expect(card).toHaveCount(0);
  await expect(panel.locator('.po-error')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('project-offices-recovered.png') });
});
