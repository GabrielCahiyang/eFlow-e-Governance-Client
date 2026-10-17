import { expect, test } from "@playwright/test";

test("shows a loading status before application JavaScript is available", async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.route(/\/(?:src\/main\.tsx|assets\/index-[\w-]+\.js)(?:\?|$)/,
    route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status")).toHaveText("Getting things ready");
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("img", { name: "eFlow", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Getting things ready" })).toBeVisible();
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
