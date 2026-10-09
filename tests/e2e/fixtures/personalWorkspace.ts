import { expect, type Page } from '@playwright/test';
import { projectWorkspaceFixture } from './projectWorkspace';

/** Synthetic browser API. Database authorization is separately exercised by verify:r3-workspaces. */
export async function personalWorkspaceFixture(page:Page, options:{seed?:boolean;denied?:boolean;role?:'member'|'accounting_staff';theme?:'light'|'dark'}={}) {
 const office=await projectWorkspaceFixture(page,options.role||'member',false,{landingOnly:true,theme:options.theme});
 const personalId='70000000-0000-4000-8000-000000000001';
 const projectId='71000000-0000-4000-8000-000000000001';
 const reviewer='00000000-0000-4000-8000-000000000002';
 const officeWorkspace={id:office.org,name:'Planning Office',kind:'office',office_id:office.org,owner_id:null,state:'active',timezone:'Asia/Singapore'};
 const privateWorkspace={id:personalId,name:'Private research',kind:'personal',office_id:null,owner_id:office.id,owner_name:'Alex Rivera',state:'active',timezone:'Asia/Singapore'};
 const workspaces:Record<string,unknown>[]=[officeWorkspace];
 const projects:Record<string,unknown>[]=[];
 const tasks:Record<string,unknown>[]=[];
 const members:Record<string,unknown>[]=[{user_id:office.id,name:'Alex Rivera',access:'member',state:'active',eligible:true}];
 const shortcuts:string[]=[];
 const calls:{operation:string;payload:Record<string,unknown>}[]=[];
 let failProject=false,denied=options.denied||false;
 if(options.seed){workspaces.push(privateWorkspace);projects.push({id:projectId,workspace_id:personalId,title:'Private project',status:'active',revision:1,kind:'personal',home_workspace_id:personalId});}
 await page.route('**/rest/v1/rpc/r3_*',async route=>{
  const operation=new URL(route.request().url()).pathname.split('/').at(-1)!;
  const payload=route.request().postDataJSON()||{};
  calls.push({operation,payload});
  let body:unknown;
  const refuse=(message:string,status=403)=>route.fulfill({status,json:{code:'42501',message}});
  if(operation==='r3_list_workspaces')body=denied?[officeWorkspace]:workspaces;
  if(operation==='r3_select_workspace'){
   if(payload.p_workspace!==office.org&&denied)return refuse('Workspace access denied');
   body={workspace:workspaces.find(w=>w.id===payload.p_workspace),projects:payload.p_workspace===office.org?[...office.projects.map(p=>({...p,kind:'office',home_workspace_id:office.org})),...(shortcuts.length?projects.map(p=>({...p,shortcut:true})):[])]:projects};
  }
  if(operation==='r3_create_workspace'){
   const found=workspaces.find(w=>w.id===payload.p_request);
   body=found||{...privateWorkspace,id:payload.p_request,name:payload.p_name,timezone:payload.p_timezone};if(!found)workspaces.push(body as Record<string,unknown>);
  }
  if(operation==='r3_create_personal_project'){
   if(failProject)return refuse('Could not create personal project',500);
   const found=projects.find(p=>p.id===payload.p_request);
   body=found||{id:payload.p_request,workspace_id:payload.p_workspace,title:payload.p_title,status:'active',revision:1,kind:'personal',home_workspace_id:payload.p_workspace};if(!found)projects.push(body as Record<string,unknown>);
  }
  if(operation==='r3_personal_project_snapshot'){
   if(denied)return refuse('Project access denied');
   body={project:projects.find(p=>p.id===payload.p_project),owner:office.id,tasks,members,shortcuts};
  }
  if(operation==='r3_personal_member_candidates')body=[{id:office.id,name:'Alex Rivera'},{id:reviewer,name:'Jordan Reviewer'}];
  if(operation==='r3_personal_project_command'){
   if(denied)return refuse('Project edit access denied');
   const data=payload.p_payload;
   if(payload.p_command==='create_task'){
    body={id:payload.p_request,project_id:payload.p_project,title:data.title,lead_id:data.lead_id,reviewer_id:data.reviewer_id,status:'todo',progress:0,note:'',review_note:'',revision:1};tasks.push(body as Record<string,unknown>);
   }else if(payload.p_command==='set_member'){
    const found=members.find(m=>m.user_id===data.user_id);
    body={user_id:data.user_id,name:'Jordan Reviewer',access:data.access,state:data.state,eligible:data.access==='member'&&data.state==='active'};
    if(found)Object.assign(found,body);else members.push(body as Record<string,unknown>);
   }else if(payload.p_command==='shortcut'){
    shortcuts.splice(0,shortcuts.length,...(data.enabled?[data.office_workspace_id]:[]));body={};
   }else if(['submit_task','progress_task'].includes(payload.p_command)){
    const task=tasks.find(t=>t.id===data.task_id)!;
    Object.assign(task,{status:payload.p_command==='submit_task'?(task.reviewer_id?'submitted':'done'):'in_progress',progress:payload.p_command==='submit_task'?100:data.progress,revision:Number(task.revision)+1});body=task;
   }else if(['complete_project','archive_project'].includes(payload.p_command)){
    const project=projects.find(p=>p.id===payload.p_project)!;project.status=payload.p_command==='complete_project'?'completed':'archived';body=project;
   }else body={};
  }
  await route.fulfill({json:body});
 });
 await page.reload();await expect(page.getByRole('heading',{name:'Access denied',exact:true})).toHaveCount(0);
 return {...office,privateWorkspace,personalId,projectId,workspaces,personalProjects:projects,personalTasks:tasks,members,calls,setFailProject:(value:boolean)=>{failProject=value;},revoke:()=>{denied=true;}};
}
