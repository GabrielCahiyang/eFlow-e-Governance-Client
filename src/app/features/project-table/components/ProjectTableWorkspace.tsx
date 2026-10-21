import { ProjectTaskBudgetProvider } from '../../budget';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useEffect,useMemo,useState,useRef } from 'react';

import { Plus,Table2,LockKeyhole } from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';

import { CreateWorkDialog } from './CreateWorkDialog';

import { SubtaskWorkDrawer,fetchSubtasksForTasks,type Subtask } from '../../subtasks';

import { isHeadWorkspaceRole } from '../../../shared/roles';

import type { UserProfile,Organization } from '../../../types';

import type { ProjectCommandData } from '../../projects';

import { useProjectGroups } from '../hooks/useProjectGroups';


import { PROJECT_COLUMNS } from '../types';
import { useTableLayout } from '../hooks/useTableLayout';

import { visibleProjectTasks,tasksInGroup,type TableSort } from '../selectors';

import { TableToolbar } from './TableToolbar';

import { ProjectGroupTable } from './ProjectGroupTable';

import { ProjectImportDialog,ProjectImportHistory } from '../../project-import';

import { ImportTasksDialog } from './ImportTasksDialog';

import '../projectTable.css';
import '../tableLayout.css';
import { matchesProjectDateRange, type ProjectViewFilterState } from '../../project-views';
import { useProjectOfficeContext, canStaffProjectOffice } from '../../project-offices';
import type { TaskInspectorOrigin } from '../../task-inspector';
export function ProjectTableWorkspace({data,profiles,orgs,canManage,onOpenTask,onOpenLegacyBoard,sharedFilters,onFiltersChange,importRevision=0,importGroupId=''}:{data:ProjectCommandData;profiles:UserProfile[];orgs:Organization[];canManage:boolean;onOpenTask:(id:string,section?:TaskInspectorOrigin['section'])=>void;onOpenLegacyBoard:()=>void;sharedFilters?:ProjectViewFilterState;onFiltersChange?:(value:ProjectViewFilterState)=>void;importRevision?:number;importGroupId?:string}){
 const {user,userProfile}=useAuth();const userId=user?.id||userProfile?.id||'',officeId=userProfile?.org_id||userProfile?.departmentId||'';
 const officeState=useProjectOfficeContext();
 const ownOffice=officeState.offices.find(o=>o.office_id===officeId);
 const canStaff=canStaffProjectOffice(ownOffice,userProfile,orgs)&&!['completed','archived'].includes(data.project.status);

 const editable=canManage&&isHeadWorkspaceRole(userProfile?.role)&&data.project.orgId===officeId&&!['completed','archived'].includes(data.project.status);

 const {groups,loading,error,refresh}=useProjectGroups(data.project.id);

 const [localQuery,setLocalQuery]=useState(''),[localStatus,setLocalStatus]=useState(''),[localOwner,setLocalOwner]=useState(''),[localSort,setLocalSort]=useState<TableSort>('manual'),[notice,setNotice]=useState('');
 const query=sharedFilters?.query??localQuery,status=sharedFilters?.status??localStatus,owner=sharedFilters?.owner??localOwner,sort=sharedFilters?.sort??localSort;
 const setQuery=(query:string)=>sharedFilters&&onFiltersChange?onFiltersChange({...sharedFilters,query}):setLocalQuery(query);
 const setStatus=(status:string)=>sharedFilters&&onFiltersChange?onFiltersChange({...sharedFilters,status}):setLocalStatus(status);
 const setOwner=(owner:string)=>sharedFilters&&onFiltersChange?onFiltersChange({...sharedFilters,owner}):setLocalOwner(owner);
 const setSort=(sort:TableSort)=>sharedFilters&&onFiltersChange?onFiltersChange({...sharedFilters,sort}):setLocalSort(sort);
 const [groupOpen,setGroupOpen]=useState(false),[importOpen,setImportOpen]=useState(false),[taskOpen,setTaskOpen]=useState(false),[refreshFailed,setRefreshFailed]=useState(false);

 const [aiOpen,setAiOpen]=useState(false),[importSeed,setImportSeed]=useState({text:'',version:0});
 const [historyRevision,setImportRevision]=useState(0);

 const [subtasks,setSubtasks]=useState(data.facts.subtasks),[openSubitem,setOpenSubitem]=useState<Subtask|null>(null);
 const [openSubitemReadOnly,setOpenSubitemReadOnly]=useState(false);

 const [subitemOrigin,setSubitemOrigin]=useState<TaskInspectorOrigin>();
 const open=(item:Subtask,readOnly=false)=>{setSubitemOrigin({view:"Main Table",returnFocus:document.activeElement instanceof HTMLElement?document.activeElement:null,restoreFocus:()=>document.querySelector<HTMLElement>('[aria-label="Project main table"] button')?.focus()});setOpenSubitemReadOnly(readOnly);setOpenSubitem(item);};
 const layout=useTableLayout(data.project.id);const hidden=layout.hidden;

 useEffect(()=>setSubtasks(data.facts.subtasks),[data.facts.subtasks]);

 const refreshSubitems=async()=>setSubtasks(await fetchSubtasksForTasks(data.tasks.map(t=>t.id)));

 useEffect(()=>{if(importRevision){layout.showColumn('budget');void refresh().catch(()=>setNotice('Work imported. Refresh to load the new groups.'));setImportRevision(v=>v+1);}},[importRevision]);

 const focusedImport=useRef('');
 useEffect(()=>{
  if(!importGroupId||focusedImport.current===importGroupId||!groups.some(group=>group.id===importGroupId))return;
  const frame=requestAnimationFrame(()=>{const target=document.querySelector<HTMLElement>('[data-project-group-id="'+importGroupId+'"]');if(target){focusedImport.current=importGroupId;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'smooth'});}});
  return ()=>cancelAnimationFrame(frame);
 },[importGroupId,groups]);

 const columns=PROJECT_COLUMNS.filter(c=>!hidden.includes(c.id)).map(c=>c.id);

 const tasks=useMemo(()=>visibleProjectTasks(data.tasks,query,status,owner,sort).filter(t=>!sharedFilters?.office||t.orgId===sharedFilters.office).filter(t=>matchesProjectDateRange(t,sharedFilters||{})),[data.tasks,query,status,owner,sort,sharedFilters?.office,sharedFilters?.dateFrom,sharedFilters?.dateTo]);
 const people=profiles.filter(p=>data.tasks.some(t=>t.assigneeId===p.id)||p.org_id===data.project.orgId);

 const run=async(fn:()=>Promise<void>)=>{setNotice('');try{await fn();}catch(e){setNotice(e instanceof Error?e.message:'Could not save this change.');}};

 const addTask=()=>{ if(groups.length)setTaskOpen(true); else setGroupOpen(true); };
 const refreshCreatedGroup=async()=>{try{await refresh();setRefreshFailed(false);}catch(e){setRefreshFailed(true);setNotice('Group added, but could not refresh: '+(e instanceof Error?e.message:'Please reload.'));}};

 const parentTask=openSubitem?data.tasks.find(t=>t.id===openSubitem.taskId):undefined;
 const subitemReadOnly=openSubitemReadOnly||userProfile?.role==='admin'||['completed','archived'].includes(data.project.status)||!!parentTask?.archivedAt||!!parentTask?.proposedOfficeIdentityId||['for_review','completed','cancelled'].includes(parentTask?.status||'');

 return <ProjectTaskBudgetProvider officeId={data.project.orgId} officeIds={data.tasks.map(task=>task.orgId).filter((id):id is string=>!!id)}><section className="pt-workspace" aria-label="Project main table" data-tour-id="project-main-table">

  <div hidden={!!openSubitem}><TableToolbar sharedFilters={!!sharedFilters} query={query} setQuery={setQuery} status={status} setStatus={setStatus} owner={owner} setOwner={setOwner} sort={sort} setSort={setSort} people={people} hidden={hidden} toggleColumn={layout.toggleColumn} onResetWidths={layout.resetWidths} onResetCompact={layout.resetCompact} canManage={editable} onAddTask={addTask} onAddGroup={()=>setGroupOpen(true)} onImport={()=>{setImportSeed(prev=>({text:'',version:prev.version+1}));setImportOpen(true);}} onAi={()=>setAiOpen(true)} onOpenBoard={onOpenLegacyBoard}/>

  <div className="pt-context-line"><span><Table2 size={14}/>{tasks.length} visible tasks</span>{editable?<span>Changes save where you work.</span>:<span><LockKeyhole size={13}/>Project structure is read-only for this account or project.</span>}</div>
  <ProjectImportHistory projectId={data.project.id} revision={historyRevision}/>

  {notice&&<div role="alert" className="pt-error">{notice}{refreshFailed&&<button type="button" onClick={()=>{void refreshCreatedGroup();}}>Retry refresh</button>}<button onClick={()=>setNotice('')} aria-label="Dismiss error">×</button></div>}

  {loading?<div className="pt-skeleton" role="status" aria-label="Loading project table">{[0,1].map(i=><div key={i}><span/>{[0,1,2,3].map(j=><i key={j}/>)}</div>)}</div>:error?<div role="alert" className="pt-error">{error}<button onClick={()=>{void run(refresh);}}>Retry</button></div>:<>

   {(query||status||owner||sharedFilters?.office||sharedFilters?.dateFrom||sharedFilters?.dateTo)&&!tasks.length&&<EmptyState fill illustration="search" size="compact" title="No tasks match these filters. Clear filters to see all project work."/>}
   {!groups.length && <EmptyState illustration="tasks" size="compact" title="No task groups yet" description={editable ? 'Create a group to start adding tasks.' : 'The project Head can create groups and add tasks.'}/>}

   {groups.map(group=><ProjectGroupTable key={group.id} group={group} groups={groups} tasks={tasksInGroup(tasks,group)} allTasks={data.tasks} subtasks={subtasks} columns={columns} profiles={profiles} orgs={orgs} canManage={editable} canStaff={canStaff} locked={['completed','archived'].includes(data.project.status)} officeId={officeId} userId={userId} projectId={data.project.id} onOpen={onOpenTask} onOpenSubitem={open} refreshSubitems={refreshSubitems} refreshGroups={refresh} onHideColumn={layout.hideColumn} onAddColumn={layout.showColumn} widths={layout.widths} onResize={layout.resizeColumn} sort={sort} onSort={setSort} reorderable={editable&&!query&&!status&&!owner&&!sharedFilters?.office&&!sharedFilters?.dateFrom&&!sharedFilters?.dateTo&&sort==='manual'&&tasksInGroup(data.tasks,group).every(t=>t.orgId===officeId)} run={run}/>)}

   {editable&&<button className="pt-add-group" onClick={()=>setGroupOpen(true)}><Plus size={17}/>Add new group</button>}

  </>}

  {groupOpen&&<CreateWorkDialog key={'new-group-'+data.project.id} kind="group" projectId={data.project.id} groups={groups} onClose={()=>setGroupOpen(false)} onCreated={()=>{void refreshCreatedGroup();}}/>}

  <ImportTasksDialog key={importSeed.version} initialText={importSeed.text} open={importOpen} onClose={()=>setImportOpen(false)} projectId={data.project.id} groups={groups}/>

  <ProjectImportDialog key={data.project.id} open={aiOpen} onClose={()=>setAiOpen(false)} projectId={data.project.id} projectTitle={data.project.title} currentDetails={{title:data.project.title,description:data.project.description,startDate:data.project.startDate || '',targetDate:data.project.targetDate || ''}} groups={groups} orgs={orgs} onImported={()=>{setImportRevision(v=>v+1);void run(async()=>{await refresh();await refreshSubitems();});}}/>

  {taskOpen&&<CreateWorkDialog key={'new-task-'+data.project.id} kind="task" projectId={data.project.id} groups={groups} onClose={()=>setTaskOpen(false)}/>}

  </div>{openSubitem&&(parentTask?<SubtaskWorkDrawer key={openSubitem.id} subtask={openSubitem} parentTask={parentTask} origin={subitemOrigin} readOnly={subitemReadOnly} canManageDeadline={!subitemReadOnly&&(parentTask.assigneeId===userId||editable)} onClose={()=>{setOpenSubitem(null);void run(refreshSubitems);}}/>:<p role="alert">Current parent task access is unavailable. <button type="button" onClick={()=>setOpenSubitem(null)}>Close subitem</button></p>)}

 </section></ProjectTaskBudgetProvider>;

}

