import {expect,test} from '@playwright/test';
import {phase16FinancialFixture} from './fixtures/phase16Financial';

test('journal cents validation blocks fractions before any financial write',async({page})=>{
  const {state}=await phase16FinancialFixture(page);
  await page.getByRole('navigation',{name:'Accounting destinations',exact:true}).getByRole('button',{name:'General Journal',exact:true}).click();
  await page.getByRole('button',{name:'Post adjustment',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Post correcting journal entry',exact:true});
  await dialog.getByLabel('Reference number',{exact:true}).fill('CENTS-QA');
  await dialog.getByLabel('Memo / correction reason',{exact:true}).fill('Verify exact cents');
  await expect(dialog.getByText(/Use at most two decimal places/)).toBeVisible();
  await dialog.getByLabel('Debit line 1',{exact:true}).fill('100.004');
  await dialog.getByLabel('Credit line 2',{exact:true}).fill('100.004');
  const post=dialog.getByRole('button',{name:'Post balanced entry',exact:true});
  await expect(post).toHaveAttribute('aria-disabled','true');
  await dialog.getByLabel('Debit line 1',{exact:true}).fill('0.10');
  await dialog.getByLabel('Credit line 2',{exact:true}).fill('0.11');
  await expect(post).toHaveAttribute('aria-disabled','true');
  await dialog.getByLabel('Credit line 2',{exact:true}).fill('0.10');
  await expect(post).not.toHaveAttribute('aria-disabled','true');
  expect(state.writes).toHaveLength(0);
});
