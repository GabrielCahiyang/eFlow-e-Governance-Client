import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';

test('Admin changes the limit and must confirm before unlocking',async({page})=>{
  await projectWorkspaceFixture(page,'admin');
  let limit=3,unlocks=0;
  let accounts=[{user_id:'00000000-0000-4000-8000-000000000002',email:'locked@example.test',full_name:'Locked person',role:'member',failed_attempts:3,locked_at:new Date().toISOString(),last_failed_at:new Date().toISOString()}];
  await page.route(/\/controlpanelEflow\/api\/admin\/login-security(?:\/|$)/,async route=>{
    const req=route.request();
    if(req.url().endsWith('/unlock')) {unlocks++;accounts=[];return route.fulfill({json:{status:'unlocked'}});}
    if(req.method()==='PATCH') {limit=req.postDataJSON().max_attempts;return route.fulfill({json:{max_attempts:limit}});}
    return route.fulfill({json:{max_attempts:limit,accounts}});
  });
  await page.goto('/users?page=Locked%20out%20accounts');
  await expect(page.getByRole('heading',{name:'Locked out accounts',exact:true})).toBeVisible({timeout:30000});
  const categories=page.getByRole('tablist',{name:'Administration tools'});
  await expect(categories.getByRole('tab')).toHaveCount(9);
  await expect(categories.getByRole('tab',{name:'People & onboarding',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByText('locked@example.test',{exact:true})).toBeVisible();
  await page.getByRole('spinbutton',{name:'Failed attempts before lockout'}).fill('5');
  await page.getByRole('group',{name:'People views'}).getByRole('button',{name:'Accounts',exact:true}).click();
  const discard=page.getByRole('alertdialog');
  await expect(discard).toBeVisible();
  await discard.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Failed attempts before lockout'})).toHaveValue('5');
  await page.getByRole('button',{name:'Save attempt limit'}).click();
  await expect.poll(()=>limit).toBe(5);
  await page.getByRole('button',{name:'Unlock account',exact:true}).click();
  const confirm=page.getByRole('alertdialog');
  await confirm.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(unlocks).toBe(0);
  await page.getByRole('button',{name:'Unlock account',exact:true}).click();
  await confirm.getByRole('button',{name:'Unlock account',exact:true}).click();
  await expect.poll(()=>unlocks).toBe(1);
  await expect(page.getByText('No locked out accounts.',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('spinbutton',{name:'Failed attempts before lockout'})).toHaveValue('5');
});

test('Head has no lockout management destination',async({page})=>{
  await projectWorkspaceFixture(page,'head');
  await page.goto('/users?page=Locked%20out%20accounts');
  await expect(page.getByRole('button',{name:'Save attempt limit'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Unlock account',exact:true})).toHaveCount(0);
});
