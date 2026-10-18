import { test, expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './fixtures/projectWorkspace';

test.setTimeout(120_000);
async function imagesLoaded(page:Page) {
  const images=page.locator('.eflow-empty-illustration:visible');
  await expect(images.first()).toBeVisible();
  await expect.poll(()=>images.evaluateAll(elements=>elements.every(e=>{const i=e as HTMLImageElement;return i.complete&&i.naturalWidth>0;}))).toBe(true);
}
test('all four My Work tabs center their empty state in the remaining workspace',async({page},info)=>{
  await page.setViewportSize({width:1918,height:914});
  const state=await projectWorkspaceFixture(page,'head',false,{landingOnly:true,empty:true});
  state.subtasks.length=0;
  for(const tab of ['Assigned work','Leading','Subtasks','History']){
    await page.goto('/my-work?page='+encodeURIComponent(tab));await imagesLoaded(page);
    const empty=page.locator('.r10-work-list-view .eflow-illustrated-empty');
    await expect(empty).toHaveAttribute('data-fill','true');
    const geometry=await empty.evaluate(element=>{
      const r=element.getBoundingClientRect();
      const children=Array.from(element.children).map(child=>child.getBoundingClientRect());
      const top=Math.min(...children.map(c=>c.top)),bottom=Math.max(...children.map(c=>c.bottom));
      const workspace=element.closest('.eflow-app-shell__workspace')!.getBoundingClientRect();
      return {center:(top+bottom)/2,expected:(r.top+r.bottom)/2,bottom:r.bottom,workspaceBottom:workspace.bottom,height:r.height};
    });
    expect(Math.abs(geometry.center-geometry.expected)).toBeLessThan(3);
    expect(geometry.height).toBeGreaterThan(400);
    expect(Math.abs(geometry.workspaceBottom-geometry.bottom)).toBeLessThan(45);
    await page.screenshot({path:info.outputPath(`centered-${tab.replaceAll(' ','-')}.png`),fullPage:true});
  }
  await page.setViewportSize({width:375,height:812});
  await expect.poll(()=>emptyBounds(page)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
async function emptyBounds(page:Page) {
  return page.locator('.r10-work-list-view .eflow-illustrated-empty').evaluate(element=>{
    const rect=element.getBoundingClientRect(),children=Array.from(element.children).map(e=>e.getBoundingClientRect());
    return Math.abs((Math.min(...children.map(r=>r.top))+Math.max(...children.map(r=>r.bottom)))/2-(rect.top+rect.bottom)/2)<3;
  });
}
for(const role of ['admin','head','member','accounting_staff'] as const)test(`${role} empty states use local artwork without blocking navigation`,async({page},info)=>{
  const remote:string[]=[];page.on('request',req=>{if(new URL(req.url()).hostname.endsWith('undraw.co'))remote.push(req.url());});
  await projectWorkspaceFixture(page,role,false,{landingOnly:true,empty:true});
  await page.goto(role==='admin'?'/users?page=Account%20Audit':'/my-work?page=Assigned%20work');
  await imagesLoaded(page);
  await expect(page.getByRole('heading',{name:'Access denied',exact:true})).toHaveCount(0);
  expect(remote).toEqual([]);
  await page.screenshot({path:info.outputPath(`${role}-empty.png`),fullPage:true});
});
test('filtering work shows search artwork and clearing filters restores the work',async({page})=>{
  await projectWorkspaceFixture(page,'member',false,{landingOnly:true});
  await page.goto('/my-work?page=Assigned%20work');
  const search=page.getByRole('searchbox',{name:'Search personal work'});
  await expect(page.getByRole('button',{name:/^Prepare community assessment Office/})).toBeVisible();
  await search.fill('nothing-matches-this-query');await imagesLoaded(page);
  await expect(page.locator('img[data-illustration=search]')).toBeVisible();
  await page.getByRole('button',{name:'Clear search and filters',exact:true}).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('button',{name:/^Prepare community assessment Office/})).toBeVisible();
  await expect(page.locator('.r10-work-list-view .eflow-empty-illustration')).toHaveCount(0);
});
for(const width of [375,768,1440])test(`empty Head dashboard fits ${width}px in dark mode with reduced motion`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
  await projectWorkspaceFixture(page,'head',false,{landingOnly:true,empty:true,theme:'dark'});
  await page.goto('/overview?page=Workspace%20Overview');await imagesLoaded(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const geometry=await page.locator('.eflow-empty-illustration:visible').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height,fit:getComputedStyle(e).objectFit};}));
  expect(geometry.every(r=>r.width<=208&&r.height<=144&&r.fit==='contain')).toBe(true);
  await page.screenshot({path:info.outputPath(`head-dashboard-dark-${width}.png`),fullPage:true});
});
