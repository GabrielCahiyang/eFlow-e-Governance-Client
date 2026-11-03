import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
test('Leading task overview keeps its facts readable across desktop zoom widths and dark mode',async({page},info)=>{
 test.setTimeout(150000);await page.setViewportSize({width:1440,height:1000});
 const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 const task=records.tasks[0];records.tasks.splice(1);records.subtasks.splice(0);
 Object.assign(task,{title:'Book venue',status:'todo',start_date:'2026-10-31',deadline:'2026-11-05',due_date:'2026-11-05',project_title:'Customer Service Seminar',description:'Confirm the venue and prepare the meeting room.',assigned_to:records.id,recommendation_lead_id:null,subtask_count:0,subtask_completed_count:0});
 records.projects[0].title='Customer Service Seminar';records.organizations[0].name='LEDIPO';
 await page.route(/\/rest\/v1\/tasks\?/,route=>route.request().headers().accept?.includes('vnd.pgrst.object')?route.fulfill({json:task}):route.fallback());
 await page.reload();
 await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'My Work',exact:true}).click();
 await page.getByRole('navigation',{name:'My Work destinations'}).getByRole('button',{name:'Leading',exact:true}).click();
 await page.locator('[data-personal-task]').filter({hasText:'Book venue'}).click({timeout:30000});
 await page.getByRole('tab',{name:'Overview',exact:true}).click();
 const overview=page.getByRole('region',{name:'Task overview',exact:true});
 await expect(overview.getByRole('heading',{name:'Task overview'})).toBeVisible();
 await expect(overview.getByText('Office: LEDIPO')).toBeVisible();await expect(overview.getByText('Customer Service Seminar',{exact:true})).toBeVisible();
 await expect(overview.getByText('Progress',{exact:true})).toHaveCount(0);
 for(const width of [1440,1100,800]){
  await page.setViewportSize({width,height:1000});
  const summary=overview.locator('.task-overview__summary');await expect(summary).toBeVisible();
  expect(await summary.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await summary.screenshot({path:info.outputPath(`task-overview-${width}.png`)});
 }
 await page.evaluate(()=>document.documentElement.classList.add('dark'));await overview.locator('.task-overview__summary').screenshot({path:info.outputPath('task-overview-dark.png')});
});
