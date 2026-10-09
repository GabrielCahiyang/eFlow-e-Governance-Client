import { test, expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

const source = 'Project implementation plan: Planning Office prepares the assessment. Objectives: gather community needs, coordinate outreach, prepare meeting materials and deliver the community program. Schedule: October 2026. Teams will review evidence and document findings before implementing the outreach activities.';
function aiDraft(officeId: string) {
  return { schemaVersion: 1, project: { title: 'Community outreach', description: 'Deliver a community outreach program.', objectives: 'Assess and serve community needs.', startDate: '2026-10-05', targetDate: '2026-10-31' }, offices: [{ key: 'planning', name: 'Planning Office', evidence: 'Planning Office prepares the assessment.', officeId }], groups: [{ key: 'g1', title: 'Preparation', color: '#579bfc', existingGroupId: '', tasks: Array.from({ length: 8 }, (_, i) => ({ key: `t${i+1}`, title: `Prepare outreach step ${i+1}`, description: 'Gather community information, coordinate the Office briefing, and prepare a complete evidence package for human review.', priority: 'medium', estimatedHours: 8, startDate: '2026-10-05', dueDate: '2026-10-15', officeKey: 'planning', sourceQuote: 'Planning Office prepares the assessment.', dependencies: i === 1 ? ['t1'] : [], subitems: [{ title: 'Gather supporting data', dueDate: '2026-10-08' }, { title: 'Prepare findings', dueDate: '' }, { title: 'Review with the Office', dueDate: '' }] })) }], warnings: [], pipeline: { deepseek: 'completed', laya: 'completed', pygad: 'skipped_no_employees' } };
}
async function mockAi(page: Page, office: string) {
  await page.route('**/controlpanelEflow/api/ai/status', route => route.fulfill({ json: { ai_endpoint: 'http://127.0.0.1:5190/controlpanelEflow/api', ai_endpoint_status: 'online', ai_endpoint_heartbeat: new Date().toISOString() } }));
  await page.route('**/controlpanelEflow/api/proposals/validate', route => route.fulfill({ json: { is_proposal: true } }));
  await page.route('**/controlpanelEflow/api/ai/jobs', route => {
    expect(route.request().postDataJSON().workspace_decomposition.schemaVersion).toBe(1);
    return route.fulfill({ status: 202, json: { job_id: 'review-job', status: 'completed', position: null, jobs_ahead: 0, queue_depth: 0, result: { message: { content: JSON.stringify(aiDraft(office)) } } } });
  });
  await page.getByRole('button', { name: 'New task options' }).click();
  await page.getByRole('menuitem', { name: 'Import project document' }).click();
  const dialog = page.getByRole('dialog', { name: 'Turn a document into project work' });
  await dialog.getByLabel('Project document').setInputFiles({ name: 'outreach-plan.md', mimeType: 'text/markdown', buffer: Buffer.from(source) });
  await expect(dialog.getByLabel('Document text or project brief')).toHaveValue(source, { timeout: 15000 });
  await dialog.getByRole('button', { name: 'Generate draft' }).click();
  const review = page.getByRole('dialog', { name: 'Review your project plan' });
  await expect(review.getByLabel('Task name t1')).toBeVisible();
  return review;
}

test('Phase 5 shows a spacious editable hierarchy and imports only after confirmation with safe retry', async ({ page }, info) => {
  test.setTimeout(120_000); await page.setViewportSize({ width: 1440, height: 1000 });
  const records = await projectWorkspaceFixture(page, 'head');
  const imports: Record<string, any>[] = [];
  await page.route('**/rest/v1/rpc/phase65_import_project_work', async route => {
    const payload = route.request().postDataJSON(); imports.push(payload);
    if (imports.length === 1) return route.fulfill({ status: 503, json: { message: 'Temporary connection interruption', code: 'TEST_RETRY' } });
    const mappings: Record<string, string> = {};
    for (const g of payload.p_review.groups) {
      const groupId = g.existingGroupId || crypto.randomUUID();
      if (!g.existingGroupId) records.groups.push({ id: groupId, title: g.title, project_id: records.project, color: g.color, position: 1, is_default: false });
      for (const t of g.tasks) {
        const id = crypto.randomUUID(); mappings[t.key] = id;
        records.tasks.push({ id, title: t.title, description: t.description, priority: t.priority, org_id: records.org, linked_project_id: records.project, project_id: records.project, group_id: groupId, status: 'pending_assignment', assigned_to: null, estimated_hours: t.estimatedHours, deadline: t.dueDate, start_date: t.startDate, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), workspace_position: records.tasks.length });
        for (const [position, subitem] of t.subitems.entries()) records.subtasks.push({ id: crypto.randomUUID(), task_id: id, title: subitem.title, status: 'todo', position, source: 'ai_extracted', created_by: records.id, created_at: new Date().toISOString() });
      }
    }
    return route.fulfill({ json: { taskCount: Object.keys(mappings).length, subitemCount: payload.p_review.groups.flatMap((g: any) => g.tasks).reduce((n: number, t: any) => n+t.subitems.length, 0), groupCount: 1, taskIds: mappings, groupIds: [] } });
  });
  const review = await mockAi(page, records.org);
  const bounds = (await review.boundingBox())!;
  expect(bounds.width).toBeGreaterThan(1300); expect(bounds.height).toBeGreaterThan(880);
  const visibleRows = await review.locator('.pi-review-table tbody>tr').evaluateAll(rows => rows.filter(row => { const r = row.getBoundingClientRect(), body = row.closest('.pi-review-body')!.getBoundingClientRect(); return r.top >= body.top && r.bottom <= body.bottom; }).length);
  await page.screenshot({ path: info.outputPath('review-desktop.png') });
  expect(visibleRows).toBeGreaterThanOrEqual(4);
  await review.getByRole('button', { name: 'Add to Project' }).click();
  await expect(review.getByRole('alert')).toContainText('Confirm'); expect(imports).toHaveLength(0);
  await review.getByLabel('Task name t1').fill('Prepare outreach evidence');
  await review.getByLabel('Description t1', { exact: true }).fill('Prepare the full evidence package for review.');
  await review.getByLabel('Estimated hours t1', { exact: true }).fill('16');
  await review.getByLabel('Include Prepare outreach step 8').uncheck();
  await review.locator('.pi-responsibilities').getByRole('checkbox').check();
  await review.locator('.pi-details-button').first().click();
  await review.getByLabel('Subitem t1 1', { exact: true }).fill('Gather verified community data');
  await page.screenshot({ path: info.outputPath('review-subitems.png') });
  await review.getByRole('button', { name: 'Add to Project' }).click();
  await page.getByRole('alertdialog', { name: 'Add reviewed work to project?' }).getByRole('button', { name: 'Add reviewed work', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('safe retry');
  await expect(review.getByLabel('Task name t1')).toBeDisabled();
  await review.getByRole('button', { name: 'Retry same import' }).click();
  await expect(page.getByRole('dialog', { name: 'Work added to your project' })).toContainText('7 tasks and 21 subitems');
  expect(imports[0].p_request_id).toBe(imports[1].p_request_id);
  expect(imports[0].p_review).toEqual(imports[1].p_review);
  expect(imports[1].p_review.applyProjectDetails).toBe(false);
  await page.getByRole('dialog', { name: 'Work added to your project' }).getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Edit task Prepare outreach evidence', exact: true })).toBeVisible();
  expect(records.tasks.filter(t => t.title === 'Prepare outreach evidence')).toHaveLength(1);
});

test('Phase 5 mobile review fills the screen and scrolls inside its table', async ({ page }, info) => {
  test.setTimeout(90_000); const records = await projectWorkspaceFixture(page, 'head');
  await page.setViewportSize({ width: 390, height: 844 });
  const review = await mockAi(page, records.org);
  const bounds = (await review.boundingBox())!;
  expect(Math.round(bounds.width)).toBe(390); expect(Math.round(bounds.height)).toBe(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await review.locator('.pi-review-body').evaluate(el => el.scrollTo(0, 430));
  await expect(review.getByLabel('Task name t1')).toBeVisible();
  const confirmBounds = (await review.getByRole('button', { name: 'Add to Project' }).boundingBox())!;
  expect(confirmBounds.x + confirmBounds.width).toBeLessThanOrEqual(390);
  const descriptionBounds = (await review.getByLabel('Description t1', { exact: true }).boundingBox())!;
  expect(descriptionBounds.x + descriptionBounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('review-mobile.png') });
});

test('Phase 5 extracts readable PDF project text before generating a draft', async ({ page }) => {
  await projectWorkspaceFixture(page, 'head');
  await page.getByRole('button', { name: 'New task options' }).click();
  await page.getByRole('menuitem', { name: 'Import project document' }).click();
  const dialog = page.getByRole('dialog', { name: 'Turn a document into project work' });
  // A valid one-page PDF fixture, with byte offsets rather than a mocked extractor.
  const content = `BT /F1 10 Tf 20 770 Td (${source}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 3000 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i+1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await dialog.getByLabel('Project document').setInputFiles({ name: 'project-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
  await expect(dialog.getByLabel('Document text or project brief')).toHaveValue(source);
  await expect(dialog.getByRole('button', { name: 'Generate draft' })).toBeEnabled();
});
