import type {WorkPerson,WorkTreeSnapshot} from '../types';

export interface WorkPeoplePriority {ids:readonly string[];label:'On this task'|'On parent subtask'}

/** Ranking only: parent responsibility never grants directory eligibility. */
export function workAssignmentPriority(data:WorkTreeSnapshot,parentId:string|null):WorkPeoplePriority {
 const parent=parentId?data.nodes.find(node=>node.id===parentId):undefined;
 return {label:parentId?'On parent subtask':'On this task',ids:deduplicateWorkPersonIds(parentId
  ?[parent?.lead_id||'',...(parent?.assigned_to_ids||[])]
  :[data.root.lead||'',...data.root.people])};
}

/** Search and group only server-confirmed eligible people, preserving directory order. */
export function groupWorkAssignmentPeople(people:readonly WorkPerson[],priority?:WorkPeoplePriority,query='') {
 const eligible=eligibleWorkPeople(people).filter(person=>resolveWorkPersonName(people,person.id).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 if(!priority)return [{label:'Eligible members',people:eligible}];
 const ids=new Set(priority.ids);
 return [{label:priority.label,people:eligible.filter(person=>ids.has(person.id))},
  {label:'Other eligible members',people:eligible.filter(person=>!ids.has(person.id))}];
}

/** Preserve canonical IDs and their order; never mutate a stored worker list. */
export function deduplicateWorkPersonIds(ids:readonly string[]):string[] {
 return [...new Set(ids.filter(id=>id.length>0))];
}

/** Use only the authorized tree directory, including its historical people. */
export function resolveWorkPersonName(people:readonly WorkPerson[],id:string):string {
 return people.find(person=>person.id===id)?.name?.trim()||'Previously assigned person';
}

export function displayedWorkContributorIds(leadId:string|null,contributorIds:readonly string[]):string[] {
 return deduplicateWorkPersonIds(contributorIds).filter(id=>id!==leadId);
}

/** Combine direct task contributors with distinct subtask leads/contributors excluding root lead. */
export function collectSubtaskTeamIds(
 leadId:string|null,
 directContributorIds:readonly string[],
 nodes:readonly {lead_id:string|null;assigned_to_ids:readonly string[]}[],
){
 const directIds=displayedWorkContributorIds(leadId,directContributorIds);
 const subtaskIds=deduplicateWorkPersonIds(nodes.flatMap(node=>[node.lead_id||'',...node.assigned_to_ids]))
  .filter(id=>id!==leadId&&!directIds.includes(id));
 return {directIds,subtaskIds,teamIds:[...directIds,...subtaskIds]};
}

/** Normalize only at the command boundary. Appointment never comes from order.
 * Carry the original worker IDs through a transfer to retain any former Lead
 * contribution. A historical Lead absent from that list is not added as a worker.
 * Personal root appointment has no worker payload and must not use this helper.
 */
export function compatibilityWorkWorkerIds(leadId:string|null,contributorIds:readonly string[]):string[] {
 return deduplicateWorkPersonIds([...contributorIds,...(leadId?[leadId]:[])]);
}

/** Missing eligibility is not permission. The caller supplies snapshot.people,
 * never a global profile directory. Conflicting duplicate records fail closed.
 */
export function eligibleWorkPeople(people:readonly WorkPerson[]):WorkPerson[] {
 const ids=deduplicateWorkPersonIds(people.map(person=>person.id));
 return ids.flatMap(id=>{
  const matches=people.filter(person=>person.id===id);
  return matches.every(person=>person.eligible===true)?[matches[0]]:[];
 });
}
