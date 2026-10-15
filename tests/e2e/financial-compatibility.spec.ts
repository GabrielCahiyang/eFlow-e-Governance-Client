import {expect,test} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';

test('historical unnumbered expenses remain visible without an invented PCV',async({page})=>{
  const fixture=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
  const budget='71000000-0000-4000-8000-000000000010',request='72000000-0000-4000-8000-000000000010',liquidation='73000000-0000-4000-8000-000000000010';
  const datasets:Record<string,unknown[]>={
    petty_cash_requests:[{id:request,request_number:47,fiscal_budget_id:budget,org_id:fixture.org,requester_id:fixture.id,cash_recipient_id:fixture.id,purpose:'Historical office supplies',status:'settled',requested_amount:50,approved_amount:50,released_amount:50,actual_spent:50,returned_amount:0,pcv_legacy:true,pcv_number:null,pcv_date:null}],
    petty_cash_liquidations:[{id:liquidation,request_id:request,version:1,declared_spent:50,returned_amount:0,note:'Historical settlement',status:'approved',submitted_by:fixture.id}],
    petty_cash_receipts:[{id:'74000000-0000-4000-8000-000000000010',liquidation_id:liquidation,vendor:'Original supplier',receipt_number:'OLD-47',receipt_date:'2025-06-03',description:'Original office supplies receipt',amount:50,file_path:`${fixture.org}/${request}/old.pdf`}],
    department_budget_lines:[],budget_commitments:[],budget_ledger_entries:[],department_budget_adjustments:[],general_journal_entries:[],work_budget_allocations:[],work_budget_allocation_lines:[],petty_cash_releases:[],petty_cash_request_attachments:[],petty_cash_request_lines:[],petty_cash_receipt_items:[],department_accounting_settings:[],department_budget_account_mappings:[],accounting_accounts:[],
  };
  await page.route('**/rest/v1/**',async route=>{
    const table=new URL(route.request().url()).pathname.split('/').at(-1)!;
    if(table==='get_office_budget_sections')return route.fulfill({json:{sections:[],version:0,itemizedCashAvailable:true}});
    if(table==='department_budget_summary')return route.fulfill({json:{id:budget,orgId:fixture.org,fiscalYear:2026,status:'locked',approvedAmount:100,committedAmount:50,spentAmount:50,availableAmount:50,dailyPettyCashReleaseLimit:30000,perReceiptLimit:5000,liquidationDueDays:15,underutilizationThreshold:75}});
    if(table==='department_fiscal_budgets')return route.fulfill({json:[{id:budget,fiscal_year:2026,status:'locked',approved_amount:100}]});
    if(table in datasets)return route.fulfill({json:datasets[table]});
    return route.fallback();
  });
  await page.goto('/office-budget?page=Office%20Budget&view=vouchers&fy=2026');
  await expect(page.getByRole('heading',{name:'Petty Cash Vouchers',exact:true})).toBeVisible();
  const table=page.getByRole('table');
  await expect(table.getByText(/Legacy · unnumbered · request 47 · PCV date not recorded/)).toHaveCount(1);
  await expect(table.getByText('Original supplier',{exact:true})).toBeVisible();
  await expect(table.getByText('2025-06-03',{exact:true})).toBeVisible();
  await expect(table.getByText('PCV 01',{exact:true})).toHaveCount(0);
});
