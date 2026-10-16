import type { Page } from '@playwright/test';
import { phase16FinancialFixture } from './phase16Financial';

export async function globalUiP5bFixture(page: Page, role:'head'|'accounting_staff'='accounting_staff', theme:'light'|'dark'='light', empty=false) {
  const records=await phase16FinancialFixture(page,role);
  records.fixture.tasks[0].title='Community outreach across municipal planning, coordination and neighborhood service offices with a long distinguishing work title';
  records.state.requests[0].purpose='Materials, delivery and documented coordination for neighborhood outreach with a long descriptive financial purpose';
  if(empty) records.state.liquidations[0].status='approved';
  await page.route('**/rest/v1/user_preferences*',route=>route.fulfill({json:{user_id:records.fixture.id,theme,created_at:'2026-10-14T00:00:00Z',updated_at:'2026-10-14T00:00:00Z'}}));
  return records;
}
