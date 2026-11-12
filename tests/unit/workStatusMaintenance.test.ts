import { describe, expect, it } from 'vitest';
import { customStatusChoices, orderedStatusLabels, resolveStatus, type StatusDefinition } from '../../src/app/features/work-status/statusDefinitions';
import { getAuthorizedSupportPages, resolveSupportPage } from '../../src/app/features/navigation/administrativePages';

const definitions: StatusDefinition[] = [
  { id: 'todo', label: 'To-do', color: '#087972', position: 50, scope: 'builtin', retired: false },
  { id: 'archived', label: 'Filed', color: null, position: 120, scope: 'builtin', retired: false },
  { id: 'waiting', label: 'Waiting for supplier', color: null, position: 30, scope: 'both', retired: false },
  { id: 'drafting', label: 'Drafting', color: null, position: 20, scope: 'task', retired: false },
  { id: 'retired', label: 'Old label', color: null, position: 10, scope: 'both', retired: true },
];

describe('Status Maintenance', () => {
  it('is an Admin Center destination for admins only', () => {
    expect(resolveSupportPage('administration', 'Status Maintenance')).toBe('Status Maintenance');
    expect(getAuthorizedSupportPages('admin', () => true).some(page => page.label === 'Status Maintenance')).toBe(true);
    for (const role of ['head', 'member', 'accounting_staff']) {
      expect(getAuthorizedSupportPages(role, () => true).some(page => page.label === 'Status Maintenance')).toBe(false);
    }
  });

  it('uses built-in overrides and preserves surface defaults until configured', () => {
    expect(resolveStatus([], 'todo', 'Not started').label).toBe('Not started');
    expect(resolveStatus(definitions, 'todo', 'Not started')).toEqual({ label: 'To-do', color: '#087972' });
    expect(resolveStatus(definitions, 'archived', 'Archived').label).toBe('Filed');
    expect(orderedStatusLabels(definitions, { todo: 'To Do', in_progress: 'In progress' }).map(item => item.id))
      .toEqual(['in_progress', 'todo']);
  });

  it('uses current scope and order for choices while keeping retired labels visible on existing work', () => {
    expect(customStatusChoices(definitions, 'task').map(item => item.id)).toEqual(['drafting', 'waiting']);
    expect(customStatusChoices(definitions, 'subtask').map(item => item.id)).toEqual(['waiting']);
    expect(resolveStatus(definitions, 'in_progress', 'In progress', 'retired').label).toBe('Old label');
    expect(resolveStatus(definitions, 'completed', 'Completed', 'retired').label).toBe('Completed');
  });
});
