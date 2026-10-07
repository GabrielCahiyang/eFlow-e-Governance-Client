export type ReadinessDestination = 'tasks' | 'gantt' | 'offices' | 'budget' | 'signoff' | 'proposal_context' | 'evidence' | 'timeline';
/** Map official check keys to existing views; never calculate readiness locally. */
export function readinessResolution(key: string, governed: boolean): { view: ReadinessDestination; label: string } | null {
  if (['project_description','project_lead'].includes(key)) return {view:'timeline',label:'Edit project details'};
  if (key === 'project_name' || key.startsWith('task_name:')) return {view:'tasks',label:'Fill in missing name'};
  if (key === 'project_office') return {view:'offices',label:'Review Lead Office'};
  if (key.startsWith('task_dates:')) return {view:'gantt',label:'Fix task dates'};
  if (key.startsWith('task_owner:')) return {view:'tasks',label:'Assign task owner'};
  if (key.startsWith('task_office:')) return {view:'offices',label:'Assign responsible Office'};
  if (governed && ['structure', 'dates', 'budget'].includes(key)) return { view: 'signoff', label: 'Open Approval Status' };
  if (['office_identity', 'invitations', 'responsibilities'].includes(key)) return { view: 'offices', label: 'Resolve in Project Offices' };
  if (['structure', 'work', 'staffing'].includes(key)) return { view: 'tasks', label: 'Review in Main table' };
  if (['dates', 'schedule'].includes(key)) return { view: 'gantt', label: 'Review schedule in Gantt' };
  if (key === 'budget') return { view: 'budget', label: 'Review Budget Overview' };
  return null;
}
export function closeoutResolution(kind: string): { view: ReadinessDestination; label: string } | null {
  if (kind === 'cash') return { view: 'budget', label: 'Review financial settlement' };
  if (kind === 'governance') return { view: 'signoff', label: 'Open Approval Status' };
  if (kind === 'work') return { view: 'tasks', label: 'Review required work' };
  return null;
}
