import { expect, test } from "@playwright/test";

for (const width of [320, 375, 768, 1024]) {
  test(`login keeps the form and project board available at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.locator("#login-submit")).toBeVisible();
    await expect(page.getByRole("region", { name: "Interactive project preview board" })).toBeVisible();

    const passwordBounds = await page.locator("#login-password").boundingBox();
    const revealBounds = await page.getByRole("button", { name: "Show password" }).boundingBox();
    expect(passwordBounds).not.toBeNull();
    expect(revealBounds).not.toBeNull();
    expect(Math.abs(revealBounds!.y + revealBounds!.height / 2 - passwordBounds!.y - passwordBounds!.height / 2)).toBeLessThanOrEqual(4);
    expect(revealBounds!.x + revealBounds!.width).toBeLessThanOrEqual(passwordBounds!.x + passwordBounds!.width);

    const board = page.getByRole("region", { name: "Interactive project preview board" });
    const boardBounds = await board.boundingBox();
    expect(boardBounds).not.toBeNull();
    const columns = board.locator("[data-column-id]");
    await expect(columns).toHaveCount(3);
    for (const column of await columns.all()) {
      const bounds = await column.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(boardBounds!.x - 1);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(boardBounds!.x + boardBounds!.width + 1);
    }
    if (width === 320) {
      const cardList = board.locator('[data-column-id="todo"] [class*="cardList"]');
      const listMetrics = await cardList.evaluate((list) => {
        const cards = Array.from(list.children);
        cards.forEach((card) => list.appendChild(card.cloneNode(true)));
        return { viewportHeight: list.clientHeight, contentHeight: list.scrollHeight, overflowY: getComputedStyle(list).overflowY };
      });
      expect(listMetrics.overflowY).toBe("auto");
      expect(listMetrics.contentHeight).toBeGreaterThan(listMetrics.viewportHeight);
      await cardList.evaluate((list) => { list.scrollTop = list.scrollHeight; });
      expect(await cardList.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
    }

    await expect(page.getByRole("button", { name: /Choose a development account|Usage scenarios/i })).toHaveCount(0);

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  });
}

test("preview cards continue moving within the fixed columns", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const card = page.locator('[data-card-id="card-3"]');
  await expect.poll(async () => card.evaluate((element) => element.closest("[data-column-id]")?.getAttribute("data-column-id")), { timeout: 8000 }).toBe("done");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.mouse.move(0, 0);
  await expect.poll(async () => card.evaluate((element) => element.closest("[data-column-id]")?.getAttribute("data-column-id")), { timeout: 20000 }).toBe("todo");
});
