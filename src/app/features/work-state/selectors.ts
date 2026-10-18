export function workStateLabel(status: string, stuck = false): string {
  if (stuck && status === 'in_progress') return 'Stuck';
  return ({todo:'Not started',pending_assignment:'Needs a lead',in_progress:'In progress',for_review:'Awaiting approval',changes_requested:'Changes requested',completed:'Completed',cancelled:'Cancelled'} as Record<string,string>)[status] || status;
}
/** Approval is the source of completion. Internal legacy percentages remain history. */
export function approvedWorkProgress(nodes: readonly {id:string;parent_subtask_id?:string|null;status:string}[]) {
  const parents = new Set(nodes.map(node => node.parent_subtask_id).filter(Boolean));
  const leaves = nodes.filter(node => !parents.has(node.id));
  const approved = leaves.filter(node => node.status === 'completed').length;
  return {approved,total:leaves.length,percent:leaves.length ? Math.round(approved/leaves.length*100) : 0};
}
