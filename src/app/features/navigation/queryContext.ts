export interface NavigationRestore {workspaceId?:string;parameters:Record<string,string>}
export const navigationDisplayKeys=['workspace','project','view','plans','proposal','proposalView','people','date','q','workScope','recent','fy'] as const;
/** Display-route preferences only; never restore an evidence or mutation identity. */
export function navigationParameters(value:unknown):Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 return Object.fromEntries(navigationDisplayKeys.flatMap(key=>typeof (value as Record<string,unknown>)[key]==='string'?[[key,(value as Record<string,string>)[key]]]:[]));
}

export const reviewRouteViews = ['tasks', 'workplans', 'governance', 'subtasks', 'budget', 'membership'] as const;
export const budgetRouteViews = ['overview', 'annual', 'funding', 'approvals', 'releases', 'expenses', 'vouchers', 'journal', 'audit'] as const;
// Include existing project parser aliases at this display-preference boundary.
const projectViews = ['tasks', 'board', 'gantt', 'calendar', 'dashboard', 'offices', 'members', 'overview', 'timeline', 'reports', 'proposal_context', 'activity', 'reviews', 'budget', 'plan', 'delivery', 'work', 'people', 'team', 'workload', 'readiness', 'signoff', 'evidence', 'decisions', 'main_table', 'main-table', 'proposal-context'];
export function readRouteFiscalYear(value: string | null | undefined): number | undefined {
  return value && /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2200 ? Number(value) : undefined;
}

/** Destination schemas validate display state, never business eligibility or record access. */
export function destinationNavigationParameters(section: string, value: unknown, page?: string): Record<string, string> {
  const source = navigationParameters(value), result: Record<string, string> = {};
  const copy = (key: string) => { if (source[key]) result[key] = source[key]; };
  copy('workspace');
  if (section === 'projects') {
    copy('project');
    if (projectViews.includes(source.view)) copy('view');
    if (source.project && source.people === 'add') copy('people');
    if (!source.project) {
      if (source.proposal) {
        copy('proposal');
        if (['overview','approvals','governance'].includes(source.proposalView)) copy('proposalView');
      } else if (['saved','review'].includes(source.plans)) copy('plans');
    }
  }
  if (section === 'reviews' && reviewRouteViews.some(view => view === source.view)) copy('view');
  if (section === 'budget' || section === 'accounting_budgets') {
    if (budgetRouteViews.some(view => view === source.view)) copy('view');
  }
  if (section === 'budget' || section.startsWith('accounting_')) {
    const year = readRouteFiscalYear(source.fy);
    if (year !== undefined) result.fy = String(year);
  }
  if (section === 'personal_work') {
    const alias = ({ 'Due today': 'Today', 'Due this week': 'This week', Overdue: 'Overdue' } as Record<string, string>)[page || ''];
    if (['All my work', 'Today', 'This week', 'Overdue'].includes(source.date)) copy('date');
    else if (alias) result.date = alias;
    copy('q'); copy('workScope');
    if (['0', '1'].includes(source.recent)) copy('recent');
    else if (page === 'Recently completed') result.recent = '1';
  }
  return result;
}
