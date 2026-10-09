import { expect, test, type Locator } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
test.describe.configure({ mode: "parallel" });

async function scrollToEnd(region: Locator) {
  await region.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => region.evaluate(el => { el.scrollTop = el.scrollHeight; return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop); })).toBeLessThanOrEqual(1);
}

for (const width of [320, 390, 768, 1024, 1440]) test(`R1 foundation scroll, badges and tooltip focus at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.goto("/tests/e2e/fixtures/workspaceRefinement.html");
  for (const theme of ["light", "dark", "system"] as const) {
    await page.getByRole("button", { name: `${theme} theme` }).click();
    if (theme === "system") await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => page.locator("html").evaluate(el => el.classList.contains("dark"))).toBe(theme !== "light");
    for (const label of ["Planning", "On track"]) {
      await expect.poll(() => page.getByText(label, { exact: true }).evaluate(el => {
        const style = getComputedStyle(el.parentElement!);
        const luminance = (rgb: string) => {
          const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const a = luminance(getComputedStyle(el).color), b = luminance(style.backgroundColor);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      })).toBeGreaterThanOrEqual(4.5);
    }
    const main = page.getByRole("main", { name: "Active workspace" });
    const sidebar = page.getByRole("region", { name: "Sidebar" });
    await main.evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: info.outputPath(`r1-${width}-${theme}-controls.png`) });
    const sidebarPosition = await sidebar.evaluate(el => el.scrollTop);
    await scrollToEnd(main);
    await expect(page.getByText("Final workspace content")).toBeInViewport();
    expect(await sidebar.evaluate(el => el.scrollTop)).toBe(sidebarPosition);
    await scrollToEnd(sidebar);
    await expect(sidebar.getByRole("button", { name: "Project 40", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const verticalOwners = await main.locator("*").evaluateAll(elements => elements.filter(el => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1).length);
    expect(verticalOwners).toBe(0);
    await page.screenshot({ path: info.outputPath(`r1-${width}-${theme}.png`) });
  }
  const main = page.getByRole("main");
  await main.evaluate(el => { el.scrollTop = 0; });
  const avatar = page.getByRole("img", { name: "Alex Rivera" });
  await avatar.focus();
  await expect(page.getByText("Alex Rivera", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Alex Rivera", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show all people" }).click();
  await expect(page.getByText("Maria Santos with a long participant name")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Show all people" })).toBeFocused();
  await page.getByRole("button", { name: "Columns", exact: true }).focus();
  await expect(page.getByText("Show or hide supported columns")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Task names and actions stay visible.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Columns", exact: true })).toBeFocused();
});

for (const width of [320, 390, 768, 1024, 1440]) test(`R1 actual project views keep long content contained at ${width}px`, async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const data = await projectWorkspaceFixture(page, "head", true);
  data.projects[0].title = "Long community service project title with several participating Offices and delivery commitments";
  const base = { ...data.tasks[0] };
  for (let i = 4; i <= 30; i++) data.tasks.push({ ...base, id: `40000000-0000-4000-8000-${String(i).padStart(12, "0")}`, title: `Long task name ${i} for community service delivery and assessment`, workspace_position: i });
  for (let i = 2; i <= 30; i++) data.projects.push({ ...data.projects[0], id: `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`, title: `Long Office project ${i}` });
  await page.setViewportSize({ width, height: 900 });
  let theme = "light";
  await page.route("**/rest/v1/user_preferences?**", route => route.fulfill({ json: { user_id: data.id, theme, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } }));
  for (theme of ["light", "dark"]) {
    for (const view of ["tasks", "board", "gantt", "calendar", "dashboard", "offices", "readiness", "overview", "timeline", "reports", "activity", "reviews", "workload", "signoff", "evidence", "decisions", "budget", "proposal_context"]) {
      await page.goto(`/projects?page=Projects&project=${data.project}&view=${view}`);
      await expect(page.locator(".eflow-project-command")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("heading", { name: /Long community service project/ })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")), { timeout: 15_000 }).toBe(theme === "dark");
      await expect(page.locator(".eflow-project-command > [role=status]")).toHaveCount(0);
      // Firefox's role locator stalls on the large Timeline after scrolling.
      // Keep the named, visible, unlocked main contract explicit on its DOM node.
      const main = page.locator("main#eflow-active-workspace");
      await expect(main).toHaveRole("main");
      await expect(main).toHaveAttribute("aria-label", "Active workspace");
      await expect(main).toBeVisible();
      expect(await main.evaluate(el => el.closest('[inert], [aria-hidden="true"]') === null)).toBe(true);
      await scrollToEnd(main);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${view} at ${width}`).toBe(true);
      const overflowing = await main.evaluate(el => {
        const bounds = el.getBoundingClientRect();
        return el.scrollWidth > el.clientWidth + 1 ? [...el.querySelectorAll("*")].filter(child => child.getBoundingClientRect().right > bounds.right + 1 && child.getBoundingClientRect().width > 0).slice(0, 8).map(child => ({ tag: child.tagName, classes: child.className, width: child.getBoundingClientRect().width })) : [];
      });
      expect(overflowing, `${view} at ${width} main`).toEqual([]);
      const nestedScrollers = await main.locator("*").evaluateAll(elements => elements.filter(el => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1).map(el => ({ classes: el.className, height: el.clientHeight, scrollHeight: el.scrollHeight, maxHeight: getComputedStyle(el).maxHeight, heightStyle: getComputedStyle(el).height, spilling: [...el.querySelectorAll("*")].filter(child => child.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom + 1).slice(-5).map(child => ({className: child.className, bottom: child.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom})) })));
      expect(nestedScrollers, `${view} at ${width} nested vertical scroll`).toEqual([]);
      if (width === 1440) await page.screenshot({ path: info.outputPath(`r1-project-${view}-${theme}.png`) });
    }
  }
});

test("R1 main content and sidebar reach their final item at 200 percent zoom equivalence", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: process.env.EFLOW_E2E_BASE_URL || "http://127.0.0.1:5174", viewport: { width: 720, height: 450 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("/tests/e2e/fixtures/workspaceRefinement.html");
    await scrollToEnd(page.getByRole("main"));
    await expect(page.getByText("Final workspace content")).toBeInViewport();
    await scrollToEnd(page.getByRole("region", { name: "Sidebar" }));
    await expect(page.getByRole("button", { name: "Project 40", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally { await context.close(); }
});
