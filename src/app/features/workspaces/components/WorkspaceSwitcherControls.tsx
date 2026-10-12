import type {ReactNode} from 'react';
import {Plus} from 'lucide-react';
import {WorkspaceTooltip} from '../../../components/ui/workspace';
export function WorkspaceSwitcherControls({children,disabled,onCreate}:{children:ReactNode;disabled:boolean;onCreate:()=>void}){
 return <div className="eflow-workspace-switcher-controls">{children}<WorkspaceTooltip content="Create workspace"><button type="button" className="eflow-workspace-create" aria-label="Create workspace" disabled={disabled} onClick={onCreate}><Plus size={18}/></button></WorkspaceTooltip></div>;
}
