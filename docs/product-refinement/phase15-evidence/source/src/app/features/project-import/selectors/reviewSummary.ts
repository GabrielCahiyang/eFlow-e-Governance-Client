import type { ProjectImportDraft } from '../types';
export function projectImportSummary(draft: ProjectImportDraft) {
  const groups = draft.groups.filter(group => group.tasks.some(task => task.included));
  const tasks = groups.flatMap(group => group.tasks.filter(task => task.included));
  return { groups: groups.length, tasks: tasks.length, subitems: tasks.reduce((n, task) => n + task.subitems.length, 0), proposedOffices: draft.offices.filter(office => !office.officeId).map(office => office.name), unconfirmedOffices: draft.offices.filter(office => !office.confirmed).length };
}
