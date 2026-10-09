import { test, expect } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

const routes = {
  head: [['Workspaces','Workspace Overview','/overview'],['Workspaces','Tasks','/tasks'],['Workspaces','Office Budget','/office-budget'],['Workspaces','Office Team','/team-supervision'],['Workspaces','Identity & Access','/identity-and-access'],['Workspaces','Team Intelligence','/team-intelligence'],['Workspaces','Reports','/reports'],['My Work','Assigned work','/my-work'],['My Work','Leading','/my-work'],['My Work','Subtasks','/my-work'],['My Work','History','/my-work'],['Inbox','Reviews','/reviews'],['Inbox','Announcements','/announcements']],
  member: [['My Work','Assigned work','/my-work'],['My Work','Leading','/my-work'],['My Work','Subtasks','/my-work'],['My Work','History','/my-work'],['Workspaces','Workspace Overview','/overview'],['Inbox','Leader Reviews','/reviews'],['Inbox','Announcements','/announcements']],
  accounting_staff: [['My Work','Assigned work','/my-work'],['My Work','Leading','/my-work'],['My Work','Subtasks','/my-work'],['My Work','History','/my-work'],['Accounting','Accounting Overview','/accounting-overview'],['Accounting','Voucher & Cash Releases','/voucher-cash-releases'],['Accounting','General Journal','/general-journal'],['Accounting','Financial Audit Trail','/financial-audit-trail'],['Accounting','Office Budget Ledgers','/office-budget-ledgers']],
  admin: [['Admin Center','All Users','/users'],['Admin Center','Role Defaults','/users'],['Admin Center','User Access','/users'],['Admin Center','Office Structure','/users'],['Admin Center','Account Audit','/users'],['Admin Center','System Settings','/users'],['Admin Center','Backup & Export','/users']],
} as const;
for (const role of ['head','member','accounting_staff','admin'] as const) test(`${role} retains its landing and authorized destinations through global/context navigation`, async ({page},info) => {
  test.setTimeout(150_000);
  await page.setViewportSize({width:1440,height:950});
  await projectWorkspaceFixture(page,role,false,{landingOnly:true,leading:role !== 'head'});
  expect(new URL(page.url()).pathname).toBe({head:'/overview',member:'/my-work',accounting_staff:'/accounting-overview',admin:'/users'}[role]);
  const rail=page.getByRole('navigation',{name:'Global navigation'});
  if (role==='head') {
    await rail.getByRole('button',{name:'My Work',exact:true}).click();
    await expect(page.getByRole('navigation',{name:'Workspace destinations'}).getByRole('button',{name:"Work I'm Leading",exact:true})).toHaveCount(0);
  }
  if (role==='admin') await expect(rail.getByRole('button',{name:'Workspaces',exact:true})).toHaveCount(0);
  for (const [group,label,path] of routes[role]) {
    await rail.getByRole('button',{name:group,exact:true}).click();
    const target=page.getByRole('navigation',{name:'Workspace destinations'}).getByRole('button',{name:label,exact:true}).first();
    if (await target.count()) await target.click();
    await expect.poll(()=>new URL(page.url()).pathname).toBe(path);
    await expect(page.getByRole('heading',{name:'Access denied',exact:true})).toHaveCount(0);
    if (group) await expect(target).toHaveAttribute('aria-current','page');
  }
  await page.reload(); await expect(rail).toBeVisible();
  await page.screenshot({path:info.outputPath(`${role}-navigation.png`),fullPage:true});
});

test('individual support grants reach the named screen and denied routes load no audit records', async ({page}) => {
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page,'member',false,{landingOnly:true,overrides:{'navigation.audit':true}});
  await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'Admin Center',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Audit',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tab',{name:'People',exact:true})).toHaveCount(0);
  await page.goto('/audit?page=Audit'); await expect(page.getByRole('tab',{name:'Audit',exact:true})).toHaveAttribute('aria-selected','true');
  await page.goto('/organization?page=Org%20Structure'); await expect(page.getByRole('heading',{name:'Access denied',exact:true})).toBeVisible();
  await page.route('**/rest/v1/user_permission_overrides**',route=>route.fulfill({json:[]}));
  const auditRequests:string[]=[]; page.on('request',request=>{if (/audit_(logs|events)/.test(request.url())) auditRequests.push(request.url());});
  await page.goto('/audit?page=Account%20Audit'); await expect(page.getByRole('heading',{name:'Access denied',exact:true})).toBeVisible();
  expect(auditRequests).toEqual([]);
});

test('search and favorites retain a shared inter-Office observer project without offering creation', async ({page},info) => {
  test.setTimeout(90_000);
  const records=await projectWorkspaceFixture(page,'member',false,{shared:true});
  const context=page.getByRole('region',{name:'Projects',exact:true});
  await expect(context.getByRole('button',{name:'Community outreach',exact:true})).toBeVisible();
  await expect(context.getByRole('button',{name:'Create project',exact:true})).toHaveCount(0);
  await context.getByRole('button',{name:'Add Community outreach to favorites',exact:true}).click();
  await page.reload();
  await expect(context.getByRole('button',{name:'Remove Community outreach from favorites',exact:true}).first()).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Search workspace',exact:true}).click();
  await page.getByRole('textbox',{name:'Search navigation and projects'}).fill('Community outreach');
  await page.getByRole('dialog',{name:'Search available content'}).getByRole('button',{name:'Community outreach Project',exact:true}).click();
  await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
  expect(new URL(page.url()).searchParams.get('project')).toBe(records.project);
  await expect(page.getByRole('button',{name:'New task',exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('shared-observer.png'),fullPage:true});
});

test('creation menu uses existing handlers, retains failed drafts and discards only after confirmation', async ({page}) => {
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page,'head');
  const context=page.getByRole('region',{name:'Projects',exact:true});
  await page.getByRole('button',{name:'Projects and proposals',exact:true}).click();
  await expect(page.getByRole('menuitem',{name:'Import proposal',exact:true})).toBeVisible();
  await expect(page.getByRole('menuitem',{name:/Folder|Dashboard|My Work/})).toHaveCount(0);
  await page.getByRole('menuitem',{name:'Create project',exact:true}).click();
  await page.getByLabel('Project name',{exact:true}).fill('Retained project draft');
  let requests=0;
  await page.route('**/rest/v1/rpc/create_project_with_details',async route=>{ requests++; if(requests===1) await route.fulfill({status:503,json:{message:'Synthetic temporary creation failure'}}); else await route.fallback(); });
  await page.getByRole('button',{name:'Create project →',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Could not create the project.');
  await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('Retained project draft');
  await page.getByRole('button',{name:'Create project →',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Let’s start working together',exact:true})).toHaveCount(0);
  expect(requests).toBe(2);
  await expect(context.getByRole('button',{name:'Retained project draft',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Projects and proposals',exact:true}).click(); await page.getByRole('menuitem',{name:'Create project',exact:true}).click(); await page.getByLabel('Project name',{exact:true}).fill('Discarded draft');
  await page.getByRole('button',{name:'Cancel',exact:true}).click(); await page.getByRole('button',{name:'Discard',exact:true}).click();
  expect(requests).toBe(2);
});

test('dirty Security editor keeps navigation and browser history until explicit discard', async ({page}) => {
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page,'member');
  await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'Profile',exact:true}).click();
  await page.getByRole('navigation',{name:'Workspace destinations'}).getByRole('button',{name:'Security',exact:true}).click();
  await page.getByLabel('Current password',{exact:true}).fill('synthetic-unsaved');
  await page.getByRole('button',{name:'Open account menu',exact:true}).press('ArrowDown');
  await page.getByRole('menuitem',{name:'Log out',exact:true}).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page.getByLabel('Current password',{exact:true})).toHaveValue('synthetic-unsaved');
  await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'Workspaces',exact:true}).click();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  await expect(page.getByLabel('Current password',{exact:true})).toHaveValue('synthetic-unsaved');
  await page.goBack(); await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  expect(new URL(page.url()).searchParams.get('page')).toBe('Security');
  await page.goBack(); await page.getByRole('button',{name:'Discard',exact:true}).click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('page')).toBe('Profile');
  await page.goForward(); await expect(page.getByLabel('Current password',{exact:true})).toHaveValue('');
});

test('failed inline task remains intact when shell navigation is canceled and logout clears local navigation preferences',async({page})=>{
  test.setTimeout(90_000);const records=await projectWorkspaceFixture(page,'head');
  let requests=0;await page.route('**/rest/v1/rpc/phase3_create_task',route=>{requests++;return route.fulfill({status:503,json:{message:'Retain this failed task'}});});
  const input=page.getByRole('textbox',{name:'Add task to To do',exact:true});await input.fill('Failed draft');await input.press('Tab');
  await expect(page.getByRole('alert')).toContainText('Retain this failed task');
  await page.getByRole('navigation',{name:'Workspace destinations'}).getByRole('button',{name:'Workspace Overview',exact:true}).click();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(input).toHaveValue('Failed draft');expect(requests).toBe(1);
  await page.getByRole('navigation',{name:'Workspace destinations'}).getByRole('button',{name:'Workspace Overview',exact:true}).click();await page.getByRole('button',{name:'Discard',exact:true}).click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/overview');expect(requests).toBe(1);
  await page.evaluate(({id,org,project})=>localStorage.setItem(`eflow:navigation:v1:${id}:${org}`,JSON.stringify([project])),{id:records.id,org:records.org,project:records.project});
  const signouts:string[]=[];page.on('request',request=>{if(request.url().includes('/auth/v1/logout'))signouts.push(request.url());});
  await page.getByRole('button',{name:'Open account menu',exact:true}).click();await page.getByRole('menuitem',{name:'Log out',exact:true}).click();
  await expect(page.locator('#login-email')).toBeVisible();expect(signouts).toHaveLength(1);expect(new URL(signouts[0]).searchParams.get('scope')).toBe('local');
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('eflow:navigation:v1:')))).toEqual([]);
});

test('unassigned Office and zero projects remain usable without exposing stale context',async({page})=>{
  test.setTimeout(90_000);
  await projectWorkspaceFixture(page,'member',false,{landingOnly:true,unassigned:true,empty:true});
  await expect(page.getByRole('region',{name:'Workspace content'}).getByRole('button',{name:'Organization not assigned Workspace',exact:true})).toBeVisible();
  await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'Workspaces',exact:true}).click();
  await expect(page.getByText('No active projects.',{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Projects',exact:true}).getByRole('button',{name:'Create project',exact:true})).toHaveCount(0);
  await page.goto('/projects?page=Projects&project=unavailable-record&view=offices');
  await expect(page.getByRole('status').filter({hasText:'Project unavailable'})).toContainText('That project is no longer in your available content. Select an available project to continue.');
  await expect.poll(()=>new URL(page.url()).searchParams.has('project')).toBe(false);
  await expect(page.getByText('No active projects.',{exact:true})).toBeVisible();
});

for(const width of [1440,768,390,320]) test(`responsive navigation, project context and utilities at ${width}px`,async({page},info)=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width,height:900}); await projectWorkspaceFixture(page,'head');
  await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if(width<1024) {
    const more=page.getByRole('navigation',{name:'Mobile primary navigation'}).getByRole('button',{name:'More',exact:true});
    await more.click(); const drawer=page.getByRole('dialog',{name:'Navigation',exact:true});
    await expect(drawer.getByRole('button',{name:'Community outreach',exact:true})).toBeVisible();
    await expect(drawer.getByRole('button',{name:'Add or hide workspace sections',exact:true})).toBeVisible();
    for(let i=0;i<12;i++) {await page.keyboard.press('Tab'); expect(await drawer.evaluate(element=>element.contains(document.activeElement))).toBe(true);}
    await page.screenshot({path:info.outputPath(`navigation-drawer-${width}.png`)});
    await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0); await expect(more).toBeFocused();
  }
  await page.getByRole('button',{name:'Open task board',exact:true}).click(); await page.getByRole('button',{name:'Back to main table',exact:true}).click();
  await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
  for (const [trigger,panel] of [['Open notifications','Notifications'],['Open messages','Messages']]) {
    const opener=page.getByRole('button',{name:trigger,exact:true}); await opener.click(); await expect(page.getByRole('dialog',{name:panel,exact:true})).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog',{name:panel,exact:true})).toHaveCount(0); await expect(opener).toBeFocused();
  }
  await page.screenshot({path:info.outputPath(`navigation-${width}.png`),fullPage:true});
});
