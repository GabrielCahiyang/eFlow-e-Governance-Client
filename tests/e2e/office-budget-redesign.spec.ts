import { expect, test } from '@playwright/test';
import { phase16FinancialFixture, phase16FinancialState } from './fixtures/phase16Financial';

test.skip(process.env.EFLOW_E2E !== '1', 'Opt-in local browser suite');

const views = [
  ['overview', 'Overview', 'Available to fund'],
  ['annual', 'Annual Budget', 'Annual office budget'],
  ['funding', 'Proposal & Task Funding', 'No funded work'],
  ['office-petty-cash', 'Office Petty Cash', 'Petty cash requests'],
  ['approvals', 'Funding Requests', 'Approval inbox is clear'],
  ['releases', 'Releases & Settlement', 'Voucher & release schedule'],
  ['expenses', 'Expenses', 'Verified expense register'],
  ['vouchers', 'Task Cash Vouchers', 'Task Cash Vouchers'],
  ['journal', 'General Journal', 'Journal entries'],
  ['audit', 'Accounting Trail', 'End-to-end accounting trail'],
] as const;

test('Head Office Budget renders all ten views and retains its fiscal scope', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 980 });
  const state = phase16FinancialState();
  const settledRequest = {
    ...state.requests[0],
    id: '72000000-0000-4000-8000-000000000002',
    request_number: 13,
    status: 'settled',
    purpose: 'Workshop registration supplies',
    actual_spent: 8500,
    returned_amount: 1500,
  };
  state.requests.push(settledRequest);
  state.liquidations.push({
    ...state.liquidations[0],
    id: '73000000-0000-4000-8000-000000000002',
    request_id: settledRequest.id,
    version: 1,
    status: 'approved',
    liquidation_number: 'LIQ-2026-13-v1',
  });
  const journalId = '75000000-0000-4000-8000-000000000001';
  state.entries.push({
    id: journalId, entry_number: 1, fiscal_budget_id: state.budget, org_id: state.org,
    entry_date: '2026-10-06', reference_number: 'LIQ-2026-13-v1', source_type: 'liquidation',
    memo: 'Verified settlement', posted_at: '2026-10-06T00:00:00Z',
  });
  state.lines.push(
    { id: `${journalId}-1`, journal_entry_id: journalId, line_number: 1, account_code: '501', account_title: 'Supplies expense', debit: 8500, credit: 0 },
    { id: `${journalId}-2`, journal_entry_id: journalId, line_number: 2, account_code: '101', account_title: 'Cash', debit: 1500, credit: 0 },
    { id: `${journalId}-3`, journal_entry_id: journalId, line_number: 3, account_code: '105', account_title: 'Member advances', debit: 0, credit: 10000 },
  );
  await phase16FinancialFixture(page, 'head', state);
  await page.route('**/rest/v1/rpc/get_office_budget_sections', route => route.fulfill({ json: {
    sections: [{ id: 'account-1', name: 'Community services', amount: 50000, heldAmount: 0, committedAmount: 10000, position: 0 }],
    version: 1, canAdjust: true, releaseScheduleAvailable: true, canConfirmReleases: false, versions: [],
  } }));
  await page.route('**/rest/v1/rpc/office_petty_cash_snapshot', route => route.fulfill({ json: {
    ceiling: 30000, receiptLimit: 5000, cash: 30000, reserved: 1200, available: 28800, outstanding: 0, replenishable: 0, events: [],
    requests: [{ id: 'petty-1', requester: state.recipient, requesterName: 'Jordan Recipient', purpose: 'Workshop materials', amount: 1200, spent: 0, status: 'pending', receipts: [] }],
  } }));
  await page.goto('/office-budget?view=overview&fy=2026');
  const desktop = page.getByRole('navigation', { name: 'Office Budget views' });
  const workspace = page.locator('.eflow-budget-workspace');
  await expect(desktop).toBeVisible({ timeout: 30_000 });
  await expect(workspace.getByRole('heading', { name: 'Available to fund', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('overview-desktop.png'), animations: 'disabled' });
  await desktop.getByRole('button', { name: 'Planning & Allocation', exact: true }).click();
  await expect(page).toHaveURL(/view=annual/);
  await desktop.getByRole('button', { name: 'Proposal & Task Funding', exact: true }).click();
  await expect(page).toHaveURL(/view=funding/);
  await page.goBack();
  await expect(desktop.getByRole('button', { name: 'Annual Budget', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goForward();
  await expect(desktop.getByRole('button', { name: 'Proposal & Task Funding', exact: true })).toHaveAttribute('aria-current', 'page');
  const reason = workspace.getByRole('textbox', { name: 'Reason / approved authority reference' });
  await reason.fill('Draft authorization reason');
  await desktop.getByRole('button', { name: 'Ledger & Audit', exact: true }).click();
  const discard = page.getByRole('alertdialog', { name: 'Discard unsaved changes?' });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(reason).toHaveValue('Draft authorization reason');
  await reason.clear();

  const picker = workspace.getByRole('combobox', { name: 'Budget view', exact: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 920 });
    for (const [view, label, heading] of views) {
      if (width < 1024) {
        await picker.click();
        await page.getByRole('option', { name: label, exact: true }).click();
        await expect(picker).toContainText(label);
      } else {
        const group = view === 'overview' ? 'Overview' : ['annual', 'funding'].includes(view) ? 'Planning & Allocation'
          : ['journal', 'audit'].includes(view) ? 'Ledger & Audit' : 'Requests & Settlement';
        await desktop.getByRole('button', { name: group, exact: true }).click();
        if (view !== 'overview') await desktop.getByRole('button', { name: label, exact: true }).click();
      }
      await expect(page).toHaveURL(new RegExp(`view=${view}(?:&|$)`));
      const content = view === 'funding' || view === 'approvals'
        ? workspace.getByText(heading, { exact: true })
        : workspace.getByRole('heading', { name: heading, exact: true });
      await expect(content).toBeVisible();
      if (view === 'expenses' || view === 'vouchers') await expect(workspace.getByText(settledRequest.purpose, { exact: true })).toBeVisible();
      if (view === 'journal') await expect(workspace.getByText('LIQ-2026-13-v1', { exact: true })).toBeVisible();
      expect(await workspace.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${view} at ${width}px`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 1440 || width === 390) await page.screenshot({ path: info.outputPath(`${view}-${width}.png`), animations: 'disabled' });
    }
  }
  await picker.click();
  await expect(page.getByRole('option')).toHaveCount(10);
  await page.getByRole('option', { name: 'Office Petty Cash', exact: true }).click();
  await expect(workspace.getByText('Workshop materials', { exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'Request petty cash', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Request petty cash', exact: true });
  await expect(dialog.getByLabel('Purpose', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
