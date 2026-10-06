import { PROJECT_COLUMNS, type ProjectColumn } from './types';

export type ResizableColumn = 'task' | ProjectColumn;
export const COLUMN_LAYOUT: Record<ResizableColumn, { width: number; min: number; max: number }> = {
  task: { width: 320, min: 200, max: 640 }, office: { width: 170, min: 120, max: 360 },
  owner: { width: 180, min: 150, max: 360 }, status: { width: 160, min: 144, max: 320 },
  priority: { width: 124, min: 100, max: 240 }, timeline: { width: 220, min: 180, max: 400 },
  effort: { width: 108, min: 96, max: 240 }, dependencies: { width: 180, min: 120, max: 400 },
  budget: { width: 160, min: 120, max: 320 }, progress: { width: 140, min: 120, max: 320 },
};
export type ColumnWidths = Record<ResizableColumn, number>;
export const DEFAULT_COLUMN_WIDTHS = Object.fromEntries(Object.entries(COLUMN_LAYOUT).map(([id, value]) => [id, value.width])) as ColumnWidths;
export function boundedColumnWidth(id: ResizableColumn, value: unknown) {
  const rule = COLUMN_LAYOUT[id];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(rule.max, Math.max(rule.min, value))) : rule.width;
}
export function normalizeColumnWidths(value: unknown): ColumnWidths {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.keys(COLUMN_LAYOUT).map(id => [id, boundedColumnWidth(id as ResizableColumn, saved[id])])) as ColumnWidths;
}
export function normalizeHiddenColumns(value: unknown): ProjectColumn[] {
  return Array.isArray(value) ? PROJECT_COLUMNS.filter(column => value.includes(column.id)).map(column => column.id) : [];
}
