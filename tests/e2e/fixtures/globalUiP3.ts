import type { Page } from '@playwright/test';
import { projectWorkspaceFixture } from './projectWorkspace';

/** Local synthetic accounts and intercepted APIs; no hosted fallback. */
export async function globalUiP3Fixture(page: Page, role: 'head'|'member'|'admin'|'accounting_staff' = 'head', theme: 'light'|'dark' = 'light', empty = false) {
  const records = await projectWorkspaceFixture(page, role, false, { landingOnly: true, leading: true, theme, empty });
  const title = 'Coordinate municipal community assessment and supporting project evidence with a long distinguishing task title';
  if (!empty) Object.assign(records.tasks[0], { title, status: 'for_review', reviewer_id: records.id, assigned_to: '00000000-0000-4000-8000-000000000099' });
  if (records.projects[0]) records.projects[0].title = 'Community assessment and cross Office membership coordination with a long distinguishing project title';
  const requests: any[] = empty ? [] : [{ id: 'invitation-pending', project_id: records.project, email: 'project.research.and.coordination@example.test', state: 'pending', engagement: 'Contractual', revision: 1, summary: 'Support community research and evidence preparation for the sponsoring Office. Membership does not assign work.', skills: ['Analysis', 'Planning'], access_end: '2026-12-31T15:59:59Z', until_close: false, invitation_created_at: null, delivery_status: 'not_attempted', onboarding: 'pending', pds_documents: [], can_approve: role === 'head', can_dispatch: false, can_revoke: false }];
  const state = { queueError: '', queueReads: 0, decisions: [] as any[], mail: [] as any[] };
  await page.route('**/rest/v1/subtask_submissions?**', route => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/rpc/r8_*', async route => {
    const operation = new URL(route.request().url()).pathname.split('/').at(-1), args = route.request().postDataJSON();
    if (operation === 'r8_head_invitation_queue') {
      state.queueReads++;
      return state.queueError ? route.fulfill({ status: 404, json: { code: 'PGRST202', message: state.queueError } }) : route.fulfill({ json: requests.length ? [{ project_id: records.project, title: records.projects[0].title }] : [] });
    }
    if (operation === 'r8_list_requests') return route.fulfill({ json: { kind: 'office', office_id: records.org, timezone: 'Asia/Singapore', can_request: false, requests } });
    if (operation === 'r8_decide_request') {
      state.decisions.push(args); const request = requests.find(item => item.id === args.p_id)!;
      request.state = args.p_action; request.revision++; request.can_approve = false; request.can_dispatch = request.state === 'approved';
      return route.fulfill({ json: request });
    }
    return route.fulfill({ json: [] });
  });
  await page.route(/\/project-invitations\/[^/]+\/dispatch$/, route => {
    state.mail.push(route.request().postDataJSON()); const request = requests[0];
    request.invitation_created_at = new Date().toISOString(); request.delivery_status = 'provider_accepted'; request.revision++;
    return route.fulfill({ json: { delivery_status: 'provider_accepted', receipt: 'Synthetic local delivery receipt' } });
  });
  await page.route('**/rest/v1/notifications?**', route => route.fulfill({ json: empty ? [] : [{ id: 'membership-update', user_id: records.id, type: 'system', title: 'Project invitation approval requested', message: 'Review project.research.and.coordination@example.test · Review in project Members / Invitations', project_id: records.project, read: false, created_at: new Date().toISOString() }] }));
  return { ...records, requests, state, title };
}
