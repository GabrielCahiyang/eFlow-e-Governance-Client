import {test,expect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';

for(const width of [1440,390])test(`duplicate project work names are rejected before creating records at ${width}px`,async({page},info)=>{
 test.setTimeout(120_000);await page.setViewportSize({width,height:900});
 const records=await projectWorkspaceFixture(page,'head');
 const groupCount=records.groups.length,taskCount=records.tasks.length;
 await page.getByRole('button',{name:'New task options',exact:true}).click();
 await page.getByRole('menuitem',{name:'New group',exact:true}).click();
 const group=page.getByRole('dialog',{name:'New group',exact:true});
 await group.getByRole('textbox').fill('  '+String(records.groups[0].title).toUpperCase()+'  ');
 await group.getByRole('button',{name:'Add group',exact:true}).click();
 await expect(group.getByText(/already exists here/)).toBeVisible();expect(records.groups).toHaveLength(groupCount);
 await group.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Discard',exact:true}).click();
 await page.getByRole('button',{name:'New task',exact:true}).click();
 const task=page.getByRole('dialog',{name:'New task',exact:true});
 await task.getByRole('textbox').fill('  PREPARE  COMMUNITY ASSESSMENT ');
 await task.getByRole('button',{name:'Add task',exact:true}).click();
 await expect(task.getByText(/already exists here/)).toBeVisible();expect(records.tasks).toHaveLength(taskCount);
 await page.screenshot({path:info.outputPath(`duplicate-task-${width}.png`)});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Admin sees a clear PDS file validation error and retains entered profile details',async({page})=>{
 test.setTimeout(120_000);const records=await projectWorkspaceFixture(page,'admin');Object.assign(records.organizations[0],{name:'LEDIPO',slug:'ledipo'});await page.reload();
 await page.getByRole('button',{name:'Create LEDIPO User',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Create LEDIPO User',exact:true});
 await dialog.getByPlaceholder('Juan Dela Cruz').fill('Retained profile');
 await dialog.locator('input[type=file]').setInputFiles({name:'profile.exe',mimeType:'application/octet-stream',buffer:Buffer.from('not a workbook')});
 await expect(page.getByText(/Choose an XLS or XLSX Excel workbook/)).toBeVisible();
 await expect(dialog.getByPlaceholder('Juan Dela Cruz')).toHaveValue('Retained profile');
});
