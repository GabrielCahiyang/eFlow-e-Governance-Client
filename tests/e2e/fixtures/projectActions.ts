import { expect, type Page } from '@playwright/test';

export async function openProjectAction(page: Page, name: string) {
  await page.getByRole('button', {name:'Project actions',exact:true}).click();
  await page.getByRole('menuitem', {name,exact:true}).click();
}
export async function openCompletionRequirements(page: Page) {
  await openProjectAction(page,'View completion requirements');
  await expect(page.getByRole('dialog',{name:'Mark project complete',exact:true})).toBeVisible();
  return page.getByRole('region',{name:'Project readiness reviews',exact:true});
}
