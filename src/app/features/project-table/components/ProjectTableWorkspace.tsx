import { useEffect,useMemo,useState } from 'react';

import { Plus,Table2,LockKeyhole } from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';

import { Dialog,DialogContent,DialogTitle,DialogDescription } from '../../../components/ui/dialog';

import { SubtaskWorkDrawer,fetchSubtasksForTasks,type Subtask } from '../../subtasks';

import { isHeadWorkspaceRole } from '../../../shared/roles';

import type { UserProfile,Organization } from '../../../types';

import type { ProjectCommandData } from '../../projects';

import { useProjectGroups } from '../hooks/useProjectGroups';

import { createProjectGroup,createWorkspaceTask } from '../services/workspaceService';

import { PROJECT_COLUMNS,type ProjectColumn } from '../types';

import { visibleProjectTasks,tasksInGroup,type TableSort } from '../selectors';

import { TableToolbar } from './TableToolbar';

import { ProjectGroupTable } from './ProjectGroupTable';

import { ProjectImportDialog,ProjectImportHistory } from '../../project-import';

import { ImportTasksDialog } from './ImportTasksDialog';

import '../projectTable.css';
import type { ProjectViewFilterState } from '../../project-views';
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
 const [groupOpen,setGroupOpen]=useState(false),[groupTitle,setGroupTitle]=useState(''),[busy,setBusy]=useState(false),[importOpen,setImportOpen]=useState(false),[taskOpen,setTaskOpen]=useState(false),[taskTitle,setTaskTitle]=useState(''),[taskGroup,setTaskGroup]=useState('');

 const [aiOpen,setAiOpen]=useState(false),[importSeed,setImportSeed]=useState({text:'',version:0});
 const [importRevision,setImportRevision]=useState(0);

 const [subtasks,setSubtasks]=useState(data.facts.subtasks),[openSubitem,setOpenSubitem]=useState<Subtask|null>(null);

 const storageKey='eflow_project_columns_'+data.project.id;

 const [hidden,setHidden]=useState<ProjectColumn[]>(()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(saved)?saved.filter(x=>PROJECT_COLUMNS.some(c=>c.id===x)):[];}catch{return [];}});

 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(hidden));}catch{}},[hidden,storageKey]);

 useEffect(()=>setSubtasks(data.facts.subtasks),[data.facts.subtasks]);

 const refreshSubitems=async()=>setSubtasks(await fetchSubtasksForTasks(data.tasks.map(t=>t.id)));

 const columns=PROJECT_COLUMNS.filter(c=>!hidden.includes(c.id)).map(c=>c.id);

 const tasks=useMemo(()=>visibleProjectTasks(data.tasks,query,status,owner,sort).filter(t=>!sharedFilters?.office||t.orgId===sharedFilters.office),[data.tasks,query,status,owner,sort,sharedFilters?.office]);
 const people=profiles.filter(p=>data.tasks.some(t=>t.assigneeId===p.id)||p.org_id===data.project.orgId);

 const run=async(fn:()=>Promise<void>)=>{setNotice('');try{await fn();}catch(e){setNotice(e instanceof Error?e.message:'Could not save this change.');}};

 const addTask=()=>{setTaskGroup(groups[0]?.id||'');setTaskOpen(true);};

 const parentTask=openSubitem?data.tasks.find(t=>t.id===openSubitem.taskId):undefined;

 return <section className="pt-workspace" aria-label="Project main table" data-tour-id="project-main-table">

  <TableToolbar sharedFilters={!!sharedFilters} query={query} setQuery={setQuery} status={status} setStatus={setStatus} owner={owner} setOwner={setOwner} sort={sort} setSort={setSort} people={people} hidden={hidden} toggleColumn={c=>setHidden(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c])} canManage={editable} onAddTask={addTask} onAddGroup={()=>setGroupOpen(true)} onImport={()=>{setImportSeed(prev=>({text:'',version:prev.version+1}));setImportOpen(true);}} onAi={()=>setAiOpen(true)}/>

  <div className="pt-context-line"><span><Table2 size={14}/>{tasks.length} visible tasks</span><span>Changes save where you work.</span>{!editable&&<span><LockKeyhole size={13}/>Project structure is read-only for this account or project.</span>}<button onClick={onOpenLegacyBoard}>Open task board</button></div>
  <ProjectImportHistory projectId={data.project.id} revision={importRevision}/>

  {notice&&<div role="alert" className="pt-error">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss error">×</button></div>}

  {loading?<div className="pt-skeleton" role="status" aria-label="Loading project table">{[0,1].map(i=><div key={i}><span/>{[0,1,2,3].map(j=><i key={j}/>)}</div>)}</div>:error?<div role="alert" className="pt-error">{error}<button onClick={()=>{void run(refresh);}}>Retry</button></div>:<>

   {(query||status||owner)&&!tasks.length&&<p className="pt-empty-filter">No tasks match these filters. Clear filters to see all project work.</p>}

   {groups.map(group=><ProjectGroupTable key={group.id} group={group} groups={groups} tasks={tasksInGroup(tasks,group)} allTasks={data.tasks} subtasks={subtasks} columns={columns} profiles={profiles} orgs={orgs} canManage={editable} canStaff={canStaff} officeId={officeId} userId={userId} projectId={data.project.id} onOpen={onOpenTask} onOpenSubitem={setOpenSubitem} refreshSubitems={refreshSubitems} refreshGroups={refresh} onHideColumn={c=>setHidden(prev=>[...prev,c])} onSort={setSort} reorderable={editable&&!query&&!status&&!owner&&!sharedFilters?.office&&sort==='manual'&&tasksInGroup(data.tasks,group).every(t=>t.orgId===officeId)} run={run}/>)}

   {editable&&<button className="pt-add-group" onClick={()=>setGroupOpen(true)}><Plus size={17}/>Add new group</button>}

  </>}

  <Dialog open={groupOpen} onOpenChange={setGroupOpen}><DialogContent className="pt-small-dialog"><DialogTitle>New group</DialogTitle><DialogDescription>Organize related tasks without changing their workflow.</DialogDescription><form className="pt-popover-form" onSubmit={e=>{e.preventDefault();if(!groupTitle.trim()||busy)return;setBusy(true);void run(async()=>{await createProjectGroup(data.project.id,groupTitle,Math.max(-1,...groups.map(g=>g.position))+1);await refresh();setGroupTitle('');setGroupOpen(false);}).finally(()=>setBusy(false));}}><label>Group name<input autoFocus value={groupTitle} onChange={e=>setGroupTitle(e.target.value)} maxLength={120}/></label><button className="pt-primary" disabled={!groupTitle.trim()||busy}>{busy?'Adding…':'Add group'}</button>{notice&&<p role="alert">{notice}</p>}</form></DialogContent></Dialog>

  <ImportTasksDialog key={importSeed.version} initialText={importSeed.text} open={importOpen} onClose={()=>setImportOpen(false)} projectId={data.project.id} groups={groups}/>

  <ProjectImportDialog key={data.project.id} open={aiOpen} onClose={()=>setAiOpen(false)} projectId={data.project.id} projectTitle={data.project.title} groups={groups} orgs={orgs} onImported={()=>{setImportRevision(v=>v+1);void run(async()=>{await refresh();await refreshSubitems();});}}/>

  <Dialog open={taskOpen} onOpenChange={v=>{if(!busy)setTaskOpen(v);}}><DialogContent className="pt-small-dialog"><DialogTitle>New task</DialogTitle><DialogDescription>Add a task to your project. Assign its owner and details in the table.</DialogDescription><form className="pt-popover-form" onSubmit={e=>{e.preventDefault();if(!taskTitle.trim()||!taskGroup||busy)return;setBusy(true);void run(async()=>{await createWorkspaceTask(data.project.id,taskGroup,taskTitle);setTaskTitle('');setTaskOpen(false);}).finally(()=>setBusy(false));}}><label>Task name<input autoFocus value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} maxLength={300} disabled={busy}/></label><label>Group<select value={taskGroup} onChange={e=>setTaskGroup(e.target.value)} disabled={busy}>{groups.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>{notice&&<p role="alert">{notice}</p>}<button className="pt-primary" disabled={!taskTitle.trim()||!taskGroup||busy}>{busy?'Adding…':'Add task'}</button></form></DialogContent></Dialog>

  {openSubitem&&<SubtaskWorkDrawer key={openSubitem.id} subtask={openSubitem} parentTask={parentTask} readOnly={userProfile?.role==='admin'} canManageDeadline={!!parentTask&&(parentTask.assigneeId===userId||editable)} onClose={()=>{setOpenSubitem(null);void run(refreshSubitems);}}/>}

 </section>;

}

