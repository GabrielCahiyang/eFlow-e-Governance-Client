import {test,expect,type Page} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
import {auditDetailRows} from './fixtures/auditDetails';
test.setTimeout(120000);
async function fixture(page:Page){
 await projectWorkspaceFixture(page,'admin',false,{landingOnly:true});
 const state={rows:auditDetailRows(),fail:false,reads:[] as string[],writes:[] as string[]};
 await page.route('**/rest/v1/audit_events*',route=>{
  if(route.request().method()!=='GET')state.writes.push(route.request().method());
  state.reads.push(route.request().url());
  return state.fail?route.fulfill({status:403,json:{message:'Audit permission changed'}}):route.fulfill({json:state.rows,headers:{'content-range':state.rows.length?`0-${state.rows.length-1}/${state.rows.length}`:'*/0','access-control-expose-headers':'content-range'}});
 });
 await page.goto('/users?page=Account%20Audit');return state;
}
const inspect=(page:Page)=>page.getByRole('button',{name:'Inspect audit event audit-access-change-2026-0001',exact:true}).click();
const noOverflow=(page:Page)=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
for(const width of [320,375,768,1024,1440])test(`in-page audit details are readable and keyboard accessible at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});const state=await fixture(page);await inspect(page);
 const details=page.locator('.record-detail-page');await expect(details.getByRole('heading',{level:1,name:'Profile updated'})).toBeFocused();
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('table')).toHaveCount(0);
 expect(await page.evaluate(()=>!document.getElementById('root')?.inert&&document.body.style.overflow!=='hidden')).toBe(true);
 expect(await noOverflow(page)).toBe(true);await page.screenshot({path:info.outputPath(`after-overview-${width}.png`),fullPage:true});
 await details.getByRole('tab',{name:'Changed fields',exact:true}).click();
 const pair=details.locator('.audit-detail__pair').first(),values=pair.locator('.audit-detail__value');
 await expect(values.first()).toContainText('Original assignment.');await expect(values.nth(1)).toContainText('Updated coordination responsibilities.');
 const rects=await values.evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
 if((await details.locator('.record-detail-page__body').boundingBox())!.width<=760)expect(rects[1].y).toBeGreaterThan(rects[0].y);else expect(Math.abs(rects[1].y-rects[0].y)).toBeLessThan(1);
 expect(await noOverflow(page)).toBe(true);await page.screenshot({path:info.outputPath(`after-changes-${width}.png`),fullPage:true});
 await details.getByRole('tab',{name:'Technical details',exact:true}).click();await expect(details.getByText(/Approved administrative change/)).toBeVisible();
 expect(await details.textContent()).not.toMatch(/before-private-secret|after-private-secret|metadata-private-secret|private-home-address/);
 await page.screenshot({path:info.outputPath(`after-technical-${width}.png`),fullPage:true});
 const overview=details.getByRole('tab',{name:'Overview',exact:true});await overview.focus();await page.keyboard.press('Home');await expect(overview).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('ArrowRight');await expect(details.getByRole('tab',{name:'Changed fields',exact:true})).toHaveAttribute('aria-selected','true');
 await page.keyboard.press('End');await expect(details.getByRole('tab',{name:'Technical details',exact:true})).toHaveAttribute('aria-selected','true');
 await details.getByRole('button',{name:'Back to Account Audit',exact:true}).click();await expect(page.getByRole('button',{name:'Inspect audit event audit-access-change-2026-0001',exact:true})).toBeFocused();
 expect(state.writes).toEqual([]);expect(state.reads.every(url=>new URL(url).searchParams.get('limit')==='500'&&!new URL(url).searchParams.has('id'))).toBe(true);
});
test('audit Back preserves query, table order, scroll and focus; reload returns to the list',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fixture(page);
 const search=page.getByPlaceholder('Search person, action or record…');await search.fill('profile');await page.getByRole('button',{name:'Actor',exact:true}).click();
 const trigger=page.getByRole('button',{name:'Inspect audit event audit-access-change-2026-0001',exact:true});await trigger.scrollIntoViewIfNeeded();
 const before=await trigger.evaluate(element=>{const positions:number[]=[];for(let parent=element.parentElement;parent;parent=parent.parentElement)positions.push(parent.scrollTop);return positions;});
 await trigger.click();await page.getByRole('tab',{name:'Changed fields',exact:true}).click();await page.locator('.audit-detail__footer').scrollIntoViewIfNeeded();
 await page.getByRole('button',{name:'Back to Account Audit',exact:true}).click();await expect(trigger).toBeFocused();await expect(search).toHaveValue('profile');
 await expect(page.getByRole('columnheader',{name:/Actor/})).toHaveAttribute('aria-sort','ascending');
 expect(await trigger.evaluate(element=>{const positions:number[]=[];for(let parent=element.parentElement;parent;parent=parent.parentElement)positions.push(parent.scrollTop);return positions;})).toEqual(before);
 await trigger.click();expect(page.url()).not.toContain('auditEvent');await page.reload();await expect(page.getByRole('heading',{name:'Account Audit',exact:true})).toBeVisible();await expect(page.locator('.record-detail-page')).toHaveCount(0);
});
test('audit refresh removes inaccessible details, handles read failure and renders honest empty sections',async({page})=>{
 const state=await fixture(page);await inspect(page);state.rows=[];await page.getByRole('button',{name:'Refresh audit',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Event unavailable');await expect(page.getByText(/Moved to the project coordination team/)).toHaveCount(0);
 await page.getByRole('button',{name:'Back to Account Audit',exact:true}).click();state.rows=auditDetailRows();await page.getByRole('button',{name:'Refresh audit',exact:true}).click();
 await page.getByRole('button',{name:'Inspect audit event audit-action-only',exact:true}).click();await expect(page.getByText('No note was recorded for this event.')).toBeVisible();
 await page.getByRole('tab',{name:'Changed fields',exact:true}).click();await expect(page.getByText('No field-level changes were recorded.')).toBeVisible();
 await page.getByRole('tab',{name:'Technical details',exact:true}).click();await expect(page.getByText('No additional metadata was recorded.')).toBeVisible();
 state.fail=true;await page.getByRole('button',{name:'Refresh audit',exact:true}).click();await expect(page.getByRole('alert')).toContainText('could not be read');
 await page.getByRole('button',{name:'Back to Account Audit',exact:true}).click();await expect(page.getByRole('heading',{name:'Account Audit',exact:true})).toBeVisible();
});
test('audit detail reflows at 200 percent CSS zoom and in dark mode without forced motion',async({page},info)=>{
 await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await fixture(page);await inspect(page);
 await page.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.classList.add('dark');});
 await page.getByRole('tab',{name:'Changed fields',exact:true}).click();expect(await noOverflow(page)).toBe(true);
 await expect(page.getByRole('button',{name:'Back to Account Audit',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('after-zoom-200-dark.png'),fullPage:true});
});
