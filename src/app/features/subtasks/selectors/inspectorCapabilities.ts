import {isCurrentWorkSnapshot,selectNodeWorkCapability,type WorkCapabilityContext,type WorkTreeSnapshot} from '../../nested-work';

/** Work actions stay server-selected; finance keeps its distinct Task Lead rule. */
export function selectSubitemInspectorCapabilities(tree:WorkTreeSnapshot,itemId:string,context:WorkCapabilityContext){
 const action=(name:Parameters<typeof selectNodeWorkCapability>[2])=>selectNodeWorkCapability(tree,itemId,name,context).allowed;
 const budgetReadOnly=!!context.readOnly||!isCurrentWorkSnapshot(tree,context)||tree.people.find(person=>person.id===context.actorId)?.eligible!==true;
 return {execute:action('execute'),submit:action('submit'),review:action('review'),editDetails:action('edit_details'),
  budgetReadOnly,manageBudget:!budgetReadOnly&&tree.root.lead===context.actorId};
}
