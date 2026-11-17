import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import {ChevronsLeft,ChevronsRight} from 'lucide-react';
import type {ReactNode} from 'react';
export function ContextRailHeader({title,collapsed,mobile,onCollapse,utilities}:{title:string;collapsed:boolean;mobile:boolean;onCollapse:()=>void;utilities?:ReactNode}){
 return <div className="eflow-context-heading">{!collapsed&&<h2 className="eflow-context-heading__title">{title}</h2>}<div>{!collapsed&&utilities}{!mobile&&<WorkspaceTooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}><button type="button" aria-label={`${collapsed?'Restore':'Collapse'} ${title.toLowerCase()} sidebar`} onClick={onCollapse}>{collapsed?<ChevronsRight size={18}/>:<ChevronsLeft size={18}/>}</button></WorkspaceTooltip>}</div></div>;
}
