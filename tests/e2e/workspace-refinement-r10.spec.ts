import { test, expect, type Page } from "@playwright/test";
import { personalWorkspaceFixture } from "./fixtures/personalWorkspace";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

async function workFixture(page: Page,dark=false) {
  const records = await personalWorkspaceFixture(page, { seed: true,theme:dark?'dark':'light' });
  const dueToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  records.members.push({
    user_id: "00000000-0000-4000-8000-000000000002",
    name: "Jordan Reviewer",
    access: "member",
    state: "active",
    eligible: true,
  });
  Object.assign(records.tasks[0], {
    assigned_to: "00000000-0000-4000-8000-000000000099",
    recommendation_lead_id: null,
    team_member_ids: [],
    deadline: "2026-10-09",
  });
  records.personalTasks.push({
    id: "72000000-0000-4000-8000-000000000001",
    project_id: records.projectId,
    title: "Private research task",
    lead_id: records.id,
    reviewer_id: null,
    status: "todo",
    progress: 12,
    note: "",
    review_note: "",
    revision: 1,
  });
  const node = (root: string, kind: "office" | "personal") => ({
    id:
      kind === "office"
        ? "73000000-0000-4000-8000-000000000001"
        : "73000000-0000-4000-8000-000000000002",
    task_id: root,
    parent_subtask_id: "73000000-0000-4000-8000-000000000099",
    lead_id: records.id,
    title:
      kind === "office"
        ? "Depth eight Office evidence"
        : "Private research child",
    assigned_to_ids: [records.id],
    sibling_order: 0,
    depth: 8,
    due_date: dueToday,
    is_standalone: true,
    status: "todo",
    percent_complete: 10,
    can_manage: false,
    can_appoint: false,
    can_order: false,
    can_work: true,
    can_review: false,
  });
  const officeNode = node(String(records.tasks[0].id), "office"),
    personalNode = node(String(records.personalTasks[0].id), "personal");
  const branch=(selected:typeof officeNode,personal:boolean)=>{
    const ancestors=Array.from({length:7},(_,i)=>({...selected,id:`${personal?'750':'740'}00000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,title:`${personal?'Personal':'Office'} ancestor ${i+1}`,depth:i+1,parent_subtask_id:i?`${personal?'750':'740'}00000-0000-4000-8000-${String(i).padStart(12,'0')}`:null,lead_id:'00000000-0000-4000-8000-000000000099',assigned_to_ids:['00000000-0000-4000-8000-000000000099'],can_work:false}));
    selected.parent_subtask_id=ancestors[6].id;
    return [...ancestors,selected];
  };
  const officeBranch=branch(officeNode,false),personalBranch=branch(personalNode,true);
  records.subtasks.push({
    ...officeNode,
    assigned_to: records.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await page.route("**/rest/v1/subtasks?**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("id");
    if (!id?.startsWith("eq.")) return route.fallback();
    const subtask = records.subtasks.find((t) => t.id === id.slice(3));
    return route.fulfill({ json: subtask || null });
  });
  let ended = false;
  await page.route("**/rest/v1/rpc/r7_*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      payload = route.request().postDataJSON() || {};
    if (op === "r7_office_work_roots")
      return route.fulfill({ json: ended ? [] : [records.tasks[0]] });
    if (op === "r7_pending_subtask_reviews" || op === "r7_personal_work_roots")
      return route.fulfill({ json: [] });
    if (op === "r7_work_tree") {
      const personal = payload.p_root === records.personalTasks[0].id;
      const assigned = personal || payload.p_root === records.tasks[0].id;
      return route.fulfill({
        json: {
          root: {
            id: payload.p_root,
            project: personal ? records.projectId : records.project,
            office: personal ? null : records.org,
            lead: personal?records.id:records.tasks.find(t=>t.id===payload.p_root)?.assigned_to||null,
            kind: personal ? "personal" : "office",
            open: payload.p_root !== records.tasks[2].id,
            people: [records.id],
            due: null,
          },
          revision: 1,
          can_manage: false,
          can_transfer: false,
          nodes: assigned?(personal?personalBranch:officeBranch).map(n=>ended&&n.id===officeNode.id?{...n,lead_id:null,assigned_to_ids:[],can_work:false}:n):[],
          people: [{ id: records.id, name: "Alex Rivera", eligible: !ended },{id:'00000000-0000-4000-8000-000000000099',name:'Other colleague',eligible:true}],
          leaf_total: assigned ? 1 : 0,
          leaf_completed: 0,
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { code: "PGRST202", message: "No synthetic operation" },
    });
  });
  await page.goto("/my-work");
  await expect(
    page.getByRole("heading", { name: "My Work", exact: true, level: 1 }),
  ).toBeVisible();
  return {
    ...records,
    officeNode,
    personalNode,
    end: () => {
      ended = true;
      records.revoke();
      Object.assign(records.tasks[1], {
        assigned_to: null,
        recommendation_lead_id: null,
        team_member_ids: [],
      });
    },
  };
}
test.beforeEach(async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("R10 cross-workspace feed retains four destinations, filters, context, history and Back/Forward", async ({
  page,
}, info) => {
  const records = await workFixture(page);
  const destinations = page.getByRole("navigation", {
    name: "My Work destinations",
  });
  await expect(destinations.getByRole("button")).toHaveCount(4);
  await expect(page.locator("[data-work-key]")).toHaveCount(2);
  await expect(page.locator('[data-work-key^="personal-task:"]')).toContainText(
    "Private research",
  );
  await page.getByLabel("Workspace scope").selectOption(records.org);
  await expect(page.locator("[data-work-key]")).toHaveCount(1);
  await page.getByLabel("Workspace scope").selectOption("");
  await destinations
    .getByRole("button", { name: "Subtasks", exact: true })
    .click();
  await expect(page.locator("[data-work-key]")).toHaveCount(2);
  await expect(page.locator('[data-work-key^="office-node:"]')).toContainText(
    "Depth 8",
  );
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator("[data-work-key]")).toHaveCount(2);
  await page
    .getByRole("searchbox", { name: "Search personal work" })
    .fill("Office evidence");
  await expect(page.locator("[data-work-key]")).toHaveCount(1);
  await page.goBack();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.locator("[data-work-key]")).toHaveCount(2);
  await page.goForward();
  await expect(page.getByRole("searchbox")).toHaveValue("Office evidence");
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "All my work", exact: true }).click();
  await destinations
    .getByRole("button", { name: "History", exact: true })
    .click();
  await expect(page.locator("[data-work-key]")).toHaveCount(1);
  await page.getByRole("checkbox", { name: /Recently completed/ }).check();
  await expect(page.locator("[data-work-key]")).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("r10-history-desktop.png"),
    fullPage: true,
  });
  await destinations
    .getByRole("button", { name: "Assigned work", exact: true })
    .click();
  await page.getByRole("button", { name: "Work tools" }).click();
  for (const tool of [
    "Deadline calendar",
    "Performance",
    "Work Report",
    "Open Inbox",
  ])
    await expect(
      page.getByRole("menuitem", { name: tool, exact: true }),
    ).toBeVisible();
});

test("R10 nested inspectors open the selected branch, protect drafts and restore focus at 320px dark", async ({
  page,
}, info) => {
  await page.emulateMedia({colorScheme:'dark'});
  const records = await workFixture(page,true);
  await page.setViewportSize({ width: 320, height: 950 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const destinations = page.getByRole("navigation", {
    name: "My Work destinations",
  });
  await destinations
    .getByRole("button", { name: "Subtasks", exact: true })
    .click();
  const office = page.locator(
    `[data-work-key="office-node:${records.officeNode.id}"]`,
  );
  await office.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toContainText("Depth eight Office evidence");
  await page.keyboard.press("Escape");
  await expect(office).toBeFocused();
  const personal = page.locator(
    `[data-work-key="personal-node:${records.personalNode.id}"]`,
  );
  await expect(personal).toHaveCSS('background-color','rgb(20, 46, 42)');
  await personal.click();
  const inspector = page.getByRole("dialog", {
    name: "Personal subitem · Private research child",
  });
  await expect(inspector.locator('[data-selected-work="true"]')).toContainText(
    "Private research child",
  );
  await inspector
    .getByRole("button", {
      name: "Progress Private research child",
      exact: true,
    })
    .click();
  await inspector.getByLabel("Note / feedback").fill("Unsaved nested progress");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(inspector.getByLabel("Note / feedback")).toHaveValue(
    "Unsaved nested progress",
  );
  await page.screenshot({
    path: info.outputPath("r10-nested-draft-320-dark.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(personal).toBeFocused();
});

test("R10 personal root execution opens in context and protects its staffing draft", async ({
  page,
}) => {
  await workFixture(page);
  const origin = page.locator('[data-work-key^="personal-task:"]');
  await origin.click();
  const inspector = page.getByRole("dialog", { name: "Personal task details" });
  await expect(inspector).toContainText("Private research task");
  await expect(
    inspector.getByRole("button", { name: "Record progress", exact: true }),
  ).toBeVisible();
  await inspector
    .getByRole("button", { name: "Staff Private research task", exact: true })
    .click();
  await inspector
    .getByLabel("Reviewer for Private research task")
    .selectOption("00000000-0000-4000-8000-000000000002");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(
    inspector.getByLabel("Reviewer for Private research task"),
  ).toHaveValue("00000000-0000-4000-8000-000000000002");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(origin).toBeFocused();
});

test("R10 access removal drops actionable work while authorized completed history remains", async ({
  page,
}, info) => {
  const records = await workFixture(page);
  await expect(page.locator("[data-work-key]")).toHaveCount(2);
  records.end();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("eflow-project-access-changed")),
  );
  await expect(page.locator("[data-work-key]")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "My Work destinations" })
    .getByRole("button", { name: "Subtasks", exact: true })
    .click();
  await expect(page.locator("[data-work-key]")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "My Work destinations" })
    .getByRole("button", { name: "History", exact: true })
    .click();
  await expect(page.locator("[data-work-key]")).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("r10-access-ended-history.png"),
    fullPage: true,
  });
});

test("R10 Home opens scoped Overview with real totals and personal content stays separate", async ({
  page,
}, info) => {
  const records = await workFixture(page);
  await page.goto(`/home?workspace=${records.personalId}`);
  const overview = page.getByRole("region", {
    name: "Workspace Overview",
    exact: true,
  });
  await expect(
    overview.getByRole("heading", { name: "Workspace Overview", exact: true }),
  ).toBeVisible();
  await expect(overview).toContainText("Private research");
  await expect(
    overview.getByRole("button", { name: "Active projects", exact: false }),
  ).toContainText("1");
  await expect(
    overview.getByRole("button", { name: "Private project", exact: false }),
  ).toBeVisible();
  await expect(overview).not.toContainText("Community outreach");
  await expect(page.getByText("Getting Started", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: info.outputPath("r10-personal-overview.png"),
    fullPage: true,
  });
  await page.goto(`/overview?workspace=${records.org}`);
  await expect(overview).toContainText("Planning Office");
  await expect(
    overview.getByRole("button", { name: "Community outreach", exact: false }),
  ).toBeVisible();
  await expect(overview).not.toContainText("Private project");
  await page.screenshot({
    path: info.outputPath("r10-office-overview.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 950 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: info.outputPath("r10-overview-320.png"),
    fullPage: true,
  });
});

test("R10 source denial preserves partial work and withholds incomplete Overview totals until retry", async ({
  page,
}, info) => {
  await workFixture(page);
  let denied = true;
  await page.route("**/rest/v1/subtasks?**", (route) =>
    denied
      ? route.fulfill({
          status: 403,
          json: { message: "Subitem coverage interrupted" },
        })
      : route.fallback(),
  );
  await page.getByRole("button", { name: "Refresh work", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Subitem coverage interrupted",
  );
  await expect(page.locator("[data-work-key]")).toHaveCount(2);
  await page.goto("/overview");
  const overview = page.getByRole("region", {
    name: "Workspace Overview",
    exact: true,
  });
  await expect(overview.getByRole("alert")).toContainText(
    "totals are unavailable",
  );
  await expect(
    overview.getByRole("button", { name: "Active projects", exact: false }),
  ).toContainText("Unavailable");
  await page.screenshot({
    path: info.outputPath("r10-overview-partial-error.png"),
    fullPage: true,
  });
  denied = false;
  await overview
    .getByRole("button", { name: "Retry overview sources" })
    .click();
  await expect(overview.getByRole("alert")).toHaveCount(0);
  await expect(
    overview.getByRole("button", { name: "Active projects", exact: false }),
  ).toContainText("1");
});

test("R10 Admin Home keeps the administrative landing and acquires no operational work", async ({
  page,
}) => {
  await projectWorkspaceFixture(page, "admin", false, { landingOnly: true });
  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "User Management", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "My Work", exact: true, level: 1 }),
  ).toHaveCount(0);
});

test('R10 retained Office tools return from a personal workspace to the canonical Office',async({page})=>{
 const records=await workFixture(page);await page.goto(`/my-work?workspace=${records.personalId}`);
 await expect(page.getByRole('heading',{name:'My Work',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'Work tools',exact:true}).click();await page.getByRole('menuitem',{name:'Deadline calendar',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Deadlines',exact:true,level:1})).toBeVisible();
 expect(new URL(page.url()).searchParams.get('workspace')).toBe(records.org);
});
