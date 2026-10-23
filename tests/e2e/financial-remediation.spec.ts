import { expect, test, type Page } from '@playwright/test';
import { phase16FinancialFixture, phase16FinancialState } from './fixtures/phase16Financial';
import type { IndependentReviewContext } from '../../src/app/features/budget/services/independentReviewService';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

// Synthetic, network-isolated browser acceptance. SQL authorization is tested
// separately against native PostgreSQL; these images are not hosted receipts.
async function openAccounting(page: Page, name: string) {
  const navigation = page.getByRole('navigation', { name: 'Accounting destinations', exact: true });
  if ((page.viewportSize()?.width || 1440) < 1024 && !await navigation.isVisible()) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name, exact: true }).click();
}
function seedJournal(state: ReturnType<typeof phase16FinancialState>) {
  const id = '75000000-0000-4000-8000-000000000099';
  state.entries.push({ id, entry_number: 99, org_id: state.org, fiscal_budget_id: state.budget, entry_date: '2026-10-22', reference_number: 'QA-RECONCILIATION', source_type: 'liquidation', memo: 'QA complete receipt package. '.repeat(20), posted_at: '2026-10-21T16:30:00Z' });
  [{ account_code: '501', debit: 400, credit: 0 }, { account_code: '101', debit: 100, credit: 0 }, { account_code: '105', debit: 0, credit: 500 }].forEach((line, index) => state.lines.push({ ...line, id: `${id}-${index}`, line_number: index + 1, journal_entry_id: id, account_title: index === 0 ? 'Supplies expense' : index === 1 ? 'Cash returned' : 'Advance cleared' }));
}

test('Journal detail preserves filters and focus, shows full lines, and never invents available funding', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { state } = await phase16FinancialFixture(page);
  seedJournal(state);
  await openAccounting(page, 'General Journal');
  await expect(page.getByText('₱40,000.00', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search journal', exact: true }).fill('QA-RECONCILIATION');
  await page.getByLabel('Account classification', { exact: true }).selectOption('expense');
  const opener = page.getByRole('button', { name: 'Inspect journal QA-RECONCILIATION', exact: true });
  await expect(opener).toBeVisible();
  await page.screenshot({ path: info.outputPath('journal-desktop.jpg'), fullPage: true });
  await opener.click();
  const detail = page.getByRole('region', { name: 'Journal entry QA-RECONCILIATION', exact: true });
  await expect(detail.getByText('Full entry totals', { exact: true })).toBeVisible();
  await expect(detail.getByText('Cash returned', { exact: true })).toBeVisible();
  await expect(detail.getByText('Advance cleared', { exact: true })).toBeVisible();
  await expect(detail.getByText('Oct 22, 2026', { exact: false }).first()).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Read full memo', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('journal-entry-desktop.jpg'), fullPage: true });
  await detail.getByRole('button', { name: 'Read full memo', exact: true }).click();
  await expect(detail.locator('.journal-entry__memo p')).toHaveText(state.entries.find(entry => entry.reference_number === 'QA-RECONCILIATION')!.memo);
  await detail.getByRole('button', { name: 'Show less', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  const desktopCredit = detail.getByRole('row').filter({ hasText: 'Advance cleared' }).getByRole('cell').last();
  const desktopCreditBox = await desktopCredit.boundingBox();
  expect(desktopCreditBox && desktopCreditBox.x + desktopCreditBox.width <= 1280).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('journal-entry-desktop-1280.jpg'), fullPage: true });
  await detail.getByRole('button', { name: 'Back to journal', exact: true }).click();
  await expect(page.getByLabel('Account classification', { exact: true })).toHaveValue('expense');
  await expect(page.getByRole('searchbox', { name: 'Search journal', exact: true })).toHaveValue('QA-RECONCILIATION');
  await expect(opener).toBeFocused();
  await opener.click();
  await page.getByRole('button', { name: 'Open fiscal year 2027', exact: true }).click();
  await expect(detail).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});

test('Independent Head reviews a conflict package and a separate Accounting Officer settles it', async ({ page, browser }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = phase16FinancialState();
  await phase16FinancialFixture(page, 'accounting_staff', state);
  const headId = '00000000-0000-4000-8000-000000000003';
  let review: IndependentReviewContext['review'] = null;
  const writes: string[] = [];
  const intercept = async (target: Page, isHead: boolean) => target.route('**/rest/v1/rpc/*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    const body = route.request().postDataJSON();
    if (name === 'get_liquidation_independent_review') return route.fulfill({ json: { liquidationId: state.liquidations[0].id, version: 2, required: true, review, candidates: [{ id: headId, name: 'Morgan Head', appointment: 'Head' }], eligibleSettlers: 1, current: Boolean(review), canReview: isHead && Boolean(review), canSettle: !isHead, escalationRequired: false } });
    if (name === 'route_liquidation_independent_review') {
      expect(isHead).toBe(false); expect(body.p_idempotency_key).toBeTruthy();
      writes.push('route'); review = { id: 'review-1', reviewer_id: headId, status: 'pending', route_reason: body.p_reason, decision_reason: null, decided_at: null };
      return route.fulfill({ json: 'review-1' });
    }
    if (name === 'decide_liquidation_independent_review') {
      expect(isHead).toBe(true); expect(body.p_idempotency_key).toBeTruthy();
      writes.push('review'); review = { ...review!, status: body.p_decision, decision_reason: body.p_reason, decided_at: new Date().toISOString() };
      return route.fulfill({ json: 'review-1' });
    }
    return route.fallback();
  });
  await intercept(page, false);
  await openAccounting(page, 'Settlements');
  await expect(page.getByRole('button', { name: 'Settle & post', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('combobox', { name: 'Independent reviewer', exact: true }).selectOption(headId);
  await page.getByLabel('Routing reason', { exact: true }).fill('Accounting Officer owns the receipt package.');
  await page.getByRole('button', { name: 'Send for independent review', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Send to reviewer', exact: true }).click();
  await expect(page.getByText('Waiting for Morgan Head.', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  const headContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const head = await headContext.newPage();
    await phase16FinancialFixture(head, 'head', state);
    await intercept(head, true);
    await head.goto('/office-budget?page=Office%20Budget&view=approvals&fy=2026');
    await head.getByLabel('Review findings', { exact: true }).fill('Receipts independently checked; return reference confirmed.');
    await head.screenshot({ path: info.outputPath('independent-head-review.jpg'), fullPage: true });
    await head.getByRole('button', { name: 'Approve review', exact: true }).click();
    await head.getByRole('alertdialog').getByRole('button', { name: 'Record review', exact: true }).click();
    await expect(head.getByText('Approved for separate Accounting settlement.', { exact: true })).toBeVisible();
    expect(state.writes).toHaveLength(0);
  } finally { await headContext.close(); }
  await page.getByRole('button', { name: 'Refresh review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Settle & post', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Settle & post', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm settlement', exact: true }).click();
  await expect(page.getByText(/Settlement recorded/)).toBeVisible();
  expect(writes).toEqual(['route', 'review']);
  expect(state.writes.filter(write => write.rpc === 'settle_accounting_liquidation')).toHaveLength(1);
});

for (const width of [390, 768]) test(`Financial controls fit ${width}px without page overflow`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const { state } = await phase16FinancialFixture(page); seedJournal(state);
  await openAccounting(page, 'Settlements');
  await expect(page.getByRole('button', { name: 'Settle & post', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`settlement-${width}.jpg`), fullPage: true });
  await openAccounting(page, 'Voucher & Cash Releases');
  await page.getByRole('button', { name: 'Mark released', exact: true }).click();
  const release = page.getByRole('dialog', { name: 'Disbursement Voucher', exact: true });
  await expect(release).toBeVisible();
  const box = await release.boundingBox();
  expect(box && box.x >= -1 && box.width + box.x <= width + 1).toBe(true);
  await page.screenshot({ path: info.outputPath(`release-${width}.jpg`), fullPage: true });
  await release.getByRole('button', { name: /Close/ }).first().click();
  await openAccounting(page, 'General Journal');
  await page.getByRole('button', { name: 'Inspect journal QA-RECONCILIATION', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Complete journal entry lines', exact: true })).toBeVisible();
  const backBox = await page.getByRole('button', { name: 'Back to journal', exact: true }).boundingBox();
  expect(backBox && backBox.y >= 55 && backBox.y < 300).toBe(true);
  const credit = page.getByRole('row').filter({ hasText: 'Advance cleared' }).getByRole('cell').last();
  const creditBox = await credit.boundingBox();
  expect(creditBox && creditBox.x >= 0 && creditBox.x + creditBox.width <= width + 1).toBe(true);
  await expect(credit).toContainText('₱500.00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`journal-${width}.jpg`), fullPage: true });
  expect(state.writes).toHaveLength(0);
});

test('A Member with an Assistant appointment reviews only assigned packages from the existing Inbox', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await projectWorkspaceFixture(page, 'member', false, { landingOnly: true });
  fixture.organizations[0].assistant_head_user_id = fixture.id;
  let reviewed = false;
  const writes: string[] = [];
  const context = { liquidationId: '73000000-0000-4000-8000-000000000077', version: 1, required: true, current: true, canReview: true, canSettle: false, review: { id: 'review-77', reviewer_id: fixture.id, status: 'pending', route_reason: 'Accounting owns the receipt package.', decision_reason: null, decided_at: null }, candidates: [{ id: fixture.id, name: 'Appointed reviewer', appointment: 'Assistant Head' }], eligibleSettlers: 1, escalationRequired: false };
  await page.route('**/rest/v1/rpc/*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (name === 'list_my_independent_liquidation_reviews') return route.fulfill({ json: reviewed ? [] : [{ context, liquidation: { id: context.liquidationId, request_id: 'request-77', version: 1, declared_spent: 400, returned_amount: 100, status: 'pending_department_settlement', note: 'QA independent receipt package' }, request: { id: 'request-77', org_id: fixture.org, task: { title: 'QA funded work' }, cash_recipient: { full_name: 'Accounting recipient' } }, receipts: [] }] });
    if (name === 'get_liquidation_independent_review') return route.fulfill({ json: context });
    if (name === 'decide_liquidation_independent_review') { writes.push(name); reviewed = true; return route.fulfill({ json: context.review.id }); }
    if (/settle|post_general_journal/.test(name)) writes.push(name);
    return route.fallback();
  });
  await page.goto('/inbox?page=Needs%20action');
  const queue = page.getByRole('region', { name: 'Assigned independent financial reviews', exact: true });
  await expect(queue.getByText('QA independent receipt package', { exact: true })).toBeVisible();
  await expect(queue.getByRole('button', { name: 'Settle & post', exact: true })).toHaveCount(0);
  await queue.getByLabel('Review findings', { exact: true }).fill('Independent review complete, separate Accounting posting required.');
  await page.screenshot({ path: info.outputPath('assistant-member-inbox.jpg'), fullPage: true });
  await queue.getByRole('button', { name: 'Approve review', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Record review', exact: true }).click();
  await expect(page.getByText('Review recorded. Current assignments refreshed.', { exact: true })).toBeVisible();
  expect(writes).toEqual(['decide_liquidation_independent_review']);
});
