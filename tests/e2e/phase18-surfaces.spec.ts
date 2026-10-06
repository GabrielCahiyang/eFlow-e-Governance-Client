import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
test.setTimeout(120_000);
for(const surface of ['Office Team','Reports','Inbox'] as const) test(`${surface}: accessible responsive secondary workspace`,async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const data=await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
  data.profiles.push({id:'00000000-0000-4000-8000-000000000010',org_id:data.org,full_name:'Maria Santos with a representative long Office member name',email:'maria@example.test',role:'member',is_active:true});
  const url=surface==='Office Team'?'/team-supervision?page=Office%20Team':surface==='Reports'?'/reports?page=Reports':'/inbox?page=Inbox';
  await page.goto(url);
  if(surface==='Office Team') await expect(page.getByRole('region',{name:surface,exact:true})).toBeVisible();
  else await expect(page.getByRole('heading',{name:surface,exact:true,level:1})).toBeVisible();
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>document.fonts.ready);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    const findings=result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,detail:n.failureSummary}))}));
    await info.attach(`${surface}-${width}-a11y`,{body:JSON.stringify(findings),contentType:'application/json'});
    if(process.env.EFLOW_RELEASE_BASELINE!=='1'){
      expect(findings.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
    await page.screenshot({path:info.outputPath(`${surface}-${width}.png`),fullPage:true,animations:'disabled'});
  }
});
