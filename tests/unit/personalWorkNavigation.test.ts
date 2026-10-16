import { describe, expect, it } from 'vitest';
import { buildShellNavigation, getPersonalWorkTools } from '../../src/app/features/navigation';

describe('P2 restrained personal tool reachability', () => {
  it('offers the full workflow for the selected destination and only distinct general tools', () => {
    const items = buildShellNavigation({ role: 'member', can: () => true, hasLeadingWork: true });
    expect(getPersonalWorkTools(items, 'Assigned work').map(tool => tool.section)).toEqual(['tasks', 'deadlines', 'performance', 'reports']);
    for (const [destination, section] of [['Leading','leading'], ['Subtasks','subtasks'], ['History','history']]) {
      const tools = getPersonalWorkTools(items, destination);
      expect(tools).toHaveLength(4);
      expect(tools.some(tool => tool.section === section)).toBe(true);
      expect(tools.some(tool => tool.section === 'inbox' || tool.section === 'personal_work')).toBe(false);
    }
  });
  it('keeps Head Office tools at their existing destinations and honors current grants and appointments', () => {
    const head = buildShellNavigation({ role: 'head', can: () => true, hasLeadingWork: true });
    expect(getPersonalWorkTools(head, 'Assigned work')).toEqual([]);
    expect(getPersonalWorkTools(head, 'Leading').map(tool => tool.section)).toEqual(['leading']);
    const restricted = buildShellNavigation({ role: 'member', can: key => key !== 'navigation.reports', hasLeadingWork: false });
    expect(getPersonalWorkTools(restricted, 'Leading').map(tool => tool.section)).toEqual(['deadlines']);
    expect(getPersonalWorkTools(restricted, 'History').map(tool => tool.section)).toEqual(['deadlines','history']);
  });
  it('does not repeat the current legacy route in its disclosure', () => {
    const items = buildShellNavigation({ role: 'member', can: () => true, hasLeadingWork: true });
    expect(getPersonalWorkTools(items, 'My Tasks', 'tasks').map(tool => tool.section)).toEqual(['deadlines','performance','reports']);
  });
});
