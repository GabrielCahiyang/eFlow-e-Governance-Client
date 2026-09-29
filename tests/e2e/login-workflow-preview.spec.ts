import { expect, test } from "@playwright/test";

for (const width of [320, 768, 1440]) {
  test(`both complete workflow guides fit and remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    for (const title of ["Interdepartmental flow", "Within-department flow"]) {
      const opener = page.getByRole("button", { name: new RegExp(title) });
      if (width >= 1200) {
        const bounds = await opener.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(800);
      }
      await opener.click();
      const dialog = page.getByRole("dialog", { name: title });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: "Create a proposal", exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "Next step", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Build the work plan", exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "Previous step", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Create a proposal", exact: true })).toBeVisible();
      const range = dialog.getByRole("slider", { name: "Jump to workflow step" });
      await range.focus();
      await range.press("End");
      await expect(dialog.getByRole("heading", { name: "Archive and retain the record", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Next step", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Replay flow", exact: true })).toBeVisible();
      if (title === "Within-department flow") await expect(dialog.getByRole("button", { name: /Step .*Request department approvals/ })).toHaveCount(0);
      const dimensions = await dialog.evaluate((element) => ({ width: element.scrollWidth, visibleWidth: element.clientWidth, bottom: element.getBoundingClientRect().bottom, viewportHeight: innerHeight }));
      expect(dimensions.width).toBeLessThanOrEqual(dimensions.visibleWidth + 1);
      expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
  });
}

test("playback advances, pauses, and stops when the guide closes", async ({ page }) => {
  await page.clock.install();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Interdepartmental flow/ }).click();
  const dialog = page.getByRole("dialog", { name: "Interdepartmental flow" });
  await dialog.getByRole("button", { name: "Play flow", exact: true }).click();
  await page.clock.fastForward(9000);
  await expect(dialog.getByRole("heading", { name: "Build the work plan", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Pause flow", exact: true }).click();
  await page.clock.fastForward(18000);
  await expect(dialog.getByRole("heading", { name: "Build the work plan", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /Step .*Request department approvals/ }).click();
  await expect(dialog.getByText(/resend approval requests/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close flow preview" }).click();
  await page.clock.fastForward(18000);
  await page.getByRole("button", { name: /Interdepartmental flow/ }).click();
  await expect(page.getByRole("heading", { name: "Create a proposal", exact: true })).toBeVisible();
});
