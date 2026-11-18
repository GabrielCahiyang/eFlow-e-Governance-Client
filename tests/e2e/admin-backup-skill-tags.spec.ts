import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test("Admin opens Backup separately and manages skill tags in dialogs", async ({ page }) => {
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page, "admin", false, { landingOnly: true });
  const skillTags = [
    { id: "coordination", label: "Project Coordination", position: 10, retired: false },
  ];
  let rejectedRemove = true;
  await page.route("**/rest/v1/skill_tag_definitions*", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      skillTags.push(request.postDataJSON());
      return route.fulfill({ status: 201, body: "" });
    }
    if (request.method() === "PATCH") {
      const id = new URL(request.url()).searchParams.get("id")?.slice(3);
      const tag = skillTags.find((item) => item.id === id);
      const changes = request.postDataJSON();
      if (rejectedRemove && changes.retired) {
        return route.fulfill({ status: 403, json: { message: "Removal was rejected." } });
      }
      Object.assign(tag!, changes);
      return route.fulfill({ json: { id } });
    }
    return route.fulfill({ json: skillTags });
  });

  const nav = page.getByRole("navigation", { name: "Admin Center destinations" });
  await expect(nav.getByRole("button", { name: "Account Audit", exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "Backup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Backup", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Backup", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Create backup", exact: true })).toBeVisible();

  await nav.getByRole("button", { name: "System & Maintenance", exact: true }).click();
  await page.getByRole("tab", { name: "Skill Tags", exact: true }).click();
  const edit = page.getByRole("button", { name: "Edit Project Coordination", exact: true });
  await edit.click();
  const editDialog = page.getByRole("dialog", { name: "Edit “Project Coordination”" });
  const skillName = editDialog.getByRole("textbox", { name: "Skill name" });
  await expect(skillName).toBeFocused();
  await skillName.fill("Unsaved draft");
  await page.keyboard.press("Escape");
  await expect(editDialog).toHaveCount(0);
  await expect(edit).toBeFocused();
  await edit.click();
  await expect(skillName).toHaveValue("Project Coordination");
  await skillName.fill("  Project   Planning  ");
  await editDialog.getByRole("button", { name: "Save skill tag" }).click();
  await expect(page.getByRole("button", { name: "Edit Project Planning" })).toBeVisible();

  await page.getByRole("button", { name: "Add skill tag" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add skill tag" });
  await addDialog.getByRole("textbox", { name: "Skill name" }).fill("Financial Reporting");
  await addDialog.getByRole("button", { name: "Save skill tag" }).click();
  await expect(page.getByRole("heading", { name: "Active skill tags (2)" })).toBeVisible();

  const remove = page.getByRole("button", { name: "Remove Project Planning" });
  await remove.click();
  const removal = page.getByRole("alertdialog", { name: "Remove skill tag?" });
  await removal.getByRole("button", { name: "Cancel" }).click();
  await expect(remove).toBeVisible();
  await remove.click();
  await removal.getByRole("button", { name: "Remove skill tag" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Removal was rejected." })).toBeVisible();
  await expect(remove).toBeVisible();

  rejectedRemove = false;
  await remove.click();
  await removal.getByRole("button", { name: "Remove skill tag" }).click();
  await expect(remove).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Hidden skill tags (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Restore Project Planning" }).click();
  await expect(remove).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active skill tags (2)" })).toBeVisible();
});
