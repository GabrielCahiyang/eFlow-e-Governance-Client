import { expect, test, type Page } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

const budgetId = "71000000-0000-4000-8000-000000000001";
async function sectionsFixture(page: Page, installed: boolean, draft = false, view = 'annual') {
  const fixture = await projectWorkspaceFixture(page, "head", false, { landingOnly: true });
  let sections = [{ id: "00000000-0000-4000-8000-000000000050", name: "Existing budget", amount: 123456.78, heldAmount: 0, position: 0 }];
  if (draft) sections = [
    {id:'00000000-0000-4000-8000-000000000050',name:'Supplies',amount:1000,heldAmount:0,position:0},
    {id:'00000000-0000-4000-8000-000000000051',name:'Travel',amount:0,heldAmount:0,position:1},
  ];
  let status = draft ? 'draft' : 'locked';
  const locks: Record<string, unknown>[] = [];
  let version = 0;
  const writes: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/**", async route => {
    const request = route.request(), table = new URL(request.url()).pathname.split("/").at(-1)!;
    const payload = request.postData() ? request.postDataJSON() : {};
    if (table === "get_office_budget_sections") return installed
      ? route.fulfill({ json: { sections, version } })
      : route.fulfill({ status: 404, json: { code: "PGRST202", message: "Function not found in schema cache" } });
    if (table === "save_office_budget_sections") {
      writes.push(payload); sections = payload.p_sections; version++;
      return route.fulfill({ json: budgetId });
    }
    if (table === 'lock_department_fiscal_budget') {
      locks.push(payload); status = 'locked';
      return route.fulfill({json:null});
    }
    if (table === "department_budget_summary") return route.fulfill({ json: {
      id: budgetId, orgId: fixture.org, fiscalYear: 2026, status,
      approvedAmount: sections.reduce((sum, s) => sum + s.amount, 0), committedAmount: 0, spentAmount: 0,
      availableAmount: 123456.78, dailyPettyCashReleaseLimit: 30000, perReceiptLimit: 5000,
      liquidationDueDays: 15, allowReceiptLimitOverride: false, underutilizationThreshold: 75,
    } });
    if (table === "department_fiscal_budgets") return route.fulfill({ json: [{ fiscal_year: 2026, status, approved_amount: sections.reduce((sum,s)=>sum+s.amount,0) }] });
    if (["department_budget_lines", "budget_commitments", "budget_ledger_entries", "department_budget_adjustments", "petty_cash_requests", "general_journal_entries"].includes(table)) return route.fulfill({ json: [] });
    return route.fallback();
  });
  await page.goto(`/office-budget?page=Office%20Budget&view=${view}&fy=2026`);
  await expect(page.getByRole("heading", { name: view === 'annual' ? "Annual office budget" : "Proposal commitment versus actual", exact: true })).toBeVisible();
  return { writes, locks };
}

test('Office Budget overview uses four distinct animated drawings on desktop and fits mobile',async({page},info)=>{
  await page.setViewportSize({width:1918,height:914});
  await sectionsFixture(page,true,false,'overview');
  const cards=[
    ['Proposal commitment versus actual','budget'],
    ['Upcoming cash releases','tasks'],
    ['Oldest outstanding cash','complete'],
    ['Recent financial activity','files'],
  ];
  const sources=[];
  for(const [heading,kind] of cards){
    const card=page.locator('section').filter({has:page.getByRole('heading',{name:heading,exact:true})}).last();
    const image=card.locator('img.eflow-empty-illustration');
    await expect(image).toHaveAttribute('data-illustration',kind);
    await expect.poll(()=>image.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
    sources.push(await image.getAttribute('src'));
  }
  expect(new Set(sources).size).toBe(4);
  await page.getByRole('heading',{name:'Proposal commitment versus actual',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('budget-overview-distinct-artwork.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('a funded budget with an unfinished row can save as draft but cannot lock until corrected',async({page},info)=>{
  const {writes,locks}=await sectionsFixture(page,true,true);
  const lock=page.getByRole('button',{name:'Save & lock annual budget',exact:true});
  await expect(lock).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Enter an amount greater than ₱0 for “Travel”.');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.getByText('Annual budget draft saved.',{exact:true})).toBeVisible();
  expect(writes).toHaveLength(1); expect(locks).toHaveLength(0);
  await page.getByLabel('Budget amount Travel',{exact:true}).fill('500');
  await expect(lock).toBeEnabled();
  await page.screenshot({path:info.outputPath('ready-to-lock.png')});
  await lock.click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Save and lock',exact:true}).click();
  await expect(page.getByText(`Budget ${budgetId} saved and locked.`,{exact:true})).toBeVisible();
  expect(writes).toHaveLength(2); expect(locks).toHaveLength(1);
});

test("unavailable sections never display an existing saved budget as zero", async ({ page }) => {
  await sectionsFixture(page, false);
  const workspace = page.locator(".eflow-budget-workspace");
  await expect(workspace.getByText("₱123,456.78", { exact: true })).toHaveCount(2);
  await expect(workspace.getByText(/No sections yet/)).toHaveCount(0);
  await expect(workspace.getByText("₱0.00", { exact: true })).toHaveCount(0);
  await expect(workspace.getByRole("button", { name: /Reclassify/ })).toHaveCount(0);
});

test("locked section adjustments update the counter and persist without duplicated writes", async ({ page }, info) => {
  const { writes } = await sectionsFixture(page, true);
  await page.getByRole("button", { name: /Reclassify/ }).click();
  await page.getByLabel(/Section name/).fill("Office Supplies");
  const amount = page.getByLabel("Budget amount Office Supplies", { exact: true });
  await amount.fill("");
  await amount.pressSequentially("1000000.50");
  await expect(amount).toHaveValue("1,000,000.50");
  await page.setViewportSize({ width: 390, height: 844 });
  await amount.scrollIntoViewIfNeeded();
  const bounds = await amount.boundingBox();
  expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390).toBe(true);
  await page.screenshot({ path: info.outputPath("money-formatting-mobile.png") });
  await amount.fill("");
  await amount.pressSequentially(".50");
  await expect(amount).toHaveValue("0.50");
  await page.setViewportSize({ width: 1280, height: 900 });
  await amount.fill("300000");
  await expect(amount).toHaveValue("300,000");
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  await page.getByLabel(/Section name/).nth(1).fill("Training");
  await page.getByLabel("Budget amount Training", { exact: true }).fill("50000");
  await expect(page.getByText("₱350,000.00", { exact: true })).toBeVisible();
  await page.getByLabel(/Required adjustment reason/).fill("Approved authority QA-reference");
  await page.getByRole("button", { name: "Record section adjustment", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Record adjustment", exact: true }).click();
  await expect(page.getByText("Section adjustment recorded.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].p_sections).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Office Supplies", amount: 300000 }), expect.objectContaining({ name: "Training", amount: 50000 })]));
  await page.reload();
  await expect(page.getByLabel(/Section name/).nth(0)).toHaveValue("Office Supplies");
  await expect(page.getByLabel(/Section name/).nth(1)).toHaveValue("Training");
  await expect(page.getByLabel("Budget amount Office Supplies", { exact: true })).toHaveValue("300,000");
  await expect(page.getByText("₱350,000.00", { exact: true })).toBeVisible();
});
