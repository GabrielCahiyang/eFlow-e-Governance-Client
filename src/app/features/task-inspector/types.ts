export type TaskInspectorSection = 'overview' | 'work' | 'updates' | 'files' | 'activity' | 'review';

export interface TaskInspectorOrigin {
  view: string;
  section?: TaskInspectorSection | 'details' | 'team' | 'report-blocker' | 'submit-work';
  returnFocus?: HTMLElement | null;
  restoreFocus?: () => void;
}

export const TASK_INSPECTOR_SECTIONS: ReadonlyArray<{ id: TaskInspectorSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'updates', label: 'Updates' },
  { id: 'files', label: 'Files' },
  { id: 'activity', label: 'Activity' },
  { id: 'review', label: 'Review' },
];

/** Preserve the original Updates default and historical entrance aliases. */
export function resolveTaskInspectorSection(section?: TaskInspectorOrigin['section']): TaskInspectorSection {
  if (section === 'details') return 'overview';
  if (['team','report-blocker','submit-work'].includes(section||'')) return 'work';
  return (section || 'updates') as TaskInspectorSection;
}
