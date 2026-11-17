import { Building2 } from 'lucide-react';
import type { Workspace } from '../types';
import '../workspaces.css';

export function WorkspaceSelector({ name }: {
 name:string;currentId?:string;workspaces:Workspace[];recent:string[];userId:string;ownerName:string;
 loading:boolean;error?:string;available:boolean;onSelect:(id:string)=>Promise<boolean>;onRefresh:()=>Promise<void>;
 onCreated?:()=>void;
}) {
 return (
  <div className="eflow-workspace-static" aria-label={`${name} Workspace`}>
   <Building2 size={17} aria-hidden="true"/>
   <strong>{name} Workspace</strong>
  </div>
 );
}
