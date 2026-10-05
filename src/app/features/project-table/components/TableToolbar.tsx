import { Search,Columns3,Plus,Filter } from 'lucide-react';
import { SplitActionButton,WorkspacePopover } from '../../../components/ui/workspace';
import { TASK_STATUS_LABELS } from '../../tasks';
import type { UserProfile } from '../../../types';
import { PROJECT_COLUMNS,type ProjectColumn } from '../types';
import type { TableSort } from '../selectors';
export function TableToolbar({sharedFilters=false,query,setQuery,status,setStatus,owner,setOwner,sort,setSort,people,hidden,toggleColumn,canManage,onAddTask,onAddGroup,onImport,onAi}:{sharedFilters?:boolean;query:string;setQuery:(s:string)=>void;status:string;setStatus:(s:string)=>void;owner:string;setOwner:(s:string)=>void;sort:TableSort;setSort:(s:TableSort)=>void;people:UserProfile[];hidden:ProjectColumn[];toggleColumn:(c:ProjectColumn)=>void;canManage:boolean;onAddTask:()=>void;onAddGroup:()=>void;onImport:()=>void;onAi:()=>void}){
 return <div className="pt-toolbar" data-tour-id="project-table-toolbar">
  {canManage&&<SplitActionButton label="New task" onClick={onAddTask} actions={[{id:'task',label:'Add task',onSelect:onAddTask},{id:'group',label:'New group',onSelect:onAddGroup},{id:'ai',label:'Decompose project with AI',onSelect:onAi},{id:'document',label:'Import project document',onSelect:onAi},{id:'import',label:'Import tasks',onSelect:onImport}]}/>}
  {!sharedFilters&&<><label className="pt-search"><Search size={15}/><input aria-label="Search project tasks" placeholder="Search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <label><Filter size={14}/><select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(TASK_STATUS_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
  <select aria-label="Filter owner" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">All people</option>{people.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
  <select aria-label="Sort tasks" value={sort} onChange={e=>setSort(e.target.value as TableSort)}><option value="manual">Manual order</option><option value="title">Task name</option><option value="deadline">Due date</option><option value="priority">Priority</option></select>
  </>}
  <WorkspacePopover trigger={<button type="button" className="pt-toolbar-button"><Columns3 size={15}/>Columns</button>}><div className="pt-popover-form"><strong>Visible columns</strong>{PROJECT_COLUMNS.map(c=><label key={c.id}><input type="checkbox" checked={!hidden.includes(c.id)} onChange={()=>toggleColumn(c.id)}/>{c.label}</label>)}</div></WorkspacePopover>
  {!sharedFilters&&(query||status||owner)&&<button className="pt-toolbar-button" onClick={()=>{setQuery('');setStatus('');setOwner('');}}>Clear filters</button>}
  {canManage&&<button className="pt-toolbar-button pt-group-add" onClick={onAddGroup}><Plus size={15}/>New group</button>}
 </div>;
}
