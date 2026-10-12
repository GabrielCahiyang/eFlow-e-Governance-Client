import type {WorkPerson} from '../types';

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
