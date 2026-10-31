import {isCurrentWorkSnapshot,selectNodeWorkCapability,type WorkCapabilityContext,type WorkTreeSnapshot} from '../../nested-work';

/** Work actions stay server-selected; finance keeps its distinct Task Lead rule. */
export function selectSubitemInspectorCapabilities(tree:WorkTreeSnapshot,itemId:string,context:WorkCapabilityContext){
 const action=(name:Parameters<typeof selectNodeWorkCapability>[2])=>selectNodeWorkCapability(tree,itemId,name,context).allowed;
 const budgetReadOnly=!!context.readOnly||!isCurrentWorkSnapshot(tree,context)||tree.people.find(person=>person.id===context.actorId)?.eligible!==true;
 return {execute:action('execute'),submit:action('submit'),review:action('review'),editDetails:action('edit_details'),
  budgetReadOnly,manageBudget:!budgetReadOnly&&tree.root.lead===context.actorId,submitBlockedReason:submitBlockedReason(tree,itemId,context)};
}

/** Plain-language reason Mark complete is unavailable, or null when it is allowed. */
function submitBlockedReason(tree:WorkTreeSnapshot,itemId:string,context:WorkCapabilityContext):string|null{
  const submit=selectNodeWorkCapability(tree,itemId,'submit',context);
  if(submit.allowed)return null;
  switch(submit.reason_code){
   case 'branch_denied':return 'Only this step’s lead or the task lead can mark it complete. Ask the task lead to appoint you as lead of this step.';
   case 'lifecycle_blocked':return 'This step can’t be completed yet. Finish the earlier steps and any child steps first, and make sure the task is still open.';
   case 'access_unavailable':return 'Your access to this work could not be verified. Reload the page.';
   case 'read_only':return 'This work is read-only right now.';
   default:return submit.disabledReason||'Mark complete is not available for this step.';
  }
}