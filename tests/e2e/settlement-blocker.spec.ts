import {test,expect} from '@playwright/test';
import {phase16FinancialFixture,phase16FinancialState} from './fixtures/phase16Financial';
// Intercepted browser responses only. Does not modify the hosted demo request.
test('A blocked settlement confirms that the office Head was notified',async({page},info)=>{
 test.setTimeout(100000);await page.setViewportSize({width:1440,height:1000});
 const state=phase16FinancialState();state.requests[0].requester_id='00000000-0000-4000-8000-000000000001';state.requests[0].cash_recipient_id='00000000-0000-4000-8000-000000000001';
 await phase16FinancialFixture(page,'accounting_staff',state);
 await page.route('**/rest/v1/rpc/get_liquidation_independent_review',route=>route.fulfill({json:{liquidationId:state.liquidations[0].id,version:2,required:true,current:false,canReview:false,canSettle:false,review:null,candidates:[],eligibleSettlers:0,escalationRequired:true,headAlertStatus:'notified'}}));
 await page.getByRole('navigation',{name:'Accounting destinations',exact:true}).getByRole('button',{name:'Settlements',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Accounting settlement queue'})).toBeVisible({timeout:45000});
 const notice=page.getByRole('status',{name:'Settlement blocked'});
 await expect(notice).toContainText('Automatically escalated to the Head');
 await expect(notice).toContainText(/No (?:other )?eligible (?:Accounting )?officer is available\./i);
 await expect(notice).toContainText('An independent reviewer is also needed.');
 await expect(page.getByRole('button',{name:'Settle & post',exact:true})).toHaveAttribute('aria-disabled','true');
 expect(state.writes).toHaveLength(0);
 await page.screenshot({path:info.outputPath('settlement-blocked-desktop.png'),fullPage:true});
});

test('The Head opens the blocked liquidation from Inbox Updates into Budget review', async ({ page }) => {
 test.setTimeout(120000);
 const state = phase16FinancialState();
 const item = { ...state.liquidations[0], leader_decided_by: '00000000-0000-4000-8000-000000000003' };
 state.liquidations[0] = item;
 const fixture = await phase16FinancialFixture(page, 'head', state);
 await page.route('**/rest/v1/notifications*', route => route.fulfill({ json: [{
  id: 'staffing-alert', user_id: fixture.id, type: 'petty_cash_settlement_blocked',
  title: 'Settlement needs an Accounting Officer', message: `${item.liquidation_number} is waiting for settlement.`,
  financial_record_id: item.id, financial_record_type: 'settlement_staffing', read: false, created_at: '2026-11-06T00:00:00Z',
 }] }));
 const recordYear = 2025;
 await page.route(/\/rest\/v1\/(petty_cash_liquidations|petty_cash_requests|department_fiscal_budgets)\?/, route => {
  const url = new URL(route.request().url());
  const fields = url.searchParams.get('select');
  const record = fields === 'request_id' ? { request_id: item.request_id }
   : fields === 'fiscal_budget_id' ? { fiscal_budget_id: 'historical-budget' }
   : fields === 'fiscal_year' ? { fiscal_year: recordYear } : null;
  return record ? route.fulfill({ json: [record] }) : route.fallback();
 });
 let approved = false;
 await page.route('**/rest/v1/rpc/approve_liquidation_staffing_escalation', route => {
  const request = route.request().postDataJSON();
  expect(request.p_liquidation_id).toBe(item.id);
  expect(request.p_fingerprint).toBe('current-version');
  approved = true;
  return route.fulfill({ json: request.p_idempotency_key });
 });
 await page.route('**/rest/v1/rpc/get_liquidation_independent_review', route => route.fulfill({ json: {
  liquidationId: item.id, version: item.version, required: true, current: false, canReview: false,
  canSettle: false, review: null, candidates: [], eligibleSettlers: 0, escalationRequired: true, headAlertStatus: 'notified',
  headEscalationApproved: approved, headEscalationFingerprint: approved ? null : 'current-version',
 } }));
 await page.goto('/inbox?page=Updates');
 await page.getByRole('region', { name: 'Recent updates' }).getByRole('button', { name: 'Open update' }).click();
 const packageCard = page.locator(`#independent-review-${item.id}`);
 await expect(packageCard).toBeFocused({ timeout: 45000 });
 await expect(page.getByText('FY 2025', { exact: true })).toBeVisible();
 await expect(page.getByText('1 awaiting review', { exact: true })).toBeVisible();
 await expect(packageCard).toContainText('You already approved the receipts.');
 await packageCard.getByRole('button', { name: 'Approve', exact: true }).click();
 const dialog = page.getByRole('dialog', { name: 'Approve this liquidation review?' });
 await dialog.getByLabel('Review findings').fill('Receipts verified.');
 await dialog.getByRole('button', { name: 'Yes, approve' }).click();
 await expect(packageCard.getByText('Head review approved · settlement pending')).toBeVisible();
 await expect(page.getByText('0 awaiting review', { exact: true })).toBeVisible();
 await expect(page.getByText('1 waiting for an eligible Accounting Officer')).toBeVisible();
 expect(state.writes).toHaveLength(0);
});
