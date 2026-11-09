import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test("warms Office Team during startup and reuses it on the first visit", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await projectWorkspaceFixture(page, "head", false, { landingOnly: true });
  let teamReads = 0;
  let releaseTeam!: () => void;
  const teamReady = new Promise<void>(resolve => { releaseTeam = resolve; });
  await page.route(/\/controlpanelEflow\/.*\/office-team$/, async route => {
    teamReads++;
    await teamReady;
    await route.fulfill({ json: { office_name: "Planning Office", members: fixture.profiles } });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  try {
    await expect.poll(() => teamReads).toBe(1);
    await expect(page.getByRole("main", { name: "Loading eFlow" })).toBeVisible();
    await expect(page.locator(".eflow-app-shell")).toHaveCount(0);
  } finally {
    releaseTeam();
  }
  await expect(page.locator(".eflow-app-shell")).toBeVisible();
  await page.getByRole("navigation", { name: "Global navigation" })
    .getByRole("button", { name: "Workspaces", exact: true }).click();
  const destinations = page.getByRole("navigation", { name: "Workspace destinations" });
  const officeTeam = page.getByRole("heading", { name: "Office Team", exact: true });
  const visit = async () => {
    const started = performance.now();
    await destinations.getByRole("button", { name: "Office Team", exact: true }).click();
    await expect(officeTeam).toBeVisible();
    return Math.round(performance.now() - started);
  };
  const firstVisitMs = await visit();
  await destinations.getByRole("button", { name: "Workspace Overview", exact: true }).click();
  await expect(officeTeam).toHaveCount(0);
  const repeatVisitMs = await visit();
  expect(teamReads).toBe(1);
  console.info("OFFICE_TEAM_NAVIGATION", { firstVisitMs, repeatVisitMs, teamReads });
});

test("shows a responsive workspace preview while the signed-in module loads", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await projectWorkspaceFixture(page, "head", false, { landingOnly: true });
  let release!: () => void;
  const moduleReady = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/(?:SignedInApp-[\w-]+\.js|src\/app\/features\/app-shell\/SignedInApp\.tsx)(?:\?|$)/, async route => {
    await moduleReady;
    await route.continue();
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  const loader = page.getByRole("status", { name: "Getting things done" });
  const cards = loader.locator(".eflow-view-loading__cards");
  const track = loader.locator(".eflow-view-loading__track span");
  try {
    await expect(loader).toBeVisible({ timeout: 30_000 });
    await expect(track).toHaveCSS("animation-name", "eflow-view-sweep");
    await expect.poll(() => cards.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(4);
    await page.screenshot({ path: info.outputPath("workspace-loader-desktop.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => cards.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("workspace-loader-phone.png") });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(track).toHaveCSS("animation-name", "none");
    await expect(loader.locator(".eflow-view-loading__frame")).toHaveCSS("background-color", "rgb(20, 46, 42)");
    await page.screenshot({ path: info.outputPath("workspace-loader-dark.png") });
  } finally {
    release();
  }
  await expect(loader).toHaveCount(0);
  await expect(page.locator(".eflow-app-shell")).toBeVisible();
});

test("shows a loading status before application JavaScript is available", async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.route(/\/(?:src\/main\.tsx|assets\/(?:index|app)-[\w-]+\.js)(?:\?|$)/,
    route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status")).toHaveText("Getting things done");
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("img", { name: "eFlow", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Getting things done" })).toBeVisible();
  await expect(page.locator('.eflow-loading')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.getByText('LGU Ormoc City',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Loading eFlow…',{exact:true})).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("loader-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  const logo = await page.getByRole("img", { name: "eFlow", exact: true }).boundingBox();
  expect(logo!.x).toBeGreaterThanOrEqual(0);
  expect(logo!.x + logo!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath("loader-phone.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".eflow-loading-ring")).toHaveCSS("animation-name", "none");
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(page.locator('.eflow-loading')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.screenshot({ path: info.outputPath("loader-dark.png") });
});

test("login stays usable while an unopened workflow guide is unavailable", async ({ page }) => {
  // Covers Vite development modules and production chunks. A guide download
  // must never be a prerequisite for displaying the sign-in form.
  await page.route(/\/(?:WorkflowPreviewPanel[^/]*\.js|src\/app\/features\/authentication\/workflow-preview\/WorkflowPreviewPanel\.tsx)(?:\?|$)/,
    route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#login-email")).toBeVisible();
  await page.locator("#login-email").fill("person@example.test");
  await expect(page.locator("#login-email")).toHaveValue("person@example.test");
  await page.getByRole("button", { name: /Interdepartmental flow/ }).click();
  await expect(page.getByRole("button", { name: "Retry loading view" })).toBeVisible();
  await expect(page.locator("#login-email")).toHaveValue("person@example.test");
});
