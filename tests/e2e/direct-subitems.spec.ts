import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {nestedWorkStaffingFixture} from './fixtures/nestedWorkStaffing';

test('desktop subitems finish directly and leave parent approval separate',async({page},info)=>{
 test.setTimeout(120_000);await page.setViewportSize({width:1440,height:1000});
 const records=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 const fixture=await nestedWorkStaffingFixture(page,records);
 Object.assign(records.subtasks[0],{lead_id:records.id,assigned_to:records.id,assigned_to_ids:[records.id],is_completed:false});
 const calls:any[]=[];
 await page.route(/\/rest\/v1\/rpc\/r7_work_tree$/,async route=>{
  const data=fixture.snapshot();data.leaf_completed=data.nodes.filter(node=>node.status==='completed').length;for(const node of data.nodes){const open=node.status!=='completed';node.capabilities={...node.capabilities,execute:{allowed:open,reason_code:open?null:'lifecycle_blocked'},submit:{allowed:open,reason_code:open?null:'lifecycle_blocked'},review:{allowed:false,reason_code:'lifecycle_blocked'}};}
  await route.fulfill({json:data});
 });
 await page.route(/\/rest\/v1\/rpc\/complete_subitem$/,async route=>{
  const body=route.request().postDataJSON();calls.push(body);expect(body.p_completion.note).toBe('');expect(body.p_completion.attachments).toEqual([]);
  Object.assign(records.subtasks[0],{status:'completed',is_completed:true,percent_complete:100,completed_by:records.id,completed_at:new Date().toISOString()});
  await route.fulfill({json:records.subtasks[0]});
 });
 await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'My Work',exact:true}).click();
 await page.getByRole('navigation',{name:'My Work destinations'}).getByRole('button',{name:'Leading',exact:true}).click();
 await page.locator('[data-personal-task]').filter({hasText:'Prepare community assessment'}).click();
 const task=page.getByRole('region',{name:'Task details: Prepare community assessment',exact:true});await expect(task).toBeVisible();
 await expect(task.getByRole('columnheader',{name:'Progress',exact:true})).toHaveCount(0);
 await task.getByRole('button',{name:'Gather supporting evidence',exact:true}).click();
 const subitem=page.getByRole('region',{name:'Subtask: Gather supporting evidence',exact:true});await expect(subitem).toBeVisible();
 await expect(subitem.getByRole('button',{name:'Review evidence'})).toHaveCount(0);
 await subitem.getByLabel('Work status',{exact:true}).selectOption('submit');
 await page.screenshot({path:info.outputPath('direct-completion-desktop.png'),fullPage:true});
 await subitem.getByRole('button',{name:'Mark complete',exact:true}).click();
 await expect(subitem.getByText('This step is complete.',{exact:true})).toBeVisible();expect(calls).toHaveLength(1);
 await page.screenshot({path:info.outputPath('completed-subitem-desktop.png'),fullPage:true});
 await subitem.getByRole('button',{name:'Back to work'}).click();
 await expect(task.getByText('1/1 steps complete',{exact:true})).toBeVisible();
 await task.getByRole('tab',{name:'Update work',exact:true}).click();
 await task.getByLabel('Work status',{exact:true}).selectOption('submit');
 await expect(task.getByRole('button',{name:'Submit for review',exact:true})).toBeDisabled();
 await expect(task.getByLabel('Completion note',{exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('parent-final-review-desktop.png'),fullPage:true});
});
