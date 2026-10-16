import type { Page } from '@playwright/test';
import { projectWorkspaceFixture } from './projectWorkspace';
export async function globalUiP4Fixture(page: Page, role: 'head'|'member'|'accounting_staff'|'admin'='head', theme: 'light'|'dark'='light', empty=false) {
  const records = await projectWorkspaceFixture(page, role, false, { landingOnly:true, theme, empty });
  const people = empty ? [] : [...records.profiles, { ...records.profile, id:'00000000-0000-4000-8000-000000000010', full_name:'Maria Santos with a long distinguishing municipal planning and coordination name', email:'maria.planning.and.coordination@example.test', role:'member' }];
  const invitations = empty ? [] : [{ id:'invite-long', email:'community.research.and.project.coordination@example.test', account_role:'member', status:'pending', created_at:new Date().toISOString(), expires_at:'2030-01-01T00:00:00Z', email_delivery_status:'sent', send_count:1 }];
  const state = { budgetError:false, officeError:false };
  const sections = [{ id:'00000000-0000-4000-8000-000000000050', name:'Community coordination and supporting municipal project evidence', amount:123456.78, heldAmount:0, position:0 }];
  await page.route('**/rest/v1/**', async route => {
    const table = new URL(route.request().url()).pathname.split('/').at(-1);
    if(table==='profiles') return route.fulfill({json:route.request().headers().accept?.includes('vnd.pgrst.object')?records.profile:people});
    if(table==='department_budget_summary') return state.budgetError ? route.fulfill({status:403,json:{message:'Synthetic Budget read denied'}}) : route.fulfill({json:empty?null:{id:'71000000-0000-4000-8000-000000000001',orgId:records.org,fiscalYear:2026,status:'locked',approvedAmount:123456.78,committedAmount:0,spentAmount:0,availableAmount:123456.78,dailyPettyCashReleaseLimit:30000,perReceiptLimit:5000,liquidationDueDays:15,allowReceiptLimitOverride:false,underutilizationThreshold:75}});
    if(table==='department_fiscal_budgets') return route.fulfill({json:empty?[]:[{fiscal_year:2026,status:'locked',approved_amount:123456.78}]});
    if(table==='get_office_budget_sections') return route.fulfill({json:{sections:empty?[]:sections,version:0}});
    if(['department_budget_lines','budget_commitments','budget_ledger_entries','department_budget_adjustments','petty_cash_requests','general_journal_entries'].includes(table||''))return route.fulfill({json:[]});
    return route.fallback();
  });
  await page.route(/\/office-team$/, route => state.officeError ? route.fulfill({status:403,json:{detail:'Synthetic Office read denied'}}) : route.fulfill({json:{office_name:'Planning and community project coordination Office with a long distinguishing name',members:people}}));
  await page.route(/\/invitations$/, route => route.fulfill({json:{invitations}}));
  return { ...records, people, invitations, state };
}
