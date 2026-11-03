import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';

test('one task combines accounts, adds another later, and retains its budget after reload',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});
 const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 const task=records.tasks[0],funds=[{id:'supplies',name:'Supplies',fiscal_year:2026,amount:20000,available:15000},{id:'travel',name:'Travel',fiscal_year:2026,amount:10000,available:10000},{id:'logistics',name:'Logistics',fiscal_year:2026,amount:8000,available:8000}];
 const taskFunding:any[]=[],writes:any[]=[];
 await page.route('**/rest/v1/rpc/project_flow_snapshot',route=>route.fulfill({json:{project:{...records.projects[0],project_lead_id:records.id},ready:true,canAllocate:true,canAuthorize:true,canExtendTaskFunding:true,funds,sources:[],taskFunding,total:38000,allocated:5000+taskFunding.reduce((n,l)=>n+l.amount,0),unallocated:funds.reduce((n,f)=>n+f.available,0),requests:[],fundingRequests:[],liquidations:[],released:0,spent:0}}));
 await page.route('**/rest/v1/rpc/allocate_project_task_funding',route=>{
  const body=route.request().postDataJSON();writes.push(body);
  for(const line of body.p_lines){const fund=funds.find(f=>f.id===line.sourceId)!;fund.available-=line.amount;taskFunding.push({id:`line-${fund.id}`,sourceId:fund.id,fiscalYear:fund.fiscal_year,taskId:task.id,task:task.title,source:fund.name,amount:line.amount,available:line.amount});}
  return route.fulfill({json:'allocation'});
 });
 await page.goto(`/projects?page=Projects&project=${records.project}&view=tasks`);
 const budgetButton=page.getByRole('button',{name:`Budget for ${task.title}`,exact:true});
 await expect(budgetButton).toBeVisible({timeout:45000});await budgetButton.click();
 const dialog=page.getByRole('dialog',{name:`Task budget · ${task.title}`,exact:true});await expect(dialog).toBeVisible();
 await dialog.getByLabel('Task budget account 1',{exact:true}).selectOption('supplies');await dialog.getByLabel('Task account 1 amount',{exact:true}).fill('3000');await dialog.getByRole('button',{name:'Add another account',exact:true}).click();
 await dialog.getByLabel('Task budget account 2',{exact:true}).selectOption('travel');await dialog.getByLabel('Task account 2 amount',{exact:true}).fill('2000');await dialog.getByLabel('Allocation reason',{exact:true}).fill('Meeting supplies and travel');
 const accountBox=await dialog.getByLabel('Task budget account 1',{exact:true}).boundingBox(),amountBox=await dialog.getByLabel('Task account 1 amount',{exact:true}).boundingBox();expect(accountBox&&amountBox&&Math.abs(accountBox.y-amountBox.y)<2).toBeTruthy();
 await page.screenshot({path:info.outputPath('task-two-accounts.jpg'),fullPage:true});await dialog.getByRole('button',{name:'Allocate task budget',exact:true}).click();
 await expect(dialog.getByRole('heading',{name:'Allocated: ₱5,000',exact:true})).toBeVisible();
 await expect(dialog.getByRole('option',{name:/Supplies/})).toHaveCount(0);await dialog.getByLabel('Task budget account 1',{exact:true}).selectOption('logistics');await dialog.getByLabel('Task account 1 amount',{exact:true}).fill('1500');await dialog.getByLabel('Allocation reason',{exact:true}).fill('Additional delivery costs');
 await page.screenshot({path:info.outputPath('task-add-another-account.jpg'),fullPage:true});await dialog.getByRole('button',{name:'Add to task budget',exact:true}).click();
 await expect(dialog.getByRole('heading',{name:'Allocated: ₱6,500',exact:true})).toBeVisible();expect(writes.map(w=>w.p_lines)).toEqual([[{sourceId:'supplies',amount:3000},{sourceId:'travel',amount:2000}],[{sourceId:'logistics',amount:1500}]]);
 await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await expect(budgetButton).toHaveText(/6,500/,{timeout:30000});
 await page.setViewportSize({width:1280,height:800});await budgetButton.click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeVisible();
});
