import {test,expect as baseExpect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
const expect=baseExpect.configure({timeout:25_000});
test.setTimeout(120_000);

// Synthetic API records only. Real hosted review receipts are documented separately.
for(const theme of ['light','dark'] as const)test(`approved project completion and archive remain usable in ${theme}`,async({page},info)=>{
 await page.setViewportSize({width:1920,height:1080});
 const r=await projectWorkspaceFixture(page,'head',false,{theme});
 Object.assign(r.projects[0],{status:'active',start_date:'2026-10-18',target_date:'2026-10-25'});
 r.tasks.forEach(task=>Object.assign(task,{status:'completed',percent_complete:100}));
 r.subtasks.forEach(task=>Object.assign(task,{status:'completed',percent_complete:100}));
 let completeCalls=0,archiveCalls=0;
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/rest/v1/rpc/get_project_completion_readiness',route=>route.fulfill({json:{projectId:r.project,title:'Community outreach',status:r.projects[0].status,canComplete:r.projects[0].status==='active',blockers:[]}}));
 await page.route('**/rest/v1/rpc/complete_project',async route=>{completeCalls++;r.projects[0].status='completed';await route.fulfill({json:null});});
 await page.route('**/rest/v1/rpc/archive_completed_project',async route=>{archiveCalls++;Object.assign(r.projects[0],{status:'archived',archived_at:new Date().toISOString()});await route.fulfill({json:null});});
 await page.reload();
 await page.getByRole('button',{name:'Completion requirements',exact:true}).click({timeout:30_000});
 const completion=page.getByRole('dialog',{name:'Mark project complete',exact:true});
 await expect(completion).toBeVisible();
 await expect(completion.getByRole('button',{name:'Confirm completion',exact:true})).toBeEnabled();
 await page.screenshot({path:info.outputPath(`completion-${theme}-1920.png`)});
 await completion.getByRole('button',{name:'Confirm completion',exact:true}).click();
 await expect(completion).toHaveCount(0);expect(completeCalls).toBe(1);
 await page.getByRole('button',{name:'Project actions',exact:true}).click();
 await page.getByRole('menuitem',{name:'Archive project',exact:true}).click();
 const archive=page.getByRole('dialog',{name:'Archive project',exact:true});
 await expect(archive).toBeVisible();
 await archive.getByRole('button',{name:'Archive project',exact:true}).click();
 await expect(archive).toHaveCount(0);expect(archiveCalls).toBe(1);
 await expect(page.getByRole('region',{name:'All projects',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Community outreach',exact:true}).click();
 await expect(page.getByRole('status',{name:'Project lifecycle: Archived',exact:true})).toBeVisible();
 await expect(page.getByRole('status',{name:'Project schedule: Completed',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'New task',exact:true})).toHaveCount(0);
 for(const width of [1920,1440,390]){
  await page.setViewportSize({width,height:width===1920?1080:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`archived-${theme}-${width}.png`)});
 }
 expect(errors).toEqual([]);
});
