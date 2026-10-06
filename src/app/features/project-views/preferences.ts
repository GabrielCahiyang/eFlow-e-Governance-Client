import { EMPTY_PROJECT_FILTERS, type ProjectViewFilters } from './types';
import { calendarDay } from './selectors';
export function normalizeProjectFilters(value: unknown): ProjectViewFilters {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...EMPTY_PROJECT_FILTERS };
  for (const key of ['query', 'owner', 'office', 'status'] as const) result[key] = typeof source[key] === 'string' ? source[key] as string : '';
  if (!['pending_assignment','todo','in_progress','for_review','changes_requested','completed','cancelled'].includes(result.status)) result.status = '';
  if (['manual', 'title', 'deadline', 'priority'].includes(String(source.sort))) result.sort = source.sort as ProjectViewFilters['sort'];
  for (const key of ['dateFrom', 'dateTo'] as const) result[key] = typeof source[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source[key]) && calendarDay(source[key]) !== null ? source[key] as string : '';
  if (result.dateFrom && result.dateTo && result.dateFrom > result.dateTo) { result.dateFrom = ''; result.dateTo = ''; }
  return result;
}
export const projectViewPreferenceKey = (userId: string, projectId: string) => `eflow_project_views_v1_${userId}_${projectId}`;
