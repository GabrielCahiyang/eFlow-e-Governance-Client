export type ReadinessDestination = 'tasks' | 'gantt' | 'offices' | 'budget' | 'proposal_context' | 'reviews';
/** Map official check keys to existing views; never calculate readiness locally. */
export function readinessResolution(key: string, governed: boolean): { view: ReadinessDestination; label: string } | null {
  if (governed && ['structure', 'dates', 'budget'].includes(key)) return { view: 'proposal_context', label: 'Open proposal review' };
  if (['office_identity', 'invitations', 'responsibilities'].includes(key)) return { view: 'offices', label: 'Resolve in Project Offices' };
  if (['structure', 'work', 'staffing'].includes(key)) return { view: 'tasks', label: 'Review in Main table' };
  if (['dates', 'schedule'].includes(key)) return { view: 'gantt', label: 'Review schedule in Gantt' };
  if (key === 'budget') return { view: 'budget', label: 'Review Budget Overview' };
  return null;
}
export function closeoutResolution(kind: string): { view: ReadinessDestination; label: string } | null {
  if (kind === 'cash') return { view: 'budget', label: 'Review financial settlement' };
  if (kind === 'governance') return { view: 'proposal_context', label: 'Open proposal review' };
  if (kind === 'work') return { view: 'tasks', label: 'Review required work' };
  return null;
}
