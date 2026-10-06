import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
import { phase16FinancialFixture } from "./fixtures/phase16Financial";

test.setTimeout(180_000);
const baseline = process.env.EFLOW_RELEASE_BASELINE === "1";
const widths = [320, 390, 768, 1024, 1440];
async function audit(page: Page, info: TestInfo, state: string) {
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const findings = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({ target: n.target, detail: n.failureSummary })),
  }));
  await info.attach(`${state}-a11y`, {
    body: JSON.stringify(findings, null, 2),
    contentType: "application/json",
  });
  if (!baseline)
    expect(
      findings.filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  await info.attach(`${state}-layout`, {
    body: JSON.stringify({ overflow, width: page.viewportSize()?.width }),
    contentType: "application/json",
  });
  if (!baseline) {
    expect(overflow).toBe(false);
    const utilitiesFit = await page.evaluate(() => {
      const leading = document
        .querySelector(".eflow-topbar__leading")
        ?.getBoundingClientRect();
      const utilities = document
        .querySelector(".eflow-topbar__utilities")
        ?.getBoundingClientRect();
      return Boolean(
        leading && utilities && leading.right <= utilities.left + 1,
      );
    });
    expect(utilitiesFit, "top bar utilities must not overlap the brand").toBe(
      true,
    );
  }
}

for (const role of ["head", "member", "accounting_staff", "admin"] as const)
  test(`${role}: responsive canonical workspace and mobile navigation`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (role === "accounting_staff") {
      await phase16FinancialFixture(page);
      await page.goto("/general-journal?page=General%20Journal");
      await expect(
        page.getByRole("button", { name: "Refresh journal", exact: true }),
      ).toBeVisible();
    } else {
      const data = await projectWorkspaceFixture(page, role, false, {
        landingOnly: true,
        leading: true,
      });
      if (role === "head") {
        await page.goto(
          `/projects?page=Projects&project=${data.project}&view=tasks`,
        );
        await expect(
          page.getByRole("region", { name: "Project main table" }),
        ).toBeVisible();
      } else if (role === "admin") {
        await page.goto("/users?page=All%20Users");
        await expect(
          page.getByText("Account directory", { exact: true }),
        ).toBeVisible();
      } else {
        await page.goto("/tasks?page=My%20Tasks");
        await expect(
          page.getByRole("heading", { name: "My Work", exact: true }),
        ).toBeVisible();
      }
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      if (role === "accounting_staff" && !baseline) {
        const views = page.getByRole("navigation", { name: "Accounting views" });
        await expect(views.getByRole("button", { name: "Journal", exact: true })).toHaveAttribute("aria-current", "page");
        await expect.poll(() => views.getByRole("button").evaluateAll(buttons => buttons.every(button => {
          const range = document.createRange();
          range.selectNodeContents(button);
          const text = range.getBoundingClientRect();
          const bounds = button.getBoundingClientRect();
          return text.left >= bounds.left && text.right <= bounds.right && bounds.right <= innerWidth;
        })), { message: "Accounting view labels must fit their own reachable buttons" }).toBe(true);
      }
      await audit(page, info, `${role}-${width}`);
      await page.screenshot({
        path: info.outputPath(`${role}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      if (width < 1024) {
        const bar = page.getByRole("navigation", {
          name: "Mobile primary navigation",
        });
        await expect(bar).toBeInViewport();
        if (role === "admin")
          await expect(
            bar.getByRole("button", { name: "Projects", exact: true }),
          ).toHaveCount(0);
        await bar.getByRole("button", { name: "More", exact: true }).click();
        const navigation = page.getByRole("dialog", {
          name: "Navigation",
          exact: true,
        });
        await expect(navigation).toBeVisible();
        await navigation.press("Escape");
        await expect(navigation).not.toBeVisible();
        if (!baseline)
          await expect(
            bar.getByRole("button", { name: "More", exact: true }),
          ).toBeFocused();
      }
    }
  });

test("task inspector remains usable across rotation, keyboard dismissal and zoom reflow", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await projectWorkspaceFixture(page, "head");
  await page
    .getByRole("button", {
      name: "Open Prepare community assessment",
      exact: true,
    })
    .click();
  const inspector = page.getByRole("dialog", {
    name: "Task details: Prepare community assessment",
    exact: true,
  });
  await expect(inspector).toBeVisible();
  await audit(page, info, "inspector-desktop");
  for (const width of [320, 768, 390]) {
    await page.setViewportSize({ width, height: 740 });
    if (!baseline) await expect(inspector).toBeInViewport();
    await audit(page, info, `inspector-${width}`);
  }
  await inspector.press("Escape");
  await expect(inspector).not.toBeVisible();
  // 640 CSS px corresponds to a 1280px window at 200% browser zoom.
  await page.setViewportSize({ width: 640, height: 450 });
  await audit(page, info, "project-200-percent-reflow");
});

test("empty projects have labeled creation and navigation", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await projectWorkspaceFixture(page, "head", false, {
    landingOnly: true,
    empty: true,
  });
  await page.goto("/projects?page=Projects");
  await expect(
    page.getByRole("button", { name: "Create project", exact: true }).first(),
  ).toBeVisible();
  await audit(page, info, "empty-projects");
});

test("dirty discussion survives rotation and forced colors, then restores its source focus", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.setViewportSize({ width: 390, height: 844 });
  await projectWorkspaceFixture(page, "member", false, { landingOnly: true });
  await page
    .getByRole("navigation", { name: "Mobile primary navigation" })
    .getByRole("button", { name: "My Work", exact: true })
    .click();
  const origin = page
    .locator("[data-personal-task]")
    .filter({ hasText: "Prepare community assessment" });
  await origin.click();
  const inspector = page.getByRole("dialog", {
    name: "Task details: Prepare community assessment",
    exact: true,
  });
  await inspector.getByRole("tab", { name: "Discussion", exact: true }).click();
  const input = inspector.getByRole("textbox", {
    name: "Task discussion comment",
  });
  await input.fill("Retained rotation draft");
  for (const width of [768, 320, 390]) {
    await page.setViewportSize({ width, height: 740 });
    await expect(input).toHaveValue("Retained rotation draft");
    await expect(inspector).toBeInViewport();
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(input).toHaveValue("Retained rotation draft");
  await page.screenshot({
    path: info.outputPath("dirty-forced-colors.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(origin).toBeFocused();
});
