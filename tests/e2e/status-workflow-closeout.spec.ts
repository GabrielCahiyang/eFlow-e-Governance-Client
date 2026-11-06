import {test,expect as baseExpect} from '@playwright/test';
import {projectWorkspaceFixture} from './fixtures/projectWorkspace';
const expect=baseExpect.configure({timeout:25_000});
test.setTimeout(120_000);

test('completion clears funding and settlement blockers as each is resolved',async({page})=>{
 const r=await projectWorkspaceFixture(page,'head');
 r.projects[0].status='active';
 let taskUnused=6000, projectUnused=25000, settlementPosted=false;
 await page.route('**/rest/v1/rpc/project_flow_snapshot',route=>route.fulfill({json:{
  project:{...r.projects[0],funding_not_required:false},ready:true,canAuthorize:true,canAllocate:true,
  funds:[{id:'venue-funding',name:'Project Budget',fiscal_year:2026,amount:4000+taskUnused+projectUnused,available:projectUnused}],sources:[],requests:[],fundingRequests:[],liquidations:[],
  taskFunding:[
   ...(taskUnused?[{id:'unused',taskId:'cleanup',task:'Venue Cleanup',source:'Project Budget',amount:taskUnused,available:taskUnused}]:[]),
   {id:'released',taskId:'reservation',task:'Venue Reservation',source:'Project Budget',amount:4000,available:0},
  ],
  total:4000+taskUnused+projectUnused,allocated:4000+taskUnused,unallocated:projectUnused,released:4000,spent:0,outstanding:4000,
 }}));
 await page.route('**/rest/v1/rpc/release_project_task_funding',route=>{
  expect(route.request().postDataJSON()).toMatchObject({p_line:'unused',p_amount:6000});
  projectUnused+=taskUnused;taskUnused=0;
  return route.fulfill({json:null});
 });
 await page.route('**/rest/v1/rpc/release_project_funding',route=>{
  expect(route.request().postDataJSON()).toMatchObject({p_source:'venue-funding',p_amount:31000});
  projectUnused=0;
  return route.fulfill({json:null});
 });
 await page.route('**/rest/v1/rpc/get_project_completion_readiness',route=>route.fulfill({json:{
  projectId:r.project,status:'active',canComplete:settlementPosted && taskUnused+projectUnused===0,blockers:[
   ...(!settlementPosted?[{kind:'cash',id:'advance',title:'Venue advance',amount:4000,status:'pending_department_settlement',detail:'Settlement required.'}]:[]),
   ...(taskUnused+projectUnused>0?[{kind:'funding',id:r.project,title:'Return unused funding to Office Budget',status:'release_required',
    detail:'Release these funds before completing.',amount:taskUnused+projectUnused,unusedFunding:{unallocated:projectUnused,
     taskAllocations:taskUnused?[{id:'unused',task:'Venue Cleanup',source:'Project Budget',available:taskUnused}]:[]}}]:[]),
  ],
 }}));
 await page.getByRole('button',{name:'Completion requirements',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Mark project complete'});
 const unused=dialog.getByRole('group',{name:'Unused project funding'});
 await expect(unused.getByText('Venue Cleanup')).toBeVisible();
 await expect(unused.getByText('₱6,000.00 unused')).toBeVisible();
 await expect(unused.getByText('₱25,000.00',{exact:true})).toBeVisible();
 await expect(unused.getByText('Venue Reservation')).toHaveCount(0);
 await expect(dialog.getByText('Awaiting Accounting settlement · ₱4,000.00')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm completion'})).toBeDisabled();
 await expect(dialog.getByText('Release required · ₱31,000.00')).toBeVisible();
 await dialog.getByRole('button',{name:'Review project funding'}).click();
 await expect(page.getByRole('heading',{name:'Project budget',exact:true})).toBeVisible();
 page.on('dialog',prompt=>prompt.accept('Verified unused funding'));
 await page.getByRole('button',{name:'Return unused to project',exact:true}).first().click();
 await expect(page.getByText('Unused task funding returned to the project.')).toBeVisible();
 await page.getByRole('button',{name:'Release unused',exact:true}).click();
 await expect(page.getByText('Unused project funding released with an audit record.')).toBeVisible();
 await page.getByRole('button',{name:'Completion requirements',exact:true}).click();
 await expect(dialog.getByText('Return unused funding to Office Budget')).toHaveCount(0);
 await expect(dialog.getByText('Awaiting Accounting settlement · ₱4,000.00')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm completion'})).toBeDisabled();

 settlementPosted=true;
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(dialog.getByText('Awaiting Accounting settlement · ₱4,000.00')).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Confirm completion'})).toBeEnabled();
});

test('a blocked auto-archive alert opens the current project requirements',async({page})=>{
 const r=await projectWorkspaceFixture(page,'head');
 r.projects[0].status='completed';
 await page.route('**/rest/v1/notifications*',route=>route.fulfill({json:[{
  id:'archive-alert',user_id:r.id,project_id:r.project,org_id:r.org,type:'project_archive_blocked',
  title:'Auto-archive needs attention',message:'A cash advance remains open.',read:false,created_at:'2026-11-06T00:00:00Z',
 }]}));
 await page.route('**/rest/v1/rpc/get_project_completion_readiness',route=>{
  expect(route.request().postDataJSON().p_project_id).toBe(r.project);
  return route.fulfill({json:{projectId:r.project,status:'completed',canComplete:false,blockers:[
   {kind:'cash',id:'cash-blocker',title:'Unsettled venue advance',status:'released',detail:'Settle the advance in Accounting.'},
  ]}});
 });
 await page.goto('/inbox?page=Updates');
 await page.getByRole('region',{name:'Recent updates'}).getByRole('button',{name:'Open update'}).click();
 const dialog=page.getByRole('dialog',{name:'Archive requirements'});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByText('Unsettled venue advance')).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm completion'})).toHaveCount(0);
});

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
