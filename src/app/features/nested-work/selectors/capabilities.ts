import type {NodeWorkAction,RootWorkAction,WorkActionAvailability,WorkCapabilityContext,WorkCapabilityReasonCode,WorkTreeSnapshot} from '../types';

const reasons:Record<WorkCapabilityReasonCode|'capability_unavailable',string>={
 access_unavailable:'Your current access to this work could not be verified. Reload the work.',
 read_only:'This work is read-only in the current view.',
 branch_denied:'You do not have permission for this action on this work.',
 appointment_denied:'You do not have permission to appoint this Lead.',
 lifecycle_blocked:'The current work state or execution prerequisites block this action.',
 history_blocked:'Existing work history or commitments block this change.',
 capability_unavailable:'Action availability could not be verified. Reload the work.',
};
const rootActions:readonly RootWorkAction[]=['manage_contributors','appoint_lead','create_child','order_children'];
const nodeActions:readonly NodeWorkAction[]=[...rootActions,'edit_details','move','delete','execute','submit','review'];
type SnapshotContext=Omit<WorkCapabilityContext,'readOnly'|'executionBlocked'>;
const contexts=new WeakMap<WorkTreeSnapshot,SnapshotContext>();
const hasOwn=(value:object,key:PropertyKey)=>Object.prototype.hasOwnProperty.call(value,key);
const deny=(reason:Exclude<WorkActionAvailability['reason_code'],null>):WorkActionAvailability=>({allowed:false,reason_code:reason,disabledReason:reasons[reason]});

/** Service-only bookkeeping, deliberately absent from the feature public API.
 * No wire fields are added. Persisted/cloned/activity snapshots are unverifiable.
 * This is a client presentation guard; SQL rechecks authority on every mutation.
 */
export function rememberWorkCapabilityContext(snapshot:WorkTreeSnapshot,actorId:string):void {
 contexts.set(snapshot,{actorId,rootId:snapshot.root.id,projectId:snapshot.root.project,officeId:snapshot.root.office,kind:snapshot.root.kind,revision:snapshot.revision});
}

/** Shared identity check for the controller; not a new authority source or public API. */
export function isCurrentWorkSnapshot(snapshot:WorkTreeSnapshot|undefined,context:WorkCapabilityContext):boolean {
 if(!snapshot||!context.actorId)return false;
 const loaded=contexts.get(snapshot),root=snapshot.root;
 if(!loaded||!root||!context.rootId||!context.projectId||!Number.isSafeInteger(context.revision)||context.revision<1
  ||!['office','personal'].includes(context.kind)
  ||(context.kind==='office'?!context.officeId:context.officeId!==null)
  ||loaded.actorId!==context.actorId
  ||loaded.rootId!==context.rootId||root.id!==context.rootId
  ||loaded.projectId!==context.projectId||root.project!==context.projectId
  ||loaded.officeId!==context.officeId||root.office!==context.officeId
  ||loaded.kind!==context.kind||root.kind!==context.kind
  ||loaded.revision!==context.revision||snapshot.revision!==context.revision)return false;
 return true;
}

function currentSnapshot(snapshot:WorkTreeSnapshot|undefined,context:WorkCapabilityContext):WorkActionAvailability|null {
 if(!isCurrentWorkSnapshot(snapshot,context))return deny('capability_unavailable');
 const root=snapshot!.root;
 if(context.readOnly)return deny('read_only');
 if(root.open===false)return deny('lifecycle_blocked');
 if(root.open!==true)return deny('capability_unavailable');
 return null;
}

function actionEntry(map:unknown,action:NodeWorkAction):WorkActionAvailability {
 if(!map||typeof map!=='object'||Array.isArray(map)||!hasOwn(map,action))return deny('capability_unavailable');
 const entry=(map as Record<string,unknown>)[action];
 if(!entry||typeof entry!=='object'||Array.isArray(entry)||!hasOwn(entry,'allowed')||!hasOwn(entry,'reason_code'))return deny('capability_unavailable');
 const {allowed,reason_code}=entry as {allowed:unknown;reason_code:unknown};
 if(allowed===true&&reason_code===null)return {allowed:true,reason_code:null,disabledReason:null};
 if(allowed===false&&typeof reason_code==='string'&&hasOwn(reasons,reason_code)&&reason_code!=='capability_unavailable')return deny(reason_code as WorkCapabilityReasonCode);
 return deny('capability_unavailable');
}

export function selectRootWorkCapability(snapshot:WorkTreeSnapshot|undefined,action:RootWorkAction,context:WorkCapabilityContext):WorkActionAvailability {
 const blocked=currentSnapshot(snapshot,context);
 if(blocked)return blocked;
 if(!rootActions.includes(action))return deny('capability_unavailable');
 return actionEntry(snapshot!.root.capabilities,action);
}

export function selectNodeWorkCapability(snapshot:WorkTreeSnapshot|undefined,nodeId:string,action:NodeWorkAction,context:WorkCapabilityContext):WorkActionAvailability {
 const blocked=currentSnapshot(snapshot,context);
 if(blocked)return blocked;
 if(!nodeId||!nodeActions.includes(action)||!Array.isArray(snapshot!.nodes))return deny('capability_unavailable');
 const matches=snapshot!.nodes.filter(node=>node&&typeof node==='object'&&!Array.isArray(node)&&node.id===nodeId);
 if(matches.length!==1||matches[0].task_id!==context.rootId)return deny('capability_unavailable');
 const result=actionEntry(matches[0].capabilities,action);
 if(result.allowed&&context.executionBlocked&&(action==='execute'||action==='submit'))return deny('lifecycle_blocked');
 return result;
}
