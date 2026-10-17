import { expect, test } from '@playwright/test';
import { establishLocalNetwork } from './fixtures/localNetwork';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

for (const width of [1440, 390, 320]) test(`Managed activation validates passwords and keeps the invited identity at ${width}px`, async ({page}, info) => {
  await page.setViewportSize({width,height:1000});
  await establishLocalNetwork(page);
  await page.route('**/auth/v1/**',r=>r.fulfill({status:401,json:{message:'No session'}}));
  await page.routeWebSocket(/\/realtime\/v1\//,()=>{});
  await page.route('**/rest/v1/**',r=>r.fulfill({json:[]}));
  let calls: Record<string,unknown>[]=[];
  await page.route(/\/controlpanelEflow\//,async r=>{
    if (r.request().url().endsWith('/managed-account/validate')) return r.fulfill({json:{full_name:'New colleague',email:'new@example.test',office_name:'LEDIPO',account_role:'member',requested_privileged_role:null,expires_at:new Date(Date.now()+86400000).toISOString()}});
    if (r.request().url().endsWith('/managed-account/activate')) { calls.push(r.request().postDataJSON()); return r.fulfill(calls.length===1?{status:503,json:{detail:'Temporary connection failure. Retry.'}}:{json:{activated:true,next_step:'sign_in'}}); }
    return r.fulfill({json:{status:'ok'}});
  });
  await page.goto('/activate-account?token='+'a'.repeat(43));
  await expect(page.getByRole('heading',{name:'Welcome to eFlow'})).toBeVisible();
  await expect(page).toHaveURL(/\/activate-account$/);
  await expect(page.getByText('new@example.test',{exact:true})).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  const password=page.getByLabel('New password',{exact:true}), confirm=page.getByLabel('Confirm password',{exact:true});
  await password.fill('short');await confirm.fill('short');await page.getByRole('button',{name:'Activate account'}).click();await expect(page.getByRole('alert').filter({hasText:'Use a password'})).toHaveText('Use a password with 12 to 128 characters.');expect(calls).toHaveLength(0);
  await password.fill('synthetic-password');await confirm.fill('different-password');await page.getByRole('button',{name:'Activate account'}).click();await expect(page.getByRole('alert').filter({hasText:'The passwords'})).toHaveText('The passwords do not match.');expect(calls).toHaveLength(0);
  await confirm.fill('synthetic-password');await page.getByRole('button',{name:'Activate account'}).click();await expect(page.getByRole('alert').filter({hasText:'Temporary connection'})).toContainText('Temporary connection');
  await page.screenshot({path:info.outputPath(`activation-${width}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Activate account'}).click();await expect(page.getByRole('heading',{name:'You’re ready to go'})).toBeVisible();
  expect(calls).toHaveLength(2);expect(calls[0].attempt_id).toBe(calls[1].attempt_id);expect(Object.keys(calls[0]).sort()).toEqual(['attempt_id','password','token']);
  expect(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('a'.repeat(43))))).toBe(false);
});

test('Admin creates a pending invitation, preserves PDS, and manages activation separately',async({page},info)=>{
  test.setTimeout(90_000);
  const fixture=await projectWorkspaceFixture(page,'admin');
  Object.assign(fixture.organizations[0],{name:'LEDIPO',slug:'ledipo'});
  const invitation={invitation_id:'70000000-0000-4000-8000-000000000001',full_name:'New colleague',email:'new@example.test',office_name:'LEDIPO',account_role:'member',requested_privileged_role:null,status:'pending',email_delivery_status:'sent',expires_at:new Date(Date.now()+86400000).toISOString(),awaiting_authority:false};
  let pending: typeof invitation[]=[];const submissions:Record<string,unknown>[]=[];let revoked=0;
  await page.route('**/admin/users/pending-activation',r=>r.fulfill({json:{invitations:pending}}));
  await page.route('**/admin/users/create',async r=>{submissions.push(r.request().postDataJSON());if(submissions.length===1)return r.fulfill({status:503,json:{detail:'Synthetic connection failure'}});pending=[invitation];return r.fulfill({status:201,json:invitation});});
  await page.route('**/admin/users/pending-activation/*/revoke',r=>{revoked++;pending=[];return r.fulfill({json:{...invitation,status:'revoked'}});});
  await page.reload();
  await page.getByRole('button',{name:'Create LEDIPO User',exact:true}).click();const modal=page.getByRole('dialog',{name:'Create LEDIPO User'});
  await expect(modal.getByLabel('Password',{exact:true})).toHaveCount(0);await expect(modal.getByText('Import from CSC Personal Data Sheet')).toBeVisible();await expect(modal.getByRole('textbox',{name:'Office',exact:true})).toHaveValue('LEDIPO');
  await modal.getByRole('textbox',{name:'Full Name',exact:true}).fill('New colleague');await modal.getByRole('textbox',{name:'Email',exact:true}).fill('new@example.test');
  await modal.getByRole('button',{name:'Send activation email'}).click();await expect(modal.getByRole('alert').filter({hasText:'Synthetic connection failure'})).toContainText('Synthetic connection failure');
  await modal.getByRole('button',{name:'Send activation email'}).click();await expect(modal).not.toBeVisible();
  expect(submissions).toHaveLength(2);expect(submissions[0].request_id).toBe(submissions[1].request_id);expect(submissions[0]).not.toHaveProperty('password');expect(submissions[0].org_id).toBe(fixture.org);
  const pendingRegion=page.getByRole('region',{name:'Pending activation'});await expect(pendingRegion.getByText('new@example.test',{exact:true})).toBeVisible();await pendingRegion.getByRole('button',{name:'Revoke',exact:true}).click();const confirm=page.getByRole('alertdialog');await expect(confirm).toBeVisible();expect(revoked).toBe(0);await confirm.getByRole('button',{name:'Revoke invitation',exact:true}).click();await expect(pendingRegion.getByText('No pending activations.')).toBeVisible();expect(revoked).toBe(1);
  await page.getByRole('button',{name:'Invite eFlow User',exact:true}).click();const officeModal=page.getByRole('dialog',{name:'Invite eFlow User'});await expect(officeModal.getByRole('combobox',{name:'Office',exact:true})).toBeVisible();await expect(officeModal.getByText('Import from CSC Personal Data Sheet')).toHaveCount(0);await page.screenshot({path:info.outputPath('invite-office.png')});
});
