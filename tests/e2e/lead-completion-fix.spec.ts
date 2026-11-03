import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';

test('task lead submits finished work with evidence without a second start request',async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:1000});
 const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 records.subtasks.splice(0);const task=records.tasks[0];Object.assign(task,{status:'todo',subtask_count:0,subtask_completed_count:0});
 let starts=0;const submissions:any[]=[];
 await page.route(/\/rest\/v1\/tasks\?/,route=>route.request().headers().accept?.includes('vnd.pgrst.object')?route.fulfill({json:task}):route.fallback());
 await page.route('**/rest/v1/rpc/transition_task_status',route=>{starts++;return route.fulfill({status:400,json:{message:'Task is already in progress'}});});
 await page.route('**/storage/v1/object/task-attachments/**',route=>route.fulfill({json:{Key:route.request().url().split('/task-attachments/')[1]}}));
 await page.route('**/rest/v1/rpc/submit_task_for_review',route=>{
  const body=route.request().postDataJSON();submissions.push(body);Object.assign(task,{status:'for_review',latest_submission:body.p_submission});return route.fulfill({json:task});
 });
 await page.reload();
 await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'My Work',exact:true}).click();
 await page.getByRole('navigation',{name:'My Work destinations'}).getByRole('button',{name:'Leading',exact:true}).click();
 await page.locator('[data-personal-task]').filter({hasText:String(task.title)}).click();
 const detail=page.getByRole('region',{name:`Task details: ${task.title}`,exact:true});await expect(detail).toBeVisible();
 await detail.getByRole('tab',{name:'Update work',exact:true}).click();
 await detail.getByLabel('Work status',{exact:true}).selectOption('submit');
 await detail.getByLabel('Completion note',{exact:true}).fill('Venue confirmed and checklist completed.');
 await detail.getByLabel('Evidence files',{exact:true}).setInputFiles({name:'venue-proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 QA evidence')});
 await page.screenshot({path:info.outputPath('lead-submit-evidence-desktop.png'),fullPage:true});
 await detail.getByRole('button',{name:'Submit for review',exact:true}).click();
 await expect.poll(()=>submissions.length).toBe(1);expect(starts).toBe(0);
 expect(submissions[0].p_submission.attachments).toEqual([expect.objectContaining({fileName:'venue-proof.pdf'})]);
 await expect(detail.getByRole('tab',{name:'Review',exact:true})).toHaveAttribute('aria-selected','true');
});
