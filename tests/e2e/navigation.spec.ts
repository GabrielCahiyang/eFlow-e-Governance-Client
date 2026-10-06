import { expect, test } from "@playwright/test";
import { buildShellNavigation, navigationGroupLabels } from "../../src/app/features/navigation";
import { getNavigationPath } from "../../src/app/features/navigation/navigationUrl";

interface E2EAccount {
  role: string;
  email: string;
  password: string;
}

const enabled = process.env.EFLOW_E2E === "1";
const accounts: E2EAccount[] = process.env.EFLOW_E2E_ACCOUNTS
  ? JSON.parse(process.env.EFLOW_E2E_ACCOUNTS) as E2EAccount[]
  : [];

test.describe("authenticated navigation smoke coverage", () => {
  test("requires configured test accounts", () => {
    test.skip(!enabled || accounts.length === 0, "Requires EFLOW_E2E=1 and EFLOW_E2E_ACCOUNTS test credentials.");
  });

  for (const account of accounts) {
    test(account.role + " can reach every visible sidebar destination", async ({ page }) => {
      await page.goto("/");
      await page.locator("#login-email").fill(account.email);
      await page.locator("#login-password").fill(account.password);
      await page.locator("#login-submit").click();
      await expect(page.getByRole("main", { name: "Active workspace" })).toBeVisible();

      const rail = page.getByRole('navigation', {name:'Global navigation'});
      for (const item of buildShellNavigation({role:account.role, can:()=>true, hasLeadingWork:true})) {
        const group = rail.getByRole('button', {name:item.group==='account'?'Profile':navigationGroupLabels[item.group],exact:true});
        if (!await group.count()) continue; // Effective individual grants remain authoritative.
        await group.click();
        const officeTools=page.getByText('Office tools',{exact:true});
        if(await officeTools.isVisible() && await officeTools.evaluate(element=>!element.closest('details')?.open)) await officeTools.click();
        for (const destination of item.pages) {
          const target = page.getByRole('navigation',{name:'Workspace destinations'}).getByRole('button',{name:item.pages.length===1?item.label:destination.label,exact:true}).first();
          // Projects is owned by the contextual project controller.
          if (!await target.count() && item.id==='projects') {
            await expect(page.getByRole('complementary',{name:'Projects context'})).toBeVisible();
            continue;
          }
          if (!await target.count()) continue;
          await target.click();
          await expect(target).toHaveAttribute('aria-current','page');
          expect(new URL(page.url()).pathname).toBe(getNavigationPath(item.id));
        }
      }
    });
  }
});
