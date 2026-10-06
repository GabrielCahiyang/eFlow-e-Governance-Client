import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
test("production task-inspector chunk failure retains context and retries without a page reload", async ({
  page,
}) => {
  const records = await projectWorkspaceFixture(page, "head", false, {
    landingOnly: true,
  });
  await page.goto(
    `/projects?page=Projects&project=${records.project}&view=tasks`,
  );
  await expect(
    page.getByRole("region", { name: "Project main table" }),
  ).toBeVisible();
  let failed = false;
  await page.route(/\/assets\/TaskInspector-[^/]+\.js$/, (route) => {
    if (!failed) {
      failed = true;
      return route.abort();
    }
    return route.continue();
  });
  await page
    .getByRole("button", {
      name: "Open Prepare community assessment",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry loading view" }),
  ).toBeVisible();
  expect(failed).toBe(true);
  const url = page.url();
  await page.getByRole("button", { name: "Retry loading view" }).click();
  await expect(
    page.getByRole("dialog", {
      name: "Task details: Prepare community assessment",
      exact: true,
    }),
  ).toBeVisible();
  expect(page.url()).toBe(url);
});
