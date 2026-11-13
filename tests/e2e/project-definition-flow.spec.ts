import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
test('desktop project setup precedes tasks and derives a quarterly funding envelope',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 records.groups.push({id:'30000000-0000-4000-8000-000000000002',project_id:records.project,title:'Project coordination',color:'#087972',position:1,is_default:false});
 const p:any={...records.projects[0],description:'',scope:'',project_lead_id:null,start_date:null,target_date:null,funding_not_required:false};let ready=false;const funds:any[]=[];const commands:any[]=[];
 const source='70000000-0000-4000-8000-000000000001';
 await page.route(/\/rest\/v1\/rpc\/(project_flow_snapshot|save_project_definition|finish_project_setup|authorize_project_funding)$/,async route=>{
 const op=route.request().url().split('/').at(-1),body=route.request().postDataJSON();
 if(op==='project_flow_snapshot')return route.fulfill({json:{project:p,ready,canAuthorize:true,canAllocate:true,funds,sources:[{id:source,name:'Community services appropriation',year:2027,available:2000000-funds.reduce((sum,line)=>sum+line.amount,0)}],total:funds.reduce((sum,line)=>sum+line.amount,0),allocated:0,unallocated:funds.reduce((sum,line)=>sum+line.amount,0),released:0,spent:0,requests:[],fundingRequests:[],taskFunding:[],liquidations:[]}});
 commands.push({op,...body});
 if(op==='save_project_definition'){const d=body.p_details;Object.assign(p,{title:d.title,description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end,funding_not_required:d.noFunding,updated_at:new Date().toISOString()});return route.fulfill({json:p});}
 if(op==='authorize_project_funding'){if(!p.scope)return route.fulfill({status:400,json:{code:'23514',message:'Save complete project details before funding.'}});for(const line of body.p_lines)funds.push({id:crypto.randomUUID(),name:'Community services appropriation',fiscal_year:2027,quarter:line.quarter,amount:line.amount,available:line.amount});return route.fulfill({json:{authorized:700000}});}
 if(op==='finish_project_setup'){if(!p.description||!p.scope||!p.project_lead_id||!p.start_date||!p.target_date||!funds.length)return route.fulfill({status:400,json:{code:'23514',message:'Complete project details and funding before adding tasks or people.'}});ready=true;return route.fulfill({json:null});}
 });
 await page.goto(`/projects?page=Projects&workspace=${records.org}&project=${records.project}&view=settings`);
 const definition=page.getByRole('region',{name:'Project definition'});await expect(definition).toBeVisible({timeout:30000});await expect(page.getByRole('button',{name:'+ Add people',exact:true})).toHaveCount(0);
 await definition.getByRole('button',{name:'Continue project setup'}).click();const wizard=page.locator('.eflow-responsive-modal').filter({has:page.locator('.pf-wizard-modal')});await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Next',exact:true}).click();const error=wizard.getByRole('alert');await expect(error).toContainText('title and description');await expect(error).toHaveCSS('color','rgb(161, 18, 45)');await page.screenshot({path:info.outputPath('setup-validation-red-alert.png'),fullPage:true});
 await wizard.getByLabel('Description *').fill('Support local enterprises through registration and training.');await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByLabel('Scope of the project *').fill('Two quarterly workshops and participant support.');await page.screenshot({path:info.outputPath('project-scope-step.png'),fullPage:true});await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByLabel('Project lead *').selectOption(records.id);await wizard.getByLabel('Project start date *').fill('2027-01-01');await wizard.getByLabel('Project target date *').fill('2027-06-30');await wizard.getByRole('button',{name:'Next',exact:true}).click();
 const budget=wizard.getByRole('region',{name:'Project budget'});await budget.getByLabel('Office Budget source').selectOption(source);await budget.getByRole('spinbutton').fill('300000');await budget.getByRole('button',{name:'Add funding source'}).click();await budget.getByLabel('Office Budget source').nth(1).selectOption(source);await budget.getByLabel('Quarter').nth(1).selectOption('2');await budget.getByRole('spinbutton').nth(1).fill('400000');await budget.getByLabel('Reason / approved authority reference').fill('Approved annual community services work program');
 await page.screenshot({path:info.outputPath('project-definition-quarterly-funding.png'),fullPage:true});
 await budget.getByRole('button',{name:'Authorize project funding'}).click();await expect(budget.getByText('₱700,000.00',{exact:true}).first()).toBeVisible();
 await wizard.getByRole('button',{name:'Next',exact:true}).click();await expect(wizard.getByRole('heading',{name:'Ready to build the work plan?'})).toBeVisible();await expect(wizard.getByText('FY 2027 · Q1 · Community services appropriation')).toBeVisible();
 await page.setViewportSize({width:1180,height:900});await page.screenshot({path:info.outputPath('quarterly-budget-desktop-1180.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await wizard.getByRole('button',{name:'Finish setup and open tasks'}).click();await expect(page).toHaveURL(/view=tasks/);await expect(page.getByRole('region',{name:'Project main table'})).toBeVisible();
 const menu=page.getByRole('button',{name:'Actions for Prepare community assessment',exact:true});await menu.click();await expect(page.getByRole('menuitem',{name:'Edit task',exact:true})).toBeVisible();await page.getByRole('menuitem',{name:'Move to',exact:true}).hover();await expect(page.getByRole('menuitem',{name:'Project coordination',exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('task-actions-submenu.png'),fullPage:true});
 expect(commands.some(c=>c.op==='authorize_project_funding'&&c.p_lines[0].amount===300000&&c.p_lines[1].quarter===2)).toBe(true);
});

test('Create project keeps the wide wizard and authorizes funding in place',async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width:1440,height:1000});
 const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 const id=crypto.randomUUID(),source=crypto.randomUUID();
 const project={...records.projects[0],id,title:'',description:'',scope:'',project_lead_id:null,start_date:null,target_date:null,funding_not_required:false};
 const funds:{id:string;name:string;fiscal_year:number;amount:number;available:number}[]=[];
 const writes:string[]=[];
 await page.route(/\/rest\/v1\/rpc\/(create_project_draft_once|project_flow_snapshot|save_project_definition|authorize_project_funding|finish_project_setup)$/,async route=>{
  const name=route.request().url().split('/').at(-1),body=route.request().postDataJSON();
  if(name==='create_project_draft_once'){
   writes.push(name); expect(body.p_key).toBeTruthy();
   Object.assign(project,body.p_payload);records.projects.push(project);
   records.projectOffices.push({id:crypto.randomUUID(),project_id:id,office_id:records.org,relationship_type:'lead',invitation_status:'joined'});
   return route.fulfill({json:project});
  }
  if(name==='project_flow_snapshot'){
   if(body.p_project!==id)return route.fallback();
   const total=funds.reduce((sum,fund)=>sum+fund.amount,0);
   return route.fulfill({json:{project,ready:total>0,canAuthorize:true,canAllocate:true,funds,sources:[{id:source,name:'Community services',year:2027,available:10000-total}],total,allocated:0,unallocated:total,released:0,spent:0,requests:[],fundingRequests:[],taskFunding:[],liquidations:[]}});
  }
  if(name==='save_project_definition'){
   writes.push(name);
   const d=body.p_details;
   Object.assign(project,{title:d.title,description:d.description,scope:d.scope,project_lead_id:d.lead,start_date:d.start,target_date:d.end,funding_not_required:d.noFunding,updated_at:new Date().toISOString()});
   return route.fulfill({json:project});
  }
  if(name==='authorize_project_funding'){
   writes.push(name);
   expect(project.scope).toBe('Workshop delivery');
   expect(body.p_lines).toEqual([{partitionId:source,amount:1234.56}]);
   expect(body.p_reason).toBe('Approved annual work programme');
   funds.push({id:crypto.randomUUID(),name:'Community services',fiscal_year:2027,amount:1234.56,available:1234.56});
   return route.fulfill({json:{authorized:1234.56}});
  }
  writes.push('finish_project_setup');return route.fulfill({json:null});
 });
 await page.goto(`/projects?page=Projects&workspace=${records.org}`);
 await page.getByRole('button',{name:'Create project',exact:true}).click();
 const wizard=page.locator('.eflow-responsive-modal').filter({has:page.locator('.pf-wizard-modal')});
 await expect(wizard).toBeVisible();
 expect((await wizard.boundingBox())!.width).toBeGreaterThan(1000);
 await expect(wizard.locator('.pf-wizard-opening-preview')).toBeVisible();
 await expect(wizard.getByRole('navigation',{name:'Project setup steps'}).getByRole('button')).toHaveCount(6);
 await page.setViewportSize({width:390,height:844});
 expect(await wizard.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
 await page.setViewportSize({width:1440,height:1000});
 await wizard.getByLabel('Project title *').fill('QA funded project');
 await wizard.getByLabel('Description *').fill('Support local enterprises.');
 const next=wizard.getByRole('button',{name:'Next',exact:true});
 await next.click();
 await wizard.getByLabel('Scope of the project *').fill('Workshop delivery');
 await next.click();
 await wizard.getByLabel('Project Lead *').selectOption(records.id);
 await wizard.getByLabel('Project start date *').fill('2027-01-01');
 await wizard.getByLabel('Project target date *').fill('2027-06-30');
 await next.click();
 const budget=wizard.getByRole('region',{name:'Project budget'});
 await expect(budget.getByLabel('Fiscal year')).toBeEnabled();
 expect(writes).toEqual(['create_project_draft_once','save_project_definition']);
 await expect(wizard.getByRole('button',{name:'Save details and load funding'})).toHaveCount(0);
 await budget.getByLabel('Fiscal year').selectOption('2027');
 await budget.getByLabel('Office Budget source').selectOption(source);
 await budget.getByRole('spinbutton').fill('1234.56');
 await budget.getByLabel('Reason / approved authority reference').fill('Approved annual work programme');
 await budget.getByRole('button',{name:'Authorize project funding'}).click();
 await expect(budget.getByText('Project funding authorized.')).toBeVisible();
 await expect(wizard.getByLabel('No funding required for this project')).toBeDisabled();
 await next.click();
 await expect(wizard.getByRole('region',{name:'Project people'})).toBeVisible();
 await next.click();
 await expect(wizard.getByText('FY 2027 · Community services')).toBeVisible();
 await wizard.getByRole('button',{name:'Create project',exact:true}).click();
 await expect(wizard).toHaveCount(0);
 expect(writes).toEqual(['create_project_draft_once','save_project_definition','authorize_project_funding','finish_project_setup']);
});
