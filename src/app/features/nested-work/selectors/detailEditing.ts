import type {WorkNode} from '../types';

export function readNodeDetailEditState(node:WorkNode|undefined,rootId:string):NonNullable<WorkNode['detail_edit']>|null {
 if(!node||!rootId||node.task_id!==rootId)return null;
 const state=node.detail_edit;
 if(!state||state.version!==1||state.task_id!==rootId||state.node_id!==node.id||!(state.updated_at===null||typeof state.updated_at==='string')||
  typeof state.started!=='boolean'||typeof state.details!=='boolean'||typeof state.due!=='boolean'||typeof state.planning!=='boolean')return null;
 return state;
}
