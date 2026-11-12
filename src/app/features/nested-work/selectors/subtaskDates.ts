import {isCalendarDate} from '../../../shared/calendarDates';
import type {WorkTreeSnapshot} from '../types';

export function subtaskDateLimits(tree: WorkTreeSnapshot, parentId: string) {
  const bounds = tree.root.scheduleBounds;
  const starts = [bounds?.projectStart, bounds?.taskStart];
  const ends = [bounds?.projectDue, bounds?.taskDue, tree.root.due];
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = tree.nodes.find(node => node.id === parentId);
    if (!parent) break;
    starts.push(parent.start_date);
    ends.push(parent.due_date);
    parentId = parent.parent_subtask_id || '';
  }
  const valid = (date: string | null | undefined): date is string =>
    !!date && isCalendarDate(date);
  return {
    earliest: starts.filter(valid).sort().reverse()[0],
    latest: ends.filter(valid).sort()[0],
  };
}

export function subtaskDateIssue(
  start: string,
  due: string,
  {earliest, latest}: ReturnType<typeof subtaskDateLimits>,
) {
  if (!isCalendarDate(start)) return 'Choose a subtask start date.';
  if (!isCalendarDate(due)) return 'Choose a subtask due date.';
  if (start > due) return 'Subtask due date must be on or after its start date.';
  if (earliest && start < earliest) return `Subtask start date cannot be before ${earliest}.`;
  if (latest && due > latest) return `Subtask due date cannot be after ${latest}.`;
  return '';
}
