import {fetchWorkTree,isCurrentWorkSnapshot,selectNodeWorkCapability,type WorkCapabilityContext,type WorkTreeSnapshot} from '../../nested-work';

/** Match the native direct-update preflight; SQL remains authoritative at write time. */
export async function verifySubtaskProgressAccess(baseline:WorkTreeSnapshot,nodeId:string,context:WorkCapabilityContext):Promise<void> {
 if(!isCurrentWorkSnapshot(baseline,context))throw new Error('Verify current work access before posting an update.');
 const latest=await fetchWorkTree(baseline.root.id);
 const node=latest.nodes.find(item=>item.id===nodeId&&item.task_id===baseline.root.id);
 const participant=!!context.actorId&&!!node&&(latest.root.lead===context.actorId||node.lead_id===context.actorId||node.assigned_to_ids.includes(context.actorId));
 if(!node||!participant||latest.revision!==baseline.revision||!selectNodeWorkCapability(latest,nodeId,'execute',{...context,executionBlocked:context.executionBlocked||latest.root.project_status==='on_hold'}).allowed){
  throw new Error('Work access or revision changed. Reopen this subtask and review the current work.');
 }
}
