import { useEffect,useMemo,useState } from 'react';

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
export function ProjectTableWorkspace({data,profiles,orgs,canManage,onOpenTask,onOpenLegacyBoard,sharedFilters,onFiltersChange}:{data:ProjectCommandData;profiles:UserProfile[];orgs:Organization[];canManage:boolean;onOpenTask:(id:string)=>void;onOpenLegacyBoard:()=>void;sharedFilters?:ProjectViewFilterState;onFiltersChange?:(value:ProjectViewFilterState)=>void}){
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
 const [importRevision,setImportRevision]=useState(0);

 const [subtasks,setSubtasks]=useState(data.facts.subtasks),[openSubitem,setOpenSubitem]=useState<Subtask|null>(null);

 const layout=useTableLayout(data.project.id);const hidden=layout.hidden;

 useEffect(()=>setSubtasks(data.facts.subtasks),[data.facts.subtasks]);

 const refreshSubitems=async()=>setSubtasks(await fetchSubtasksForTasks(data.tasks.map(t=>t.id)));

 const columns=PROJECT_COLUMNS.filter(c=>!hidden.includes(c.id)).map(c=>c.id);

 const tasks=useMemo(()=>visibleProjectTasks(data.tasks,query,status,owner,sort).filter(t=>!sharedFilters?.office||t.orgId===sharedFilters.office).filter(t=>matchesProjectDateRange(t,sharedFilters||{})),[data.tasks,query,status,owner,sort,sharedFilters?.office,sharedFilters?.dateFrom,sharedFilters?.dateTo]);
 const people=profiles.filter(p=>data.tasks.some(t=>t.assigneeId===p.id)||p.org_id===data.project.orgId);

 const run=async(fn:()=>Promise<void>)=>{setNotice('');try{await fn();}catch(e){setNotice(e instanceof Error?e.message:'Could not save this change.');}};

 const addTask=()=>setTaskOpen(true);
 const refreshCreatedGroup=async()=>{try{await refresh();setRefreshFailed(false);}catch(e){setRefreshFailed(true);setNotice('Group added, but could not refresh: '+(e instanceof Error?e.message:'Please reload.'));}};

 const parentTask=openSubitem?data.tasks.find(t=>t.id===openSubitem.taskId):undefined;

 return <section className="pt-workspace" aria-label="Project main table" data-tour-id="project-main-table">

  <TableToolbar sharedFilters={!!sharedFilters} query={query} setQuery={setQuery} status={status} setStatus={setStatus} owner={owner} setOwner={setOwner} sort={sort} setSort={setSort} people={people} hidden={hidden} toggleColumn={layout.toggleColumn} onResetWidths={layout.resetWidths} canManage={editable} onAddTask={addTask} onAddGroup={()=>setGroupOpen(true)} onImport={()=>{setImportSeed(prev=>({text:'',version:prev.version+1}));setImportOpen(true);}} onAi={()=>setAiOpen(true)} onOpenBoard={onOpenLegacyBoard}/>

  <div className="pt-context-line"><span><Table2 size={14}/>{tasks.length} visible tasks</span><span>Changes save where you work.</span>{!editable&&<span><LockKeyhole size={13}/>Project structure is read-only for this account or project.</span>}</div>
  <ProjectImportHistory projectId={data.project.id} revision={importRevision}/>

  {notice&&<div role="alert" className="pt-error">{notice}{refreshFailed&&<button type="button" onClick={()=>{void refreshCreatedGroup();}}>Retry refresh</button>}<button onClick={()=>setNotice('')} aria-label="Dismiss error">×</button></div>}

  {loading?<div className="pt-skeleton" role="status" aria-label="Loading project table">{[0,1].map(i=><div key={i}><span/>{[0,1,2,3].map(j=><i key={j}/>)}</div>)}</div>:error?<div role="alert" className="pt-error">{error}<button onClick={()=>{void run(refresh);}}>Retry</button></div>:<>

   {(query||status||owner||sharedFilters?.office)&&!tasks.length&&<p className="pt-empty-filter">No tasks match these filters. Clear filters to see all project work.</p>}

   {groups.map(group=><ProjectGroupTable key={group.id} group={group} groups={groups} tasks={tasksInGroup(tasks,group)} allTasks={data.tasks} subtasks={subtasks} columns={columns} profiles={profiles} orgs={orgs} canManage={editable} canStaff={canStaff} locked={['completed','archived'].includes(data.project.status)} officeId={officeId} userId={userId} projectId={data.project.id} onOpen={onOpenTask} onOpenSubitem={setOpenSubitem} refreshSubitems={refreshSubitems} refreshGroups={refresh} onHideColumn={layout.hideColumn} widths={layout.widths} onResize={layout.resizeColumn} sort={sort} onSort={setSort} reorderable={editable&&!query&&!status&&!owner&&!sharedFilters?.office&&!sharedFilters?.dateFrom&&!sharedFilters?.dateTo&&sort==='manual'&&tasksInGroup(data.tasks,group).every(t=>t.orgId===officeId)} run={run}/>)}

   {editable&&<button className="pt-add-group" onClick={()=>setGroupOpen(true)}><Plus size={17}/>Add new group</button>}

  </>}

  {groupOpen&&<CreateWorkDialog key={'new-group-'+data.project.id} kind="group" projectId={data.project.id} groups={groups} onClose={()=>setGroupOpen(false)} onCreated={()=>{void refreshCreatedGroup();}}/>}

  <ImportTasksDialog key={importSeed.version} initialText={importSeed.text} open={importOpen} onClose={()=>setImportOpen(false)} projectId={data.project.id} groups={groups}/>

  <ProjectImportDialog key={data.project.id} open={aiOpen} onClose={()=>setAiOpen(false)} projectId={data.project.id} projectTitle={data.project.title} groups={groups} orgs={orgs} onImported={()=>{setImportRevision(v=>v+1);void run(async()=>{await refresh();await refreshSubitems();});}}/>

  {taskOpen&&<CreateWorkDialog key={'new-task-'+data.project.id} kind="task" projectId={data.project.id} groups={groups} onClose={()=>setTaskOpen(false)}/>}

  {openSubitem&&<SubtaskWorkDrawer key={openSubitem.id} subtask={openSubitem} parentTask={parentTask} readOnly={userProfile?.role==='admin'} canManageDeadline={!!parentTask&&(parentTask.assigneeId===userId||editable)} onClose={()=>{setOpenSubitem(null);void run(refreshSubitems);}}/>}

 </section>;

}

