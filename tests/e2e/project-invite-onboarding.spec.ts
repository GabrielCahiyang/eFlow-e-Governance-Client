import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';

test('recipient chooses a password, signs in using invited email and fills their own profile',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});
 const records=await projectWorkspaceFixture(page,'member',false,{landingOnly:true});
 const request='90000000-0000-4000-8000-000000000001';let created=0,login=0,saves=0,uploads=0;let profile:any=null;const documents:any[]=[];
 await page.route('**/controlpanelEflow/api/project-invitations/validate',route=>route.fulfill({json:{id:request,email:records.profile.email,office_name:'Project partner Office',project_title:'Community assessment',project_id:records.project,existing_account:false,engagement:'Other',until_close:true,project_participation_role:'employee'}}));
 await page.route('**/controlpanelEflow/api/project-invitations/create-account',route=>{
  const body=route.request().postDataJSON();expect(body.full_name).toBe('Invited Person');expect(body.password).toBe('recipient-own-strong-password');expect(body.email).toBeUndefined();created++;return route.fulfill({json:{accepted:true,project_id:records.project}});
 });
 await page.route('**/controlpanelEflow/api/auth/login',async route=>{const body=route.request().postDataJSON();expect(body.email).toBe(records.profile.email);expect(body.password).toBe('recipient-own-strong-password');login++;await route.fallback();});
 await page.route('**/controlpanelEflow/api/professional-profile/**',async route=>{
  if(route.request().method()==='PATCH'){saves++;profile={...route.request().postDataJSON(),user_id:records.id,confirmed_by_user:false};}
  return route.fulfill({json:{profile}});
 });
 await page.route('**/controlpanelEflow/api/pds/me',route=>route.fulfill({json:{documents}}));
 await page.route('**/controlpanelEflow/api/pds/upload?*',route=>{expect(new URL(route.request().url()).searchParams.get('project_request_id')).toBe(request);uploads++;const document={id:'pds',original_filename:'my-profile.pdf',processing_status:'completed',user_id:records.id};documents.push(document);return route.fulfill({json:document});});
 await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.includes('auth-token'))localStorage.removeItem(key);sessionStorage.clear();});
 await page.goto('/accept-project-invite?token='+'a'.repeat(43));
 await page.getByLabel('Full name',{exact:true}).fill('Invited Person');await page.getByLabel('Password',{exact:true}).fill('recipient-own-strong-password');await page.getByLabel('Confirm password',{exact:true}).fill('recipient-own-strong-password');
 await expect(page.getByText('Office employee · project only',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('recipient-choose-password.png'),fullPage:true});
 await page.getByRole('button',{name:'Create account',exact:false}).click();
 await expect(page.getByRole('heading',{name:'Your project access is ready.'})).toBeVisible({timeout:30000});
 await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.getByLabel('Skills',{exact:true}).fill('Meeting facilitation\nDocumentation');await page.getByLabel('Professional summary',{exact:true}).fill('I prepare community meeting records and facilitate discussions.');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByText('Meeting facilitation',{exact:true})).toBeVisible();
 expect(created).toBe(1);expect(login).toBe(1);expect(saves).toBe(1);expect(profile.skills).toEqual(['Meeting facilitation','Documentation']);
 await page.getByLabel('Upload your PDS PDF').setInputFiles({name:'my-profile.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});await expect(page.getByText('my-profile.pdf',{exact:true})).toBeVisible();expect(uploads).toBe(1);await expect(page.getByRole('button',{name:'Continue to project',exact:true})).toBeEnabled();
 await page.screenshot({path:info.outputPath('recipient-profile-onboarding.png'),fullPage:true});
});
