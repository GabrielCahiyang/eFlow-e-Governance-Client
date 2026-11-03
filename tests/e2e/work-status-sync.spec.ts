import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {nestedWorkStaffingFixture} from './fixtures/nestedWorkStaffing';

for(const role of ['head','accounting_staff','member'] as const)test(`${role}: main table, Leading, Subtasks and History follow realtime status changes`,async({page},info)=>{
 test.setTimeout(150000);await page.setViewportSize({width:1440,height:1000});
 const records=await projectWorkspaceFixture(page,role,false,{landingOnly:true,taskChanges:true});
 // Keep every returned task covered by this scenario's authorized tree fixture.
 records.tasks.splice(1);records.subtasks.splice(1);
 const fixture=await nestedWorkStaffingFixture(page,records),task=records.tasks[0],step=records.subtasks[0];
 Object.assign(task,{status:'todo'});Object.assign(step,{status:'todo',is_completed:false,lead_id:records.id,assigned_to:records.id,assigned_to_ids:[records.id]});
 await page.route('**/rest/v1/rpc/r7_work_tree',route=>{const tree=fixture.snapshot();tree.root.status=String(task.status);tree.nodes.forEach(node=>node.blocker=node.id===step.id?String(step.blocker||''):null);return route.fulfill({json:tree});});
 await page.goto(`/projects?page=Projects&project=${records.project}&view=tasks`);
 const mainRow=page.locator('.pt-task-row').filter({hasText:String(task.title)});
 await expect(mainRow.getByRole('button',{name:'Update work status: Not started',exact:true})).toBeVisible({timeout:45000});
 await mainRow.getByRole('button',{name:`Subtasks for ${task.title}`,exact:true}).click();
 const child=page.locator(`[data-work-row="${step.id}"]`);await expect(child.getByText('Not started',{exact:true})).toBeVisible();
 Object.assign(task,{status:'in_progress'});Object.assign(step,{status:'in_progress',percent_complete:0});records.emitTaskUpdate(String(task.id));
 await expect(mainRow.getByRole('button',{name:'Update work status: In progress',exact:true})).toBeVisible({timeout:10000});
 await expect(child.getByText('In progress',{exact:true})).toBeVisible({timeout:10000});
 await page.getByRole('navigation',{name:'Global navigation'}).getByRole('button',{name:'My Work',exact:true}).click();
 const nav=page.getByRole('navigation',{name:'My Work destinations'});
 await nav.getByRole('button',{name:'Leading',exact:true}).click();
 const leadRow=page.locator(`[data-personal-task="${task.id}"]`);await expect(leadRow).toContainText('In progress',{timeout:30000});
 await nav.getByRole('button',{name:'Subtasks',exact:true}).click();
 const subRow=page.locator(`[data-work-key="office-node:${step.id}"]`);await expect(subRow).toContainText('In progress');
 Object.assign(step,{blocker:'Waiting for confirmation'});records.emitTaskUpdate(String(task.id));await expect(subRow).toContainText('Stuck',{timeout:10000});
 Object.assign(step,{blocker:null});records.emitTaskUpdate(String(task.id));await expect(subRow).toContainText('In progress',{timeout:10000});
 Object.assign(step,{status:'completed',is_completed:true,percent_complete:100});records.emitTaskUpdate(String(task.id));
 await expect(subRow).toHaveCount(0,{timeout:10000});
 await nav.getByRole('button',{name:'History',exact:true}).click();await expect(subRow).toContainText('Completed');
 await nav.getByRole('button',{name:'Leading',exact:true}).click();
 Object.assign(task,{status:'for_review'});records.emitTaskUpdate(String(task.id));
 await expect(leadRow).toContainText('Awaiting approval',{timeout:10000});
 await page.screenshot({path:info.outputPath(`leading-awaiting-approval-${role}.png`),fullPage:true});
 Object.assign(task,{status:'completed'});records.emitTaskUpdate(String(task.id));await expect(leadRow).toHaveCount(0,{timeout:10000});
 await nav.getByRole('button',{name:'History',exact:true}).click();await expect(leadRow).toContainText('Completed');
});
