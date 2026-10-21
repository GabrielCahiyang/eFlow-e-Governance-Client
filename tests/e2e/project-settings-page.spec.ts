import { test, expect as baseExpect } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
const expect = baseExpect.configure({ timeout: 20_000 });
test.setTimeout(120_000);
test.use({ actionTimeout: 20_000 });

test("Settings is one URL-backed page with guarded navigation, save and responsive controls", async ({
  page,
}, info) => {
  const r = await projectWorkspaceFixture(page, "head");
  let writes = 0;
  await page.route("**/rest/v1/rpc/update_project_metadata", async (route) => {
    const p = route.request().postDataJSON();
    writes++;
    expect(p.p_expected_updated_at).toBe(r.projects[0].updated_at);
    Object.assign(r.projects[0], p.p_changes, {
      updated_at: new Date(Date.now() + writes * 1000).toISOString(),
    });
    await route.fulfill({ json: r.projects[0] });
  });
  await page.getByRole("tab", { name: "Board", exact: true }).click();
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  const settings = page.getByRole("region", {
    name: "Project settings",
    exact: true,
  });
  await expect(settings).toBeVisible();
  expect(new URL(page.url()).searchParams.get("view")).toBe("settings");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Shared project filters" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(settings).toBeVisible();
  await settings
    .getByLabel("Description", { exact: true })
    .fill("Retain this draft");
  await page.getByRole("tab", { name: "Main table", exact: true }).click();
  const discard = page.getByRole("alertdialog");
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: /Keep editing|Cancel/ }).click();
  await expect(settings.getByLabel("Description", { exact: true })).toHaveValue(
    "Retain this draft",
  );
  await settings
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    settings.getByText("Project settings saved.", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await page.getByRole("tab", { name: "Board", exact: true }).click();
  await page.goBack();
  await expect(settings).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("tab", { name: "Board", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      settings.getByRole("button", { name: "Back to project", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`settings-${width}.png`) });
  }
});

test("stale metadata returns an explicit conflict and preserves the draft without replaying the write", async ({
  page,
}) => {
  const r = await projectWorkspaceFixture(page, "head");
  let writes = 0;
  await page.route("**/rest/v1/rpc/update_project_metadata", async (route) => {
    writes++;
    Object.assign(r.projects[0], {
      title: "External project name",
      updated_at: new Date(Date.now() + 5000).toISOString(),
    });
    await route.fulfill({
      status: 409,
      json: { code: "40001", message: "Project updated elsewhere" },
    });
  });
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  const settings = page.getByRole("region", {
    name: "Project settings",
    exact: true,
  });
  await settings
    .getByLabel("Description", { exact: true })
    .fill("My retained draft");
  await settings
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    settings.getByRole("button", { name: "Use latest values", exact: true }),
  ).toBeVisible();
  await expect(settings.getByLabel("Description", { exact: true })).toHaveValue(
    "My retained draft",
  );
  await expect(
    settings.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  await settings
    .getByRole("button", { name: "Use latest values", exact: true })
    .click();
  await expect(
    settings.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue("External project name");
  expect(writes).toBe(1);
});

for (const role of ["member", "accounting_staff", "admin"] as const)
  test(`${role} Settings deep link cannot expose a save`, async ({ page }) => {
    const r = await projectWorkspaceFixture(page, role, false, {
      landingOnly: true,
    });
    await page.goto(
      `/projects?page=Projects&project=${r.project}&view=settings`,
    );
    await expect(page.locator(".eflow-app-shell")).toBeVisible();
    if (role !== "admin")
      await expect(
        page.getByRole("region", { name: "Project settings", exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toHaveCount(0);
  });

test("reloaded Add people URL has truthful copy and returns to the existing project", async ({
  page,
}) => {
  const r = await projectWorkspaceFixture(page, "head");
  await page.goto(
    `/projects?page=Projects&project=${r.project}&view=board&people=add`,
  );
  const people = page.getByRole("region", {
    name: "Add people to project",
    exact: true,
  });
  await expect(people).toBeVisible();
  await expect(people).not.toContainText("Project created");
  await page.reload();
  await expect(people).toBeVisible();
  await people
    .getByRole("button", { name: "Back to project", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.has("people")).toBe(false);
  expect(r.projects).toHaveLength(1);
});
