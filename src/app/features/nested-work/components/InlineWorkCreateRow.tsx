import {Plus} from 'lucide-react';
import type {WorkspaceAction} from '../../../components/ui/workspace/ActionMenu';
export function InlineWorkCreateRow({action}:{action:WorkspaceAction}){
 return <tr className="nw-inline-create-row"><td colSpan={7}><button type="button" className="nw-inline-create" aria-label={action.label} disabled={action.disabled} title={action.disabledReason} onClick={()=>action.onSelect()}><Plus size={15} aria-hidden="true"/><span> Add subitem</span></button></td></tr>;
}
