import { expect, type Page } from '@playwright/test';

// Synthetic browser records; every backend request is intercepted.
export async function projectWorkspaceFixture(page: Page, role: 'head' | 'member', phase4 = false) {
  const id = '00000000-0000-4000-8000-000000000001', org = '10000000-0000-4000-8000-000000000001';
  const project = '20000000-0000-4000-8000-000000000001', group = '30000000-0000-4000-8000-000000000001', now = new Date().toISOString();
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'workspace@example.test', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: now };
  const profile = { id, full_name: 'Alex Rivera', email: user.email, role, org_id: org, is_active: true, employee_id: 'TEST', skills: {}, created_at: now, updated_at: now };
  const office = { id: org, name: 'Planning Office', slug: 'planning_office', path: 'planning_office', org_type: 'department', is_active: true, head_user_id: role === 'head' ? id : null };
  const profiles: Record<string, unknown>[] = [profile], organizations: Record<string, unknown>[] = [office];
  const projectOffices: Record<string, unknown>[] = [], officeMembers: Record<string, unknown>[] = [];
  const projects: Record<string, unknown>[] = [{ id: project, title: 'Community outreach', org_id: org, owner_id: id, created_by: id, status: 'planning', priority: 'medium', created_at: now, updated_at: now }];
  const groups: Record<string, unknown>[] = [{ id: group, project_id: project, title: 'To do', color: '#579bfc', position: 0, is_default: true, created_at: now }];
  const tasks: Record<string, unknown>[] = ['Prepare community assessment', 'Coordinate Office briefing', 'Confirm participants'].map((title, i) => ({ id: '40000000-0000-4000-8000-00000000000' + (i + 1), title, org_id: org, linked_project_id: project, project_id: project, group_id: group, workspace_position: i, status: ['in_progress', 'todo', 'completed'][i], assigned_to: id, team_member_ids: [id], priority: ['high', 'medium', 'low'][i], estimated_hours: [8, 4, 2][i], budget_impact: [1200, 300, 0][i], deadline: '2026-10-' + [9, 12, 5][i].toString().padStart(2, '0'), percent_complete: [40, 0, 100][i], created_at: now, updated_at: now, created_by: id }));
  if (phase4) {
    Object.assign(projects[0], {start_date:'2026-10-01',target_date:'2026-10-20'});
    tasks.forEach((task,i)=>Object.assign(task,{start_date:['2026-10-03','2026-10-10','2026-10-01'][i],dependency_ids:i===1?[tasks[0].id]:[]}));
    tasks.push({...tasks[2],id:'40000000-0000-4000-8000-000000000004',title:'Cancelled duplicate',status:'cancelled'});
  }
  const subtasks: Record<string, unknown>[] = [{ id: '50000000-0000-4000-8000-000000000001', task_id: tasks[0].id, title: 'Gather supporting evidence', status: 'todo', percent_complete: 0, source: 'manual', position: 0, created_by: id, created_at: now, updated_at: now }];
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'synthetic'].join('.');
  await page.routeWebSocket(/\/realtime\/v1\//, () => {});
  await page.route('**/auth/v1/**', route => route.fulfill({ json: route.request().url().includes('/token') ? { access_token: token, refresh_token: 'synthetic', token_type: 'bearer', expires_in: 3600, user } : user }));
  await page.route('**/rest/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), table = url.pathname.split('/').at(-1), single = req.headers().accept?.includes('vnd.pgrst.object');
    let body: unknown = []; const payload = req.postData() ? req.postDataJSON() : {};
    if (table === 'profiles') body = single ? profile : profiles;
    if (table === 'organizations') body = single ? office : organizations;
    if (table === 'project_offices') body = projectOffices;
    if (table === 'project_office_members') body = officeMembers;
    if (table === 'organization_approver_ids') body = role === 'head' ? [id] : [];
    if (table === 'user_preferences') body = { user_id: id, theme: 'light', created_at: now, updated_at: now };
    if (table === 'projects') body = single ? projects[0] : projects;
    if (table === 'tasks') body = tasks;
    if (table === 'subtasks') body = subtasks;
    if (table === 'project_groups') {
      if (req.method() === 'POST') { const row = { ...payload, id: crypto.randomUUID(), is_default: false, created_at: now }; groups.push(row); body = single ? row : [row]; }
      else body = groups.filter(g => !url.searchParams.has('project_id') || url.searchParams.get('project_id') === 'eq.' + g.project_id);
    }
    if (table === 'phase3_patch_task') { const row = tasks.find(t => t.id === payload.p_task_id)!; Object.assign(row, payload.p_patch); body = row; }
    if (table === 'transition_task_status') { const row=tasks.find(t=>t.id===payload.p_task_id)!; Object.assign(row,{status:payload.p_to_status}); body=null; }
    if (table === 'phase3_create_task') { const row = { id: crypto.randomUUID(), title: payload.p_title, org_id: org, linked_project_id: payload.p_project_id, project_id: payload.p_project_id, group_id: payload.p_group_id, status: 'pending_assignment', priority: 'medium', created_by: id, workspace_position: tasks.length, created_at: now, updated_at: now }; tasks.push(row); body = row; }
    if (table === 'create_project_with_details') { const row = { ...payload.p_payload, id: crypto.randomUUID(), created_by: id, created_at: now, updated_at: now }; projects.push(row); groups.push({ id: crypto.randomUUID(), project_id: row.id, title: 'To do', color: '#087f8c', position: 0, is_default: true, created_at: now }); body = row; }
    await route.fulfill({ json: body, headers: { 'content-range': '0-2/3' } });
  });
  await page.route(/\/controlpanelEflow\//, route => route.fulfill({ json: route.request().url().includes('/onboarding/me') ? { user_id: id, tour_key: role + '-v1', tour_version: 1, status: 'dismissed', state: {}, current_step: 'welcome' } : { success: true } }));
  await page.goto('/'); await page.locator('#login-email').fill(user.email); await page.locator('#login-password').fill('synthetic-password'); await page.locator('#login-submit').click();
  await expect(page.locator('.eflow-productivity-sidebar').first()).toBeVisible({ timeout: 30_000 });
  const later = page.getByRole('button', { name: 'Maybe later', exact: true }); await later.waitFor({ timeout: 2000 }).then(() => later.click()).catch(() => {});
  const sidebar = page.locator('.eflow-productivity-sidebar').first();
  await sidebar.hover();
  await sidebar.getByRole('button', { name: 'Projects', exact: true }).first().press('Enter');
  const projectsLink = sidebar.locator('.eflow-productivity-sidebar__subpage').filter({ hasText: /^Projects$/ });
  if (await projectsLink.count()) await projectsLink.first().click();
  await expect(page.getByRole('region', { name: 'Project main table' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Edit task Prepare community assessment' })).toBeVisible();
  return {tasks,projects,groups,subtasks,id,org,project,profiles,organizations,projectOffices,officeMembers,profile};
}
