import { expect, test, type Page } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test.setTimeout(60_000);
const title = "Prepare community assessment";
async function board(page: Page) {
  const records = await projectWorkspaceFixture(page, "head", false, {
    landingOnly: true,
  });
  await page.goto("/tasks?page=Task%20Board");
  await expect(
    page.getByRole("button", { name: `Open actions for ${title}` }).first(),
  ).toBeVisible();
  return records;
}
async function action(page: Page, name: string) {
  await page
    .getByRole("button", { name: `Open actions for ${title}` })
    .first()
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test("live legacy board retains details through Keep editing and discards only on acceptance", async ({
  page,
}, info) => {
  await board(page);
  await action(page, "Edit task details");
  const editor = page.getByRole("dialog", { name: title, exact: true });
  await editor
    .getByLabel("Task description", { exact: true })
    .fill("Unsaved task details");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  const discard = page.getByRole("alertdialog");
  await discard
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(
    editor.getByLabel("Task description", { exact: true }),
  ).toHaveValue("Unsaved task details");
  await page.screenshot({
    path: info.outputPath("retained-task-draft.png"),
    fullPage: true,
    animations: "disabled",
  });
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await discard.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(editor).not.toBeVisible();
});

test("typed deletion at 320px cancels without a write then sends exactly one confirmed write", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const records = await board(page);
  let deletes = 0;
  await page.route("**/rest/v1/rpc/soft_delete_task", (route) => {
    deletes++;
    const index = records.tasks.findIndex(
      (task) => task.id === route.request().postDataJSON().p_task_id,
    );
    if (index >= 0) records.tasks.splice(index, 1);
    return route.fulfill({ json: null });
  });
  await action(page, "Delete task");
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("button", { name: "Delete task", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(deletes).toBe(0);
  await expect(
    page.getByRole("button", { name: `Open actions for ${title}` }).first(),
  ).toBeFocused();
  await action(page, "Delete task");
  await dialog
    .getByLabel(`Type ${title} to confirm`, { exact: true })
    .fill(title);
  await page.screenshot({
    path: info.outputPath("mobile-typed-task-deletion.png"),
    fullPage: true,
    animations: "disabled",
  });
  await dialog
    .getByRole("button", { name: "Delete task", exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: `Task “${title}” deleted.` }),
  ).toBeVisible();
  expect(deletes).toBe(1);
});

test("required task cancellation reason has no write on Escape and is sent once on acceptance", async ({
  page,
}, info) => {
  const records = await board(page);
  const reasons: string[] = [];
  await page.route("**/rest/v1/rpc/cancel_task", (route) => {
    const input = route.request().postDataJSON();
    reasons.push(input.p_reason);
    const task = records.tasks.find((row) => row.id === input.p_task_id);
    if (task) task.status = "cancelled";
    return route.fulfill({ json: null });
  });
  await action(page, "Cancel task");
  const dialog = page.getByRole("alertdialog");
  await expect(
    dialog.getByRole("button", { name: "Cancel task", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  expect(reasons).toEqual([]);
  await action(page, "Cancel task");
  await dialog
    .getByLabel(/Cancellation reason/)
    .fill("Superseded by the approved work plan");
  await dialog
    .getByRole("button", { name: "Cancel task", exact: true })
    .click();
  await expect(
    page.getByText(`Task “${title}” cancelled.`, { exact: true }),
  ).toBeVisible();
  expect(reasons).toEqual(["Superseded by the approved work plan"]);
  await page.screenshot({
    path: info.outputPath("task-cancellation-receipt.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("lost deletion response exposes verification and prevents another write", async ({
  page,
}, info) => {
  await board(page);
  let writes = 0;
  await page.route("**/rest/v1/rpc/soft_delete_task", (route) => {
    writes++;
    return route.abort("failed");
  });
  await action(page, "Delete task");
  const dialog = page.getByRole("alertdialog");
  await dialog
    .getByLabel(`Type ${title} to confirm`, { exact: true })
    .fill(title);
  await dialog
    .getByRole("button", { name: "Delete task", exact: true })
    .click();
  await expect(page.getByText(/result needs verification/)).toBeVisible();
  await expect(page.getByText(/result needs verification/)).toBeInViewport();
  await action(page, "Delete task");
  await expect(
    page.getByText(/previous result is saved or requires verification/),
  ).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText(/previous result is saved or requires verification/),
  ).toBeInViewport();
  expect(writes).toBe(1);
  await page.screenshot({
    path: info.outputPath("uncertain-deletion-held.png"),
    fullPage: true,
    animations: "disabled",
  });
});
