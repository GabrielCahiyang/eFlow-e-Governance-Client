import {expect,test} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';

test('production workspace retry assets retain their named component exports',async({page})=>{
 test.skip(process.env.EFLOW_E2E_PRODUCTION!=='1','Run against the built preview with EFLOW_E2E_PRODUCTION=1');
 test.setTimeout(90000);
 await page.setViewportSize({width:1440,height:1000});
 await projectWorkspaceFixture(page,'head',false,{landingOnly:true});
 const before=page.url();
 const names=['ProjectsWorkspace','HeadProjectsWorkspace','EmployeeProjectsWorkspace','ProjectCommandWorkspace','ProjectActivityHistory','ProjectMembers','ProjectInvitations','SubtaskReviewInbox','HeadTaskBoardView','EmployeeTaskWorkspace','TaskDetailDrawer','AdminTaskOversight'];
 const viewExports=await page.evaluate(async names=>{
  const response=await fetch('/eflow-view-modules.json',{cache:'no-store'});
  if(!response.ok)throw new Error('Retry manifest unavailable');
  const manifest=await response.json();
  const result:Record<string,string>={};
  for(const name of names){
   const file=manifest[name];
   if(typeof file!=='string'||!/^assets\/[\w-]+\.js$/.test(file))throw new Error('Missing retry asset: '+name);
   const url=new URL(file,location.origin);url.searchParams.set('eflow-retry',crypto.randomUUID());
   const module=await import(/* @vite-ignore */ url.href);
   result[name]=typeof module[name];
  }
  return result;
 },names);
 for(const name of names)expect(['function','object']).toContain(viewExports[name]);
 expect(page.url()).toBe(before);
});
