import { expect, test, type Page } from "@playwright/test";
import { WORKFLOW_WALKTHROUGHS } from "../../src/app/features/authentication/workflow-preview/walkthroughSteps";
import { SCENE_SECONDS } from "../../src/app/features/authentication/workflow-preview/useWorkflowPlayback";

async function ready(page: Page, id: string) {
  const frame = page.frameLocator('iframe[title="eFlow sample screen"]');
  await expect(frame.locator("body")).toHaveAttribute("data-walkthrough-ready", id, { timeout: 45_000 });
  return frame;
}

for (const width of [1440, 390]) {
  test(`both login walkthroughs render the actual tabs and dialogs at ${width}px`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto("/");
    await page.locator("#login-email").fill("person@example.test");
    await page.evaluate(() => localStorage.setItem("walkthrough-parent-record", "preserve"));
    for (const [title, kind] of [["Interdepartmental flow", "interdepartmental"], ["Within-office flow", "department"]] as const) {
      await page.getByRole("button", { name: new RegExp(title) }).click();
      const dialog = page.getByRole("dialog", { name: title });
      const annual = await ready(page, "office-budget");
      await expect(annual.locator(".eflow-app-shell")).toBeVisible();
      await expect(annual.getByRole("heading", { name: "Annual office budget", exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "Pause flow" }).click();
      const chapters = dialog.getByRole("combobox", { name: "Jump to chapter" });
      const timeline = dialog.getByRole("slider", { name: "Walkthrough timeline" });
      const seek = async (id: string) => {
        await timeline.fill(String(WORKFLOW_WALKTHROUGHS[kind].findIndex(scene => scene.id === id) * SCENE_SECONDS));
        return ready(page, id);
      };
      await chapters.selectOption("Project team");
      await ready(page, kind === "interdepartmental" ? "add-office" : "office-team");
      if (kind === "interdepartmental") {
        const offices = await seek("invite-person");
        await expect(offices.getByRole("dialog", { name: "Invite people · Community Training Center" })).toBeVisible();
        await expect(offices.getByLabel("Email address")).toHaveValue("lia@example.test");
      }
      const settlement = await seek("settlement");
      await expect(settlement.getByRole("button", { name: "Settle & post", exact: true })).toBeVisible();
      await expect(settlement.getByText("₱3,500.00 expense", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("region", { name: "Scene caption" })).toBeInViewport({ ratio: 1 });
      expect(await dialog.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(width);
      const child = page.frames().find(frame => frame.parentFrame());
      expect(await child!.evaluate(() => localStorage.getItem("walkthrough-parent-record"))).toBeNull();
      await dialog.getByRole("button", { name: "Close flow preview" }).click();
      await expect(page.locator("#login-email")).toHaveValue("person@example.test");
      expect(await page.evaluate(() => localStorage.getItem("walkthrough-parent-record"))).toBe("preserve");
    }
  });
}

const scenes = WORKFLOW_WALKTHROUGHS.interdepartmental.map(scene => scene.id).concat("office-team");
for (let group = 0; group < scenes.length; group += 5) {
  const batch = scenes.slice(group, group + 5);
  test(`actual app scene preparation · ${batch.join(", ")}`, async ({ page }) => {
    test.setTimeout(200_000);
    const external: string[] = [];
    page.on("request", request => {
      if (/\/(rest|auth|storage)\/v1\//.test(request.url())) external.push(request.url());
    });
    for (const id of batch) {
      await page.goto("/walkthrough.html?scene=" + id);
      await expect.poll(async () => await page.locator("body").getAttribute("data-walkthrough-error") || await page.locator("body").getAttribute("data-walkthrough-ready"), { timeout: 45_000 }).toBe(id);
      if (id === "accept-invite") await expect(page.getByLabel("Full name")).toHaveValue("Lia Santos");
      else await expect(page.locator(".eflow-app-shell")).toBeVisible();
    }
    expect(external).toEqual([]);
  });
}
