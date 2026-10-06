// Audit-only fixture harness. All APIs and non-local resources are intercepted.
// Uses the actual running Vite bundle; no deployed account, token, or database access.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const base = process.env.EFLOW_E2E_BASE_URL || 'http://127.0.0.1:5173';
const origin = new URL(base);
if (!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error('Audit must use a local app server');
const out=path.resolve('docs/product-refinement/audit/screenshots');fs.mkdirSync(out,{recursive:true});
const screens=JSON.parse(fs.readFileSync('docs/product-refinement/audit/inventory/screens.json','utf8'));
const utilityOnly=process.env.EFLOW_AUDIT_FOCUS==='utilities';
const focused=utilityOnly||process.env.EFLOW_AUDIT_FOCUS==='supplement';
const records=focused?JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')):[], scenarios=focused?JSON.parse(fs.readFileSync(path.join(out,'keyboard-and-context.json'),'utf8')):[], browser=await chromium.launch({headless:true});
const id='00000000-0000-4000-8000-000000000001',org='10000000-0000-4000-8000-000000000001',project='20000000-0000-4000-8000-000000000001',group='30000000-0000-4000-8000-000000000001';
async function fixture(role,{lead=false,support=false,observer=false,collaborator=false,long=false,error=false}={}) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
  await context.addInitScript(({id,role})=>localStorage.setItem(`eflow:guided-tour:2026.08-v1:${id}:${role}`,JSON.stringify({welcomed:true,systemCompleted:false,completedPages:[],voiceEnabled:false})),{id,role});
  page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(30000);
  const issues=[], requests=[];page.on('pageerror',e=>issues.push(e.message));
  const now='2026-10-06T00:00:00Z',user={id,aud:'authenticated',role:'authenticated',email:'audit@example.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:now};
  const profile={id,full_name:'Audit Fixture',email:user.email,role,org_id:org,is_active:true,employee_id:'AUDIT',skills:{},created_at:now,updated_at:now};
  const office={id:org,name:long?'A very long Office name for resilient navigation and project labels '.repeat(3):'Audit Office',slug:'audit_office',path:'audit_office',org_type:'department',is_active:true,head_user_id:role==='head'?id:null};
  const projects=[{id:project,title:long?'Long community outreach project title with several dependencies and participating Offices '.repeat(3):'Audit community outreach',org_id:observer||collaborator?'10000000-0000-4000-8000-000000000002':org,owner_id:observer||collaborator?'00000000-0000-4000-8000-000000000002':id,created_by:id,status:'planning',priority:'medium',created_at:now,updated_at:now}];
  const tasks=Array.from({length:long?250:3},(_,i)=>({id:`40000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,title:`Audit task ${i+1}`,org_id:org,project_id:project,linked_project_id:project,group_id:group,workspace_position:i,status:['in_progress','todo','completed'][i%3],assigned_to:lead||role==='head'?id:'00000000-0000-4000-8000-000000000002',recommendation_lead_id:lead?id:null,team_member_ids:[id],priority:'medium',estimated_hours:4,budget_impact:0,deadline:'2026-10-12',percent_complete:i%3===2?100:0,created_at:now,updated_at:now,created_by:id}));
  const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
  await page.routeWebSocket(/.*/,()=>{});
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').at(-1),single=req.headers().accept?.includes('vnd.pgrst.object');
    if(url.pathname.includes('/auth/v1/')) return route.fulfill({json:url.pathname.includes('/token')?{access_token:token,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,user}:user});
    if(url.pathname.includes('/rest/v1/')) {
      requests.push({method:req.method(),table});
      if(error && ['projects','tasks'].includes(table)) return route.fulfill({status:500,json:{message:'Synthetic audit unavailable'}});
      let data=[];
      if(table==='profiles')data=single?profile:[profile];
      if(table==='organizations')data=single?office:[office];
      if(table==='projects')data=single?projects[0]:projects;
      if(table==='tasks')data=tasks;
      if(table==='project_groups')data=[{id:group,project_id:project,title:'To do',color:'#579bfc',position:0,is_default:true,created_at:now}];
      if(table==='project_offices')data=observer||collaborator?[{id:'lead-office',project_id:project,office_id:'10000000-0000-4000-8000-000000000002',relationship_type:'lead',invitation_status:'joined'},{id:'our-office',project_id:project,office_id:org,relationship_type:observer?'observer':'collaborating',invitation_status:'joined'}]:[{id:'lead-office',project_id:project,office_id:org,relationship_type:'lead',invitation_status:'joined'}];
      if(table==='user_preferences')data={user_id:id,theme:'light',created_at:now,updated_at:now};
      if(table==='organization_approver_ids')data=role==='head'?[id]:[];
      if(table==='user_permission_overrides'&&support)data=['navigation.user_management','navigation.organization','navigation.audit','navigation.system_settings','navigation.data_tools'].map(permission=>({user_id:id,permission,allowed:true}));
      if(table==='phase7_project_readiness')data={projectId:project,governed:false,ready:false,canActivate:false,stage:'Planning',checks:[]};
      if(table==='phase7_closeout_summary')data={tasks:3,completed:1,cancelled:0,budgetEstimate:0,offices:1,evidence:0,contributors:1,financial:{requested:0,approved:0,settled:0,open:0}};
      if(table==='get_project_completion_readiness')data={projectId:project,canComplete:false,blockers:[]};
      return route.fulfill({json:data,headers:{'content-range':'0-2/3'}});
    }
    if(url.pathname.includes('/controlpanelEflow/')){
      let data={success:true,invitations:[]};
      if(url.pathname.includes('/office-team'))data={office_name:office.name,members:[]};
      if(url.pathname.includes('/backups'))data={jobs:[],preflight:{configured:false,database_url_configured:false,pg_dump_available:false,encryption_available:false,retention_hours:24,tables:[],table_count:0,safe_excluded_data_tables:[]}};
      if(url.pathname.includes('/onboarding/me'))data={user_id:id,tour_key:role+'-v1',tour_version:1,status:'dismissed',state:{},current_step:'welcome'};
      return route.fulfill({json:data});
    }
    if(url.origin===origin.origin && req.method()==='GET')return route.continue();
    requests.push({method:req.method(),blocked:url.origin+url.pathname});
    return route.fulfill({status:200,body:'',headers:{'content-type':'text/plain'}});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#login-email').fill(user.email);await page.locator('#login-password').fill('synthetic-password');await page.locator('#login-submit').click();
  await page.locator('.eflow-productivity-sidebar').first().waitFor({timeout:30000});
  const later=page.getByRole('button',{name:'Maybe later',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
  return {context,page,issues,requests,role,lead,support,observer,collaborator};
}
async function capture(f,screenId,state,width=1440) {
  const {page}=f;
  await page.setViewportSize({width,height:width<768?844:1000});
  await page.waitForTimeout(350);
  const file=`${screenId.replaceAll('.','-')}-${state}-${width}.png`;
  await page.screenshot({path:path.join(out,file),fullPage:false,timeout:5000});
  const facts=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,focus:document.activeElement?.getAttribute('aria-label')||document.activeElement?.tagName,title:document.title,bodyError:document.body.innerText.includes('Something went wrong'),stateText:document.querySelector('main')?.textContent?.slice(0,300)}));
  records.push({screenId,state,width,height:width<768?844:1000,file,route:new URL(page.url()).pathname+new URL(page.url()).search,role:f.role,context:{lead:f.lead,support:f.support,observer:f.observer,collaborator:f.collaborator},...facts,pageErrors:f.issues.splice(0)});
  console.log(`${screenId} ${state} ${width}${facts.overflow?' OVERFLOW':''}${facts.bodyError?' BOUNDARY-ERROR':''}`);
}
try {
  for(const role of focused?[]:['admin','head','member','accounting_staff']) {
    const f=await fixture(role),{page}=f;
    const routes=screens.filter(s=>s.role===role&&!s.capability.startsWith('Leading visible')&&s.section!=='prototype');
    for(const s of routes) {
      await page.goto(base+s.route,{waitUntil:'domcontentloaded'});
      await page.locator('.eflow-productivity-sidebar').first().waitFor();
      await capture(f,s.id,'default');
    }
    for(const s of screens.filter(s=>s.section==='settings')) {await page.goto(base+s.route);await capture(f,s.id,role);}
    const start=role==='accounting_staff'?routes.find(s=>s.section==='accounting_overview'):routes[0];await page.goto(base+start.route);
    const sidebar=page.locator('.eflow-productivity-sidebar').first();
    await page.getByRole('banner',{name:'Workspace utilities'}).hover();await capture(f,start.id,'compact');
    const first=sidebar.locator('button').first();await first.focus();await page.keyboard.press('Tab');await capture(f,start.id,'keyboard-expanded');
    scenarios.push({role,scenario:'Sidebar keyboard expansion',density:await sidebar.getAttribute('data-navigation-density'),focusInside:await sidebar.evaluate(el=>el.contains(document.activeElement))});
    for(const width of [1024,768,390,320]) {
      await capture(f,start.id,'responsive',width);
      const open=page.getByRole('button',{name:'Open navigation',exact:true});
      if(width<768&&await open.isVisible()) {
        console.log(`Opening mobile navigation ${role} ${width}`);
        try {await open.click({timeout:5000});console.log('Mobile navigation clicked');await capture(f,start.id,'mobile-navigation',width);await page.keyboard.press('Escape');await page.waitForTimeout(400);scenarios.push({role,width,scenario:'Mobile Escape after transition',dialogs:await page.getByRole('dialog').count(),focus:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))});}
        catch(e){scenarios.push({role,width,scenario:'Mobile navigation access blocker',error:e.message.slice(0,1500)});await page.keyboard.press('Escape');}
      }
      // Reset the modal state even when Escape/focus restoration is defective.
      if(width<768) await page.reload({waitUntil:'domcontentloaded'});
    }
    await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(400);
    for(const [name,screenId] of [['Notifications','utility.notifications'],['Open messages','utility.chat'],['Open account menu','settings.profile']]) {
      const button=page.getByRole('button',{name,exact:true}).first();if(await button.isVisible()){
        try {await button.click();await capture(f,screenId,`${role}-panel`);await page.keyboard.press('Escape');scenarios.push({role,scenario:`${name} Escape`,focus:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))});}
        catch(e){scenarios.push({role,scenario:`${name} interaction blocker`,error:e.message.slice(0,1500)});}
        await page.reload({waitUntil:'domcontentloaded'});
      }
    }
    // History is audited through the real URL/state resolver.
    if(routes.length>1){await page.goto(base+routes[0].route);await page.evaluate(url=>{history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'));},routes[1].route);await page.goBack();scenarios.push({role,scenario:'Back/forward route',back:new URL(page.url()).pathname});await page.goForward();await page.reload();scenarios.push({role,scenario:'Forward + refresh',route:new URL(page.url()).pathname});}
    await f.context.close();
  }
  if(!focused){
  const lead=await fixture('member',{lead:true});
  for(const s of screens.filter(s=>s.role==='member'&&s.capability.startsWith('Leading visible'))) {await lead.page.goto(base+s.route);await capture(lead,s.id,'task-lead');}
  scenarios.push({role:'member',scenario:'Task Lead destinations',leading:await lead.page.locator('[data-tour-section="leading"]').count(),reviews:await lead.page.locator('[data-tour-section="reviews"]').count()});await lead.context.close();
  const support=await fixture('member',{support:true});
  for(const s of screens.filter(s=>s.id.startsWith('support.'))) {await support.page.goto(base+s.route);await capture(support,s.id,'individual-grant');scenarios.push({scenario:'Explicit support grant',section:s.section,sidebar:await support.page.locator(`[data-tour-section="${s.section}"]`).count(),tabs:await support.page.getByRole('tab').allTextContents(),body:(await support.page.locator('main').innerText().catch(()=>support.page.locator('body').innerText())).slice(0,500)});}
  await support.context.close();
  }
  for(const role of ['admin','head','member','accounting_staff']){
    const f=await fixture(role),{page}=f;
    await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(400);
    const utilities=[['utility.notifications',page.getByTitle('No new notifications',{exact:true})],['utility.chat',page.getByRole('button',{name:'Open messages',exact:true})],['settings.profile',page.getByRole('button',{name:'Open account menu',exact:true})]];
    for(const [screenId,buttons] of utilities){
      const candidates=await buttons.all();let button;
      for(const c of candidates)if(await c.isVisible()){button=c;break;}
      if(!button){scenarios.push({role,scenario:'Utility capture blocker',screenId,reason:'No visible trigger resolved; source entry retained, fixture follow-up required'});continue;}
      await button.click();await capture(f,screenId,`${role}-utility`);await page.keyboard.press('Escape');await page.waitForTimeout(400);
      scenarios.push({role,scenario:'Utility Escape after transition',screenId,focus:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')||document.activeElement?.getAttribute('title')),dialogs:await page.getByRole('dialog').count()});
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(300);
    }
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.keyboard.press('Escape');await page.waitForTimeout(500);
      scenarios.push({role,width,scenario:'Mobile Escape after transition',dialogs:await page.getByRole('dialog').count(),focus:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))});
      await page.reload({waitUntil:'domcontentloaded'});
    }
    await f.context.close();
  }
  if(!utilityOnly){
  // Additional contexts make fixture authority data coherent across Office boundaries.
  const financial=await fixture('accounting_staff');
  await financial.page.goto(base+'/accounting-overview?page=Accounting%20Overview');
  for(const width of [1024,768,390,320])await capture(financial,'accounting_staff.accounting_overview.accounting-overview','financial-responsive',width);
  await financial.context.close();
  const collaborator=await fixture('head',{collaborator:true});
  for(const view of ['tasks','offices']){await collaborator.page.goto(`${base}/projects?page=Projects&project=${project}&view=${view}`);await capture(collaborator,`project.${view}`,'collaborating-office-head');}
  await collaborator.context.close();
  for(const role of ['head','accounting_staff']){
    const f=await fixture(role,{lead:true});
    for(const s of screens.filter(s=>s.role===role&&s.capability.startsWith('Leading visible'))){await f.page.goto(base+s.route);await capture(f,s.id,'task-lead');}
    await f.context.close();
  }
  for(const observer of [false,true]) {
    const f=await fixture(observer?'member':'head',{observer});
    for(const s of screens.filter(s=>s.id.startsWith('project.')&&s.view)) {
      await f.page.goto(base+s.route.replace('{projectId}',project));await capture(f,s.id,observer?'observer':'office-head');
    }
    await f.page.goto(`${base}/projects?page=Projects&project=${project}&view=tasks`);
    for(const width of [1024,768,390,320])await capture(f,'project.tasks',observer?'observer-responsive':'responsive',width);
    await f.page.setViewportSize({width:1440,height:1000});
    if(!observer){
      await f.page.getByRole('button',{name:'Subitems for Audit task 1',exact:true}).click();await capture(f,'project.tasks','subitems-expanded');
      const create=f.page.getByRole('button',{name:'Create project',exact:true}).first();if(await create.isVisible()){await create.click();await capture(f,'project.create','office-head');await f.page.keyboard.press('Escape');}
    }
    const edit=f.page.getByRole('button',{name:'Edit task Audit task 1',exact:true});
    if(observer)scenarios.push({scenario:'Observer task edit blocked',disabled:await edit.isDisabled().catch(()=>null)});
    const openTask=f.page.getByRole('button',{name:'Open Audit task 1',exact:true});
    if(await openTask.isVisible()){await openTask.click();await f.page.getByRole('dialog').first().waitFor();await capture(f,'task.inspector',observer?'observer':'office-head');await f.page.keyboard.press('Escape');}
    await f.context.close();
  }
  for(const state of ['long-high-count','error']) {
    const f=await fixture('head',{long:state==='long-high-count',error:state==='error'});
    await f.page.goto(`${base}/projects?page=Projects&project=${project}&view=tasks`);await capture(f,'project.tasks',state,390);await f.context.close();
  }
  }
} catch (e) {
  scenarios.push({scenario:'Harness incomplete',error:e.stack});console.error(e);process.exitCode=1;
} finally {
  const unique=[...new Map(records.map(r=>[r.file,r])).values()];
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(unique,null,2)+'\n');
  fs.writeFileSync(path.join(out,'keyboard-and-context.json'),JSON.stringify(scenarios,null,2)+'\n');
  await browser.close();
}
console.log(`${new Set(records.map(r=>r.file)).size} unique captures; ${scenarios.length} context/keyboard observations. No live authority assertion.`);
