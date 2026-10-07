import { test, expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

const partner = '10000000-0000-4000-8000-000000000002';
type Records = Awaited<ReturnType<typeof projectWorkspaceFixture>>;

async function identityFixture(page: Page, r: Records) {
  const identities: Record<string, any>[] = [], invitations: Record<string, any>[] = [];
  const writes: { name: string; payload: any }[] = [];
  r.projectOffices.push({ id: 'lead', project_id: r.project, office_id: r.org, relationship_type: 'lead', invitation_status: 'joined' });
  r.organizations.push({ id: partner, name: 'City Engineering Office', head_user_id: 'other-head', is_active: true, slug: 'engineering', path: 'engineering', org_type: 'department' });
  await page.route('**/rest/v1/project_office_identities*', route => route.fulfill({ json: identities }));
  await page.route('**/rest/v1/user_invitations*', route => route.fulfill({ json: invitations }));
  await page.route('**/rest/v1/tasks*', route => {
    const query = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: query.has('proposed_office_identity_id') ? r.tasks.filter(t => t.proposed_office_identity_id) : r.tasks });
  });
  await page.route('**/rest/v1/rpc/phase65_*', async route => {
    const name = route.request().url().split('/').at(-1)!, p = route.request().postDataJSON();
    writes.push({ name, payload: p });
    if (name === 'phase65_save_office_identity') {
      let identity = identities.find(i => i.id === p.p_id);
      if (!identity) { identity = { id: p.p_id, project_id: r.project, display_name: p.p_name, canonical_office_id: null, project_office_id: null, contact_email: '', contact_status: 'none', relationship_type: 'collaborating', provenance: { source: 'manual' } }; identities.push(identity); }
      return route.fulfill({ json: identity });
    }
    if (name === 'phase65_propose_task_office') r.tasks.find(t => t.id === p.p_task)!.proposed_office_identity_id = p.p_identity;
    if (name === 'phase65_link_office_identity') {
      const identity = identities.find(i => i.id === p.p_identity)!;
      Object.assign(identity, { canonical_office_id: p.p_office, project_office_id: 'partner' });
      r.projectOffices.push({ id: 'partner', project_id: r.project, office_id: p.p_office, relationship_type: 'collaborating', invitation_status: identity.contact_status === 'accepted' ? 'awaiting_head' : 'pending' });
    }
    if (name === 'phase65_resolve_task_office') Object.assign(r.tasks.find(t => t.id === p.p_task)!, { org_id: partner, proposed_office_identity_id: null });
    return route.fulfill({ json: null });
  });
  await page.route('**/controlpanelEflow/api/invitations/**', route => {
    const url = route.request().url();
    if (route.request().method() === 'POST' && url.endsWith('/v1/project-office-identity')) {
      const payload = route.request().postDataJSON(), identity = identities.find(i => i.id === payload.identity_id)!;
      Object.assign(identity, { contact_email: payload.email, contact_status: 'invited', relationship_type: payload.access });
      const invitation = { id: 'local-invite', project_office_identity_id: identity.id, status: 'pending', email_delivery_status: 'failed', delivery_error: 'Synthetic provider unavailable' };
      invitations.push(invitation); writes.push({ name: 'invite', payload }); return route.fulfill({ json: invitation });
    }
    return route.fulfill({ json: { invitations: url.includes('/office-identities') ? invitations : [] } });
  });
  return { identities, invitations, writes };
}

async function table(page: Page, r: Records) {
  await page.goto('/projects?page=Projects&project=' + r.project + '&view=tasks');
  await expect(page.getByRole('region', { name: 'Project main table' })).toBeVisible({ timeout: 30000 });
}

test('named Office survives reload and separates invitation persistence from failed delivery on mobile', async ({ page }, info) => {
  test.setTimeout(90000);
  const r = await projectWorkspaceFixture(page, 'head'), local = await identityFixture(page, r);
  await table(page, r);
  await page.getByRole('button', { name: 'Project Offices', exact: true }).click();
  await page.getByRole('button', { name: 'Add named Office' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add named Office' });
  await dialog.getByLabel('Office name', { exact: true }).fill('Office not in the directory');
  await dialog.getByRole('button', { name: 'Save Office', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Office name saved');
  expect(local.identities[0].canonical_office_id).toBeNull(); expect(local.writes).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await table(page, r);
  await page.getByRole('button', { name: 'Project Offices', exact: true }).click();
  const card = page.locator('.po-office-table tbody tr').filter({ hasText: 'Office not in the directory' });
  await expect(card).toContainText('Planning only');
  await card.getByRole('button', { name: 'Invite contact', exact: true }).click();
  const contact = page.getByRole('dialog', { name: 'Invite Office contact' });
  await contact.getByLabel('Contact email', { exact: true }).fill('contact@example.test');
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(async () => (await contact.boundingBox())!.width).toBeLessThanOrEqual(320);
  const bounds = (await contact.boundingBox())!;
  // Firefox can report a fraction of a CSS pixel above zero after viewport
  // reflow. Keep the viewport bound without treating raster rounding as overflow.
  expect(bounds.width).toBeLessThanOrEqual(320); expect(bounds.y).toBeGreaterThanOrEqual(-0.5);
  const button = contact.getByRole('button', { name: 'Save & invite contact', exact: true });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  expect(await button.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(8, 127, 140)');
  await page.screenshot({ path: info.outputPath('local-office-contact-mobile.png') });
  await button.click();
  await expect(contact.getByRole('status')).toContainText('invitation saved. Email delivery failed');
  await expect(contact.getByRole('button', { name: 'Save & invite contact' })).toHaveCount(0);
  expect(local.writes.find(w => w.name === 'invite')!.payload.account_role).toBeUndefined();
  await contact.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(card).toContainText('Contact invited');
  await expect(card.getByRole('button', { name: 'Resend contact invitation' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Link directory Office' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('proposed responsibility locks execution until directory linking, Head confirmation and explicit handover', async ({ page }, info) => {
  test.setTimeout(90000);
  const r = await projectWorkspaceFixture(page, 'head'), local = await identityFixture(page, r);
  Object.assign(r.tasks[0], { status: 'pending_assignment', assigned_to: null, team_member_ids: [] });
  local.identities.push({ id: 'local-office', project_id: r.project, display_name: 'Engineering source Office', canonical_office_id: null, project_office_id: null, contact_email: 'contact@example.test', contact_status: 'accepted', relationship_type: 'collaborating', provenance: { source: 'reviewed_import', evidence: 'Engineering source Office prepares the design.' } });
  await table(page, r);
  await page.getByRole('button', { name: 'Responsible Office for Prepare community assessment' }).click();
  await page.getByRole('combobox', { name: 'Assign Office' }).selectOption('proposed:local-office');
  expect(local.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Confirm proposed responsibility' }).click();
  await expect.poll(() => r.tasks[0].proposed_office_identity_id).toBe('local-office');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox', { name: 'Owner for Prepare community assessment' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Status for Prepare community assessment' })).toBeDisabled();
  await table(page, r);
  await expect(page.getByRole('button', { name: 'Responsible Office for Prepare community assessment' })).toContainText('Engineering source Office · proposed');
  await page.route('**/rest/v1/rpc/phase7_project_readiness', route => route.fulfill({ json: { projectId: r.project, governed: false, ready: false, canActivate: false, stage: 'Office identity resolution', checks: [{ key: 'office_identity', label: 'Proposed Office responsibilities resolved', ok: false, detail: '1 task needs directory linking, Office Head confirmation and explicit handover.' }] } }));
  await page.route('**/rest/v1/rpc/phase7_closeout_summary', route => route.fulfill({ json: { tasks: 3, completed: 1, cancelled: 0, budgetEstimate: 0, offices: 1, evidence: 0, contributors: 0, startDate: null, targetDate: null, financial: { requested: 0, approved: 0, settled: 0, open: 0 } } }));
  await page.route('**/rest/v1/rpc/get_project_completion_readiness', route => route.fulfill({ json: { projectId: r.project, canComplete: false, blockers: [] } }));
  await page.getByRole('button', { name: 'Readiness & closeout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activate project', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Resolve in Project Offices', exact: true }).click();
  const card = page.locator('.po-office-table tbody tr').filter({ hasText: 'Engineering source Office' });
  await expect(card.getByRole('button', { name: 'Resolve task responsibility' })).toBeDisabled();
  await card.getByRole('button', { name: 'Link directory Office' }).click();
  const link = page.getByRole('dialog', { name: 'Link Engineering source Office' });
  await link.getByLabel('Directory Office').selectOption(partner);
  await link.getByRole('button', { name: 'Confirm Office link' }).click();
  await expect(link.getByRole('status')).toContainText('Office linked');
  await link.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(card).toContainText('Awaiting Office Head confirmation');
  await expect(card).toHaveCount(1);
  await expect(page.locator('.po-office-table tbody tr')).toHaveCount(2);
  await expect(card.getByRole('button', { name: 'Resolve task responsibility' })).toBeDisabled();
  r.projectOffices.find(o => o.id === 'partner')!.invitation_status = 'joined';
  await table(page, r);
  await page.getByRole('button', { name: 'Project Offices', exact: true }).click();
  await card.getByRole('button', { name: 'Resolve task responsibility' }).click();
  expect(local.writes.filter(w => w.name === 'phase65_resolve_task_office')).toHaveLength(0);
  await page.getByRole('button', { name: 'Confirm change', exact: true }).click();
  await expect.poll(() => r.tasks[0].proposed_office_identity_id).toBeNull();
  expect(r.tasks[0].org_id).toBe(partner); expect(r.tasks[0].assigned_to).toBeNull();
  await page.screenshot({ path: info.outputPath('office-linked-handover-desktop.png') });
  await table(page, r);
  await expect(page.getByRole('button', { name: 'Responsible Office for Prepare community assessment' })).toContainText('City Engineering Office');
  await expect(page.getByRole('combobox', { name: 'Owner for Prepare community assessment' })).toBeDisabled();
});

test('linking a name before contact acceptance keeps the canonical invitation workflow reachable', async ({ page }) => {
  test.setTimeout(90000);
  const r = await projectWorkspaceFixture(page, 'head'), local = await identityFixture(page, r);
  local.identities.push({ id: 'local-office', project_id: r.project, display_name: 'Named Office', canonical_office_id: null, project_office_id: null, contact_email: '', contact_status: 'none', relationship_type: 'collaborating', provenance: { source: 'manual' } });
  await table(page, r); await page.getByRole('button', { name: 'Project Offices', exact: true }).click();
  await page.locator('.po-office-table tbody tr').filter({ hasText: 'Named Office' }).getByRole('button', { name: 'Link directory Office' }).click();
  const link = page.getByRole('dialog', { name: 'Link Named Office' });
  await link.getByLabel('Directory Office').selectOption(partner);
  await link.getByRole('button', { name: 'Confirm Office link' }).click();
  await expect(link.getByRole('status')).toContainText('Office linked');
  await link.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.po-office-table tbody tr').filter({ hasText: 'Named Office' })).toContainText('Contact invitation required');
  await page.locator('.po-office-table').getByRole('button', { name: 'City Engineering Office', exact: true }).click();
  await page.getByRole('dialog', { name: 'City Engineering Office — project Office' }).getByRole('button', { name: 'Invite Office contact' }).click();
  const invite = page.getByRole('dialog', { name: 'Let’s bring another Office in.' });
  await expect(invite.getByRole('combobox', { name: 'Office', exact: true })).toHaveValue(partner);
  await expect(invite.getByRole('combobox', { name: 'Office', exact: true }).locator('option', { hasText: 'City Engineering Office' })).toHaveCount(1);
});
