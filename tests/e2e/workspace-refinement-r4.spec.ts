import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

const retired={readiness:'overview',workload:'offices',team:'offices',people:'offices',signoff:'offices',evidence:'reviews',decisions:'activity'};
const labels=['Workload & Team','Readiness & closeout','Approval Status','Evidence Register','Decision History'];

for(const width of [320,390,1440])test(`R4 uncluttered header and project Overview at ${width}px`,async({page},info)=>{
 test.setTimeout(120_000);await page.setViewportSize({width,height:950});const fixture=await projectWorkspaceFixture(page,'head');
 fixture.projects[0].description='Bring public services closer to residents.';
 await page.evaluate(({id,retired})=>localStorage.setItem(`eflow_project_views_${id}`,JSON.stringify([...Object.keys(retired),'overview'])),{id:fixture.project,retired});
 await page.goto(`/projects?workspace=${fixture.org}&project=${fixture.project}&view=readiness`);
 await expect(page.getByRole('heading',{name:'Purpose',exact:true})).toBeVisible();await expect(page.getByText('Bring public services closer to residents.')).toBeVisible();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('overview');
 await expect(page.locator('.eflow-project-identity__context')).toHaveCount(0);
 for(const label of labels)await expect(page.getByRole('tab',{name:label,exact:true})).toHaveCount(0);
 const avatar=page.locator('.eflow-project-identity').getByRole('img',{name:'Alex Rivera',exact:true});await avatar.focus();
 await expect(page.getByRole('tooltip').filter({hasText:'Alex Rivera'})).toBeVisible();await page.keyboard.press('Tab');
 await page.getByRole('button',{name:'Add view',exact:true}).click();const picker=page.getByRole('dialog',{name:'Add project view'});await expect(picker).toBeVisible();
 for(const label of labels)await expect(picker.getByRole('button',{name:label,exact:true})).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(picker).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Progress',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Responsible people',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:info.outputPath(`r4-overview-${width}.png`),fullPage:true});
});

test('R4 retired links canonicalize to retained views across reload and history',async({page})=>{
 test.setTimeout(120_000);await page.setViewportSize({width:1440,height:950});const fixture=await projectWorkspaceFixture(page,'member');
 for(const [view,target] of Object.entries(retired)){
  await page.goto(`/projects?workspace=${fixture.org}&project=${fixture.project}&view=${view}`);
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe(target);
  for(const label of labels)await expect(page.getByRole('tab',{name:label,exact:true})).toHaveCount(0);
 }
 // Native reload preserves session history. The pinned Firefox driver's
 // page.reload() adds an entry even for a static HTML page (R13 probe receipt).
 const reload = () => Promise.all([page.waitForEvent('load'), page.evaluate(()=>location.reload())]);
 await reload();await expect(page.getByRole('tab',{name:'Activity',exact:true})).toHaveAttribute('aria-selected','true');
 // Exercise actual in-app history after verifying every external alias.
 await page.getByRole('tab',{name:'Reviews',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Reviews',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:'Activity',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Activity',exact:true})).toHaveAttribute('aria-selected','true');
 await reload();await expect(page.getByRole('tab',{name:'Activity',exact:true})).toHaveAttribute('aria-selected','true');
 await page.goBack();await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('view'))).toBe('reviews');
 await expect(page.getByRole('tab',{name:'Reviews',exact:true})).toHaveAttribute('aria-selected','true');
 await page.goForward();await expect(page.getByRole('tab',{name:'Activity',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Project actions',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Mark project complete',exact:true})).toHaveCount(0);await expect(page.getByRole('menuitem',{name:'Project Offices',exact:true})).toBeVisible();
});

test('R4 Head resolves requirements while Complete is disabled, then stale rejection and eligible completion stay safe',async({page},info)=>{
 test.setTimeout(120_000);await page.setViewportSize({width:1440,height:950});const fixture=await projectWorkspaceFixture(page,'head');
 let reviewed=false,deny=false,completeCalls=0,readCalls=0;
 const readiness=()=>({projectId:fixture.project,title:'Community outreach',status:'planning',canComplete:reviewed&&!deny,blockers:reviewed&&!deny?[]:[{kind:'governance',id:fixture.project,title:'Project structure',status:'review_required',detail:deny?'New cash settlement required.':'Review the plan first.'}]});
 await page.route('**/rest/v1/rpc/get_project_completion_readiness',async route=>{readCalls++;await route.fulfill({json:readiness()});});
 await page.route('**/rest/v1/rpc/phase7_project_readiness',async route=>route.fulfill({json:{projectId:fixture.project,stage:'Planning',governed:false,canActivate:false,ready:reviewed,checks:[{key:'structure',label:'Project structure',ok:reviewed,detail:'Review the plan first.'}]}}));
 await page.route('**/rest/v1/rpc/phase7_review_project',async route=>{reviewed=true;await route.fulfill({json:null});});
 await page.route('**/rest/v1/rpc/complete_project',async route=>{completeCalls++;if(deny)await route.fulfill({status:400,json:{code:'22023',message:'New cash settlement required.'}});else{fixture.projects[0].status='completed';await route.fulfill({json:null});}});
 await page.goto(`/projects?workspace=${fixture.org}&project=${fixture.project}&view=tasks`);
 await page.getByRole('button',{name:'Project actions',exact:true}).click();const complete=page.getByRole('menuitem',{name:'Mark project complete',exact:true});await expect(complete).toHaveAttribute('data-disabled','');await expect(page.getByText(/Review the plan first/)).toBeVisible();
 await page.getByRole('menuitem',{name:'View completion requirements',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Mark project complete',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm completion',exact:true})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Confirm review',exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Open proposal closeout',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Confirm review',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Confirm completion',exact:true})).toBeEnabled();expect(completeCalls).toBe(0);expect(readCalls).toBeGreaterThan(1);
 await page.screenshot({path:info.outputPath('r4-completion-requirements.png'),fullPage:true});
 deny=true;await dialog.getByRole('button',{name:'Confirm completion',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('New cash settlement required.');await expect(dialog.getByRole('button',{name:'Confirm completion',exact:true})).toBeDisabled();expect(completeCalls).toBe(1);
 deny=false;await dialog.getByRole('button',{name:'Refresh checks',exact:true}).click();await expect(dialog.getByRole('button',{name:'Confirm completion',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Confirm completion',exact:true}).dblclick();
 await expect(dialog).toHaveCount(0);expect(completeCalls).toBe(2);await page.getByRole('button',{name:'Project actions',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Archive project',exact:true})).not.toHaveAttribute('data-disabled','');await expect(page.getByRole('menuitem',{name:'Mark project complete',exact:true})).toHaveCount(0);
});
