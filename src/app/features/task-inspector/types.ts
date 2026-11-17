export type TaskInspectorSection = 'overview' | 'work' | 'updates' | 'files';

export interface TaskInspectorOrigin {
  view: string;
  section?:
    | TaskInspectorSection
    | 'details'
    | 'team'
    | 'update-work'
    | 'report-blocker'
    | 'submit-work'
    | 'activity'
    | 'review';
  returnFocus?: HTMLElement | null;
  restoreFocus?: () => void;
}

export const TASK_INSPECTOR_SECTIONS: ReadonlyArray<{ id: TaskInspectorSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'updates', label: 'Updates' },
  { id: 'files', label: 'Files' },
];

/** Consolidate historical section aliases into the 4 focused task sections. */
export function resolveTaskInspectorSection(section?: TaskInspectorOrigin['section']): TaskInspectorSection {
  if (section === 'details' || section === 'overview') return 'overview';
  if (
    section === 'work' ||
    section === 'team' ||
    section === 'update-work' ||
    section === 'report-blocker' ||
    section === 'submit-work' ||
    section === 'review'
  ) {
    return 'work';
  }
  if (section === 'files') return 'files';
  if (section === 'activity' || section === 'updates') return 'updates';
  return 'overview';
}
