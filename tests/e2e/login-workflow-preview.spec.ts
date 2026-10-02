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
      const initialUrl = page.url();
      await expect(dialog.locator('[data-preview-screen="start"]')).toBeVisible();
      await expect(dialog.getByTestId("preview-spotlight")).toBeVisible();
      await dialog.getByRole("button", { name: "Create work plan", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Import a proposal", exact: true })).toBeVisible();
      await expect(dialog.locator('[data-preview-screen="upload"]')).toBeVisible();
      expect(page.url()).toBe(initialUrl);
      await dialog.getByRole("button", { name: "Previous step", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Create a proposal", exact: true })).toBeVisible();
      const range = dialog.getByRole("slider", { name: "Jump to workflow step" });
      await range.focus();
      await range.press("End");
      await expect(dialog.getByRole("heading", { name: "Archive and retain the record", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Next step", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Replay flow", exact: true })).toBeVisible();
      await expect(dialog.locator('[data-preview-screen="archived"]')).toBeVisible();
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
  await expect(dialog.getByRole("heading", { name: "Import a proposal", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Pause flow", exact: true }).click();
  await page.clock.fastForward(18000);
  await expect(dialog.getByRole("heading", { name: "Import a proposal", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /Step .*Update the draft and resend/ }).click();
  await expect(dialog.getByRole("button", { name: "Resend approval requests", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close flow preview" }).click();
  await page.clock.fastForward(18000);
  await page.getByRole("button", { name: /Interdepartmental flow/ }).click();
  await expect(page.getByRole("heading", { name: "Create a proposal", exact: true })).toBeVisible();
});

test("spotlights and walkthrough cards stay inside the example panel throughout both flows", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  for (const title of ["Interdepartmental flow", "Within-department flow"]) {
    await page.getByRole("button", { name: new RegExp(title) }).click();
    const dialog = page.getByRole("dialog", { name: title });
    const count = Number(await dialog.getByRole("slider", { name: "Jump to workflow step" }).getAttribute("max"));
    for (let index = 0; index < count; index++) {
      const spotlight = dialog.getByTestId("preview-spotlight");
      await expect(spotlight).toBeVisible();
      await expect(dialog.getByTestId("guided-tour-card")).toContainText(`Step ${index + 1} of ${count}`);
      await expect.poll(async () => spotlight.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const viewport = element.parentElement!.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 && bounds.left >= viewport.left - 1 && bounds.top >= viewport.top - 1 && bounds.right <= viewport.right + 1 && bounds.bottom <= viewport.bottom + 1;
      })).toBe(true);
      await expect.poll(async () => dialog.getByTestId("guided-tour-card").evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const frame = element.parentElement!.getBoundingClientRect();
        return bounds.left >= frame.left - 1 && bounds.top >= frame.top - 1 && bounds.right <= frame.right + 1 && bounds.bottom <= frame.bottom + 1;
      })).toBe(true);
      if (index < count - 1) await dialog.getByRole("button", { name: "Next step", exact: true }).click();
    }
    await dialog.getByRole("button", { name: "Close flow preview" }).click();
  }
});

test("resizing the preview keeps the highlighted approval control visible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Interdepartmental flow/ }).click();
  const dialog = page.getByRole("dialog", { name: "Interdepartmental flow" });
  await dialog.getByRole("button", { name: /Step .*Request department approvals/ }).click();
  await page.setViewportSize({ width: 375, height: 800 });
  const request = dialog.getByRole("button", { name: "Send approval requests", exact: true });
  await expect.poll(async () => request.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const viewport = element.closest('[data-preview-viewport]')!.getBoundingClientRect();
    return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
  })).toBe(true);
  await request.click();
  await expect(dialog.getByRole("heading", { name: "Confirm the review request", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Send for review", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Open an incoming work plan", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Review & Governance", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Approve participation", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Step .*Approve participation/ })).toBeInViewport();
});

test("both flows show the correct budget, leader, subtask, review, and accounting workspaces", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const examples = [
    ["Prepare the yearly department budget", "budget", "Planning & Allocation", "Save & lock annual budget"],
    ["Leader requests voucher funds", "leading", undefined, "Request cash"],
    ["Authorize the cash request", "reviews", "Budget", "Quick Authorize"],
    ["Record the voucher and cash handover", "accounting", undefined, "Confirm & Record Release"],
    ["Verify the voucher number", "leading", undefined, "Confirm Receipt"],
    ["Record subtask progress and evidence", "subtasks", undefined, "Save update"],
    ["Review submitted subtask evidence", "reviews", "Subtasks", "Approve evidence"],
    ["Settle the receipts and returned balance", "accounting", undefined, "Settle & post"],
    ["Submit the completed parent task", "leading", undefined, "Submit for review"],
    ["Review the parent task", "reviews", "Project Tasks", "Approve"],
  ];
  for (const title of ["Interdepartmental flow", "Within-department flow"]) {
    await page.getByRole("button", { name: new RegExp(title) }).click();
    const dialog = page.getByRole("dialog", { name: title });
    for (const [name, workspace, tab, action] of examples) {
      await dialog.getByRole("button", { name: new RegExp(`Step \\d+: ${name}$`) }).click();
      await expect(dialog.locator("[data-preview-workspace]")).toHaveAttribute("data-preview-workspace", workspace!);
      if (tab) await expect(dialog.locator("[data-preview-workspace]")).toHaveAttribute("data-preview-tab", tab);
      await expect(dialog.getByRole("button", { name: action, exact: true })).toBeVisible();
      await expect(dialog.getByRole("switch", { name: "Turn AI voice on" })).toBeVisible();
    }
    await dialog.getByRole("button", { name: "Close flow preview" }).click();
  }
});

test("voiced autoplay waits for narration and stops speech when the dialog closes", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    let pending: ReturnType<typeof setTimeout>;
    class PreviewUtterance {
      text: string; onstart?: () => void; onend?: () => void;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: PreviewUtterance });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [], cancel: () => clearTimeout(pending),
      speak: (utterance: PreviewUtterance) => { utterance.onstart?.(); pending = setTimeout(() => utterance.onend?.(), 16000); },
    } });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Within-department flow/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("switch", { name: "Turn AI voice on" }).click();
  await page.clock.fastForward(400);
  await dialog.getByRole("button", { name: "Play flow", exact: true }).click();
  await page.clock.fastForward(10000);
  await expect(dialog.getByRole("heading", { name: "Create a proposal", exact: true })).toBeVisible();
  await page.clock.fastForward(8000);
  await expect(dialog.getByRole("heading", { name: "Import a proposal", exact: true })).toBeVisible();
  await expect(dialog.getByRole("switch", { name: "Turn AI voice off" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Close flow preview" }).click();
  await page.clock.fastForward(30000);
  await page.getByRole("button", { name: /Within-department flow/ }).click();
  await expect(page.getByRole("heading", { name: "Create a proposal", exact: true })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Turn AI voice on" })).toHaveAttribute("aria-checked", "false");
});
