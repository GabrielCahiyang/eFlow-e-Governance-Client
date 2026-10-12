import {staffingNodePath} from '../selectors/staffing';
import type {WorkNode,WorkTreeSnapshot} from '../types';

/** Choices are already filtered by current capability and reparentChoices. */
export function WorkMoveDialog({data,destinations,allowTask,parent,disabled,onChange}:{data:WorkTreeSnapshot;destinations:WorkNode[];allowTask:boolean;parent:string;disabled:boolean;onChange:(parent:string)=>void}){
 return <label>Destination parent<select value={parent} disabled={disabled} onChange={event=>onChange(event.target.value)}>
  {allowTask&&<option value="">This task</option>}
  {destinations.map(node=><option key={node.id} value={node.id}>{staffingNodePath(data,node.id)}</option>)}
 </select></label>;
}
