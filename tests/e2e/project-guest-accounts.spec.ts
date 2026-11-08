import { expect, test } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

for (const width of [1440, 390]) test(`Admin project guest lifecycle at ${width}px`, async ({page}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({width,height:1000});
  await projectWorkspaceFixture(page,'admin');
  let actions: Record<string, unknown>[] = [];
  let failNext = false;
  const base = {sponsor_office:'Planning Office',unassigned_since:new Date().toISOString(),deactivated_at:null,deactivation_reason:null,registered_at:new Date().toISOString(),finance_open:false,projects:[]};
  const guests = [
    {...base,user_id:'guest-1',full_name:'Invited specialist',email:'guest@example.test',is_active:false,deactivates_at:null},
    {...base,user_id:'guest-2',full_name:'Waiting guest',email:'waiting@example.test',is_active:true,deactivates_at:new Date(Date.now()+86400000).toISOString()},
    {...base,user_id:'guest-3',full_name:'Cash recipient',email:'cash@example.test',is_active:true,finance_open:true,deactivates_at:new Date(Date.now()-86400000).toISOString()},
    {...base,user_id:'guest-4',full_name:'Assigned guest',email:'assigned@example.test',is_active:true,projects:[{id:'project',title:'Seminar'}],deactivates_at:null},
  ];
  await page.route('**/rest/v1/rpc/admin_project_guests', route => route.fulfill({json:guests}));
  await page.route('**/rest/v1/rpc/admin_project_guest_history', route => route.fulfill({json:[{id:'event',action:'auto_deactivated',reason:'No active project for seven days.',created_at:new Date().toISOString(),actor:'System'}]}));
  await page.route('**/rest/v1/rpc/admin_set_project_guest_state', async route => {
    const body=route.request().postDataJSON();
    if (failNext) {failNext=false;return route.fulfill({status:400,json:{code:'P0001',message:'Settle this guest’s open cash responsibility before deactivating the account.'}});}
    actions.push(body);
    const guest=guests.find(g=>g.user_id===body.p_user)!;
    guest.is_active=body.p_active;guest.deactivates_at=body.p_active?new Date(Date.now()+7*86400000).toISOString():null;
    await route.fulfill({json:null});
  });
  await page.getByRole('tab',{name:'Project guests',exact:true}).click();
  const table=page.getByRole('region',{name:'Project guests table',exact:true});
  await expect(table.getByText('guest@example.test',{exact:true})).toBeVisible();
  await expect(table.getByText('Cleanup paused · open cash',{exact:true})).toBeVisible();
  await expect(table.getByRole('row').filter({hasText:'Cash recipient'}).getByRole('button',{name:'Deactivate',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/Deactivating soon/}).click();
  await expect(table.getByText('waiting@example.test',{exact:true})).toBeVisible();
  await expect(table.getByText('cash@example.test',{exact:true})).toHaveCount(0);
  await page.getByLabel('Guest status filter').selectOption('all');
  await table.getByRole('row').filter({hasText:'Invited specialist'}).getByRole('button',{name:'Reactivate',exact:true}).click();
  const confirm=page.getByRole('dialog',{name:'Reactivate this guest account?'});
  await expect(confirm.getByRole('button',{name:'Reactivate for 7 days',exact:true})).toBeDisabled();
  await confirm.getByLabel('Reason',{exact:true}).fill('New project starts this week');
  await confirm.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(actions).toHaveLength(0);
  await table.getByRole('row').filter({hasText:'Invited specialist'}).getByRole('button',{name:'Reactivate',exact:true}).click();
  await confirm.getByLabel('Reason',{exact:true}).fill('New project starts this week');
  await confirm.getByRole('button',{name:'Reactivate for 7 days',exact:true}).click();
  await expect(confirm).toHaveCount(0);
  await expect.poll(()=>actions.length).toBe(1);
  expect(actions[0]).toMatchObject({p_user:'guest-1',p_active:true,p_reason:'New project starts this week'});
  await expect(table.getByRole('row').filter({hasText:'Invited specialist'}).getByText('Deactivates in 7 days')).toBeVisible();
  await table.getByRole('row').filter({hasText:'Invited specialist'}).getByRole('button',{name:'View details',exact:true}).click();
  const details=page.getByRole('dialog',{name:'Guest account details'});
  await expect(details.getByText('Automatically deactivated',{exact:true})).toBeVisible();
  await expect(details.getByText('No active project for seven days.',{exact:true})).toBeVisible();
  await details.getByRole('button',{name:'Close',exact:true}).click();
  await table.getByRole('row').filter({hasText:'Invited specialist'}).getByRole('button',{name:'Deactivate',exact:true}).click();
  const deactivate=page.getByRole('dialog',{name:'Deactivate this guest account?'});
  await deactivate.getByLabel('Reason',{exact:true}).fill('The engagement has ended');
  failNext=true;
  await deactivate.getByRole('button',{name:'Deactivate account',exact:true}).click();
  await expect(deactivate.locator('[role=alert][data-tone=error]')).toContainText('open cash responsibility');
  await expect(deactivate.getByLabel('Reason',{exact:true})).toHaveValue('The engagement has ended');
  expect(actions).toHaveLength(1);
  await deactivate.getByRole('button',{name:'Deactivate account',exact:true}).click();
  await expect(deactivate).toHaveCount(0);
  await expect.poll(()=>actions.length).toBe(2);
  await expect(table.getByRole('row').filter({hasText:'Invited specialist'}).getByRole('button',{name:'Reactivate',exact:true})).toBeVisible();
  guests[3].projects=[];guests[3].deactivates_at=new Date(Date.now()+7*86400000).toISOString();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(table.getByRole('row').filter({hasText:'Assigned guest'}).getByText('No active project',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Office accounts',exact:true}).click();
  await expect(page.getByRole('button',{name:'Create LEDIPO User',exact:true})).toBeVisible();
});

test('Head cannot see the project guest account controls', async({page}) => {
  await projectWorkspaceFixture(page,'head');
  await page.goto('/users?page=All%20Users');
  await expect(page.getByRole('tab',{name:'Project guests',exact:true})).toHaveCount(0);
});
