import {expect,type Page} from '@playwright/test';
import {nestedWorkImpactFixture} from '../../fixtures/nestedWorkImpact';
import type {WorkTreeSnapshot,WorkRequest,WorkCapabilityEntry} from '../../../src/app/features/nested-work';
import type {projectWorkspaceFixture} from './projectWorkspace';

type Records=Awaited<ReturnType<typeof projectWorkspaceFixture>>;
/** Synthetic current installed root staffing; never a hosted authority proof. */
export async function nestedWorkStaffingFixture(page:Page,records:Records) {
 let revision=1;
 const commands:Record<string,any>[]=[],previews:Record<string,any>[]=[],receipts=new Map<string,string>();
 const root=records.tasks[0],rootId=String(root.id);
 // Explicit selected roster, not the entire Office directory.
 const selected=new Set([records.id,...records.officeMembers.map(person=>String(person.user_id))]);
 const people=()=>records.profiles.filter(person=>selected.has(String(person.id))).map(person=>({id:String(person.id),name:String(person.full_name),eligible:person.is_active!==false}));
 const snapshot=():WorkTreeSnapshot=>{
  const open=!['completed','cancelled','for_review'].includes(String(root.status))&&!['completed','archived','cancelled'].includes(String(records.projects[0].status));
  const lead=root.assigned_to?String(root.assigned_to):null;
  const head=records.profile.role==='head'&&records.organizations.find(office=>office.id===records.org)?.head_user_id===records.id;
  const cap=(allowed:boolean):WorkCapabilityEntry=>allowed?{allowed:true,reason_code:null}:{allowed:false,reason_code:'branch_denied'};
  const nodes=records.subtasks.filter(node=>node.task_id===rootId).map((node,index)=>({
   id:String(node.id),task_id:rootId,parent_subtask_id:node.parent_subtask_id?String(node.parent_subtask_id):null,
   lead_id:node.lead_id?String(node.lead_id):null,title:String(node.title),assigned_to_ids:Array.isArray(node.assigned_to_ids)?node.assigned_to_ids as string[]:[],
   sibling_order:typeof node.sibling_order==='number'?node.sibling_order:index,depth:1,
   status:String(node.status||'todo') as WorkTreeSnapshot['nodes'][number]['status'],percent_complete:Number(node.percent_complete||0),due_date:node.due_date?String(node.due_date):null,is_standalone:true,
   can_manage:head&&open,can_appoint:head&&open,can_order:head&&open,can_work:false,can_review:false,
   capabilities:{manage_contributors:cap(head&&open),appoint_lead:cap(head&&open&&node.lead_id!==records.id),create_child:cap(head&&open),edit_details:cap(head&&open),move:cap(head&&open),order_children:cap(head&&open),delete:cap(head&&open),execute:cap(false),submit:cap(false),review:cap(false)},
  }));
  return {root:{id:rootId,project:records.project,office:records.org,kind:'office',open,lead,people:Array.isArray(root.team_member_ids)?root.team_member_ids as string[]:[],due:root.due_date?String(root.due_date).slice(0,10):null,
   capabilities:{manage_contributors:cap(head&&open&&!!lead),appoint_lead:cap(head&&open&&lead!==records.id),create_child:cap(head&&open),order_children:cap(head&&open)}},
   people:people(),nodes,revision,can_manage:head&&open,can_transfer:head&&open&&lead!==records.id,leaf_total:nodes.length,leaf_completed:0};
 };
 await page.route(/\/rest\/v1\/rpc\/(r7_|nw_work_)/,async route=>{
  const op=new URL(route.request().url()).pathname.split('/').at(-1),payload=route.request().postDataJSON()||{};
  const denied=(message:string)=>route.fulfill({status:403,json:{code:'42501',message}});
  if(op==='r7_work_tree')return payload.p_root===rootId?route.fulfill({json:snapshot()}):denied('Root access denied');
  if(op==='r7_project_members')return payload.p_project===records.project?route.fulfill({json:{kind:'office',members:people().map(person=>({user_id:person.id,name:person.name,eligible:person.eligible,can_read:true,office:records.org,engagement:'Permanent',access_end:null,access_ended_at:null}))}}):denied('Selected project required');
  if(op==='r7_work_activity')return route.fulfill({json:{events:[],more:false}});
  if(op==='nw_work_impact'){
   if(payload.p_root!==rootId)return denied('Root access denied');
   previews.push(payload);
   const terms={revision:payload.p_revision,command:payload.p_command,payload:payload.p_payload} as Pick<WorkRequest,'revision'|'command'|'payload'>;
   return route.fulfill({json:nestedWorkImpactFixture(snapshot(),terms,{fingerprint:`staffing-${revision}`})});
  }
  if(op==='nw_work_command'||op==='r7_work_command'){
   const current=snapshot(),body=payload.p_payload;
   if(payload.p_root!==rootId||payload.p_command!=='root_lead'||!current.root.capabilities?.appoint_lead.allowed)return denied('Current root appointment authority required');
   if(op!=='nw_work_command')return denied('Checked appointment required');
   if(Object.keys(body).some(key=>!['lead','people'].includes(key))||!people().some(person=>person.id===body.lead&&person.eligible))return denied('Selected project Lead required');
   const terms=JSON.stringify([payload.p_root,payload.p_command,body]);
   if(receipts.has(payload.p_request))return receipts.get(payload.p_request)===terms?route.fulfill({json:current}):denied('Request terms changed');
   if(payload.p_revision!==revision||payload.p_impact_fingerprint!==`staffing-${revision}`)return route.fulfill({status:409,json:{code:'40001',message:'Work impact changed'}});
   expect(body.people).toContain(body.lead);
   expect(body.people.every((id:string)=>people().some(person=>person.id===id&&person.eligible))).toBe(true);
   commands.push(payload);receipts.set(payload.p_request,terms);
   Object.assign(root,{assigned_to:body.lead,assignee_name:people().find(person=>person.id===body.lead)!.name,team_member_ids:body.people,team_member_names:body.people.map((id:string)=>people().find(person=>person.id===id)!.name)});
   for(const node of records.subtasks.filter(node=>node.task_id===rootId))node.lead_id=null;
   revision++;
   return route.fulfill({json:snapshot()});
  }
  return route.fulfill({json:[]});
 });
 return {commands,previews,snapshot};
}
