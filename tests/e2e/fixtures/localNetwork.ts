import type { Page } from "@playwright/test";

/** Own the network baseline only for intercepted synthetic browser fixtures. */
export async function establishLocalNetwork(page: Page): Promise<void> {
  // Chromium skips installing an already-false offline override. Cycle before
  // navigation so localhost fixtures have an explicit online transport.
  await page.context().setOffline(true);
  await page.context().setOffline(false);
}
