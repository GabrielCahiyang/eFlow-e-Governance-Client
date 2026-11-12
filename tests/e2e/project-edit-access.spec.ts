import { expect, test } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test('Add people grants and removes editing without dropping membership, and Audit Trail opens in the same project', async ({ page }) => {
  test.setTimeout(120_000);
  const fixture = await projectWorkspaceFixture(page, 'head', false, { landingOnly: true });
  const office = '80000000-0000-4000-8000-000000000001';
  const member = '80000000-0000-4000-8000-000000000002';
  const candidate = '80000000-0000-4000-8000-000000000003';
  const roster = { project_office_id: office, user_id: member, can_edit: false };
  fixture.profiles.push({ id: member, org_id: fixture.org, full_name: 'Jordan Cruz', email: 'jordan@example.test', role: 'member', is_active: true });
  fixture.profiles.push({ id: candidate, org_id: fixture.org, full_name: 'Sam Reyes', email: 'sam@example.test', role: 'member', is_active: true });
  fixture.projectOffices.push({ id: office, project_id: fixture.project, office_id: fixture.org, relationship_type: 'lead', invitation_status: 'joined' });
  fixture.officeMembers.push(roster);
  fixture.projects[0].status = 'active';
  await page.route('**/rest/v1/rpc/r9_selection_preview', route => route.fulfill({ json: { fingerprint: 'team-checked', removed: [] } }));
  const saves: string[][] = [];
  await page.route('**/rest/v1/rpc/save_project_team_edit_access', route => {
    const args = route.request().postDataJSON();
    expect(args.p_office).toBe(office);
    expect(args.p_users).toEqual([member]);
    saves.push(args.p_editors);
    roster.can_edit = args.p_editors.includes(member);
    return route.fulfill({ json: args.p_users });
  });
  const now = new Date().toISOString();
  await page.route('**/rest/v1/rpc/r11_project_activity', route => {
    expect(route.request().postDataJSON().p_project).toBe(fixture.project);
    return route.fulfill({ json: {
      snapshot: 'qa-history', total: 1, size: 25, page: 0, more: false, asOf: now, expiresAt: new Date(Date.now() + 60_000).toISOString(),
      events: [{ event_id: 'project-change:test', kind: 'project', title: 'Task details changed', detail: 'Title: Old title → New title', actor_name: 'Jordan Cruz', occurred_at: now }],
    } });
  });
  await page.goto(`/projects?page=Projects&workspace=${fixture.org}&project=${fixture.project}&view=tasks`);
  const openPeople = page.getByRole('button', { name: '+ Add people', exact: true });
  const include = page.getByRole('checkbox', { name: 'Include Jordan Cruz' });
  const canEdit = page.getByRole('checkbox', { name: 'Can edit · Jordan Cruz' });
  for (const value of [true, false]) {
    await openPeople.click();
    const includeCandidate = page.getByRole('checkbox', { name: 'Include Sam Reyes', exact: true });
    const candidateEditing = page.getByRole('checkbox', { name: 'Can edit · Sam Reyes' });
    await expect(includeCandidate).toBeVisible();
    await expect(candidateEditing).toHaveCount(0);
    if (value) {
      await includeCandidate.check();
      await expect(candidateEditing).toHaveCount(0);
      await includeCandidate.uncheck();
    }
    await expect(include).toBeChecked();
    await expect(canEdit).toBeChecked({ checked: !value });
    await canEdit.setChecked(value);
    await page.getByRole('button', { name: 'Save project team', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Save project team?' }).getByRole('button', { name: 'Save project team', exact: true }).click();
    await expect(openPeople).toBeVisible();
  }
  expect(saves).toEqual([[member], []]);
  await page.getByRole('button', { name: 'Browse project views' }).click();
  await page.getByRole('button', { name: 'Audit Trail', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Audit Trail', exact: true })).toHaveAttribute('aria-selected', 'true');
  const history = page.getByRole('region', { name: 'Activity events' });
  await expect(history.getByText('Jordan Cruz')).toBeVisible();
  await expect(history.getByText('Title: Old title → New title')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`project=${fixture.project}.*view=activity`));
});
