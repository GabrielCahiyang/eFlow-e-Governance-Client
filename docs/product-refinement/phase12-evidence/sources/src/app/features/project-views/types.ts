import type { Task } from '../tasks';
import type { TableSort } from '../project-table';

export interface ProjectViewFilters {
  query: string;
  status: string;
  owner: string;
  office: string;
  sort: TableSort;
  dateFrom?: string;
  dateTo?: string;
}
export const EMPTY_PROJECT_FILTERS: ProjectViewFilters = { query: '', status: '', owner: '', office: '', sort: 'manual' };
export interface TaskScheduleRow { task: Task; start: number; end: number; point: boolean }
