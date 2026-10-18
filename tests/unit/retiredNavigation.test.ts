// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { buildShellNavigation, getSidebarContent, readNavigationLocation } from '../../src/app/features/navigation';

afterEach(() => window.history.replaceState({}, '', '/'));

describe('retired navigation cleanup', () => {
  it.each(['head', 'member', 'accounting_staff'])('excludes duplicate Leading and obsolete alias tabs for %s', role => {
    const items = buildShellNavigation({ role, can: () => true, hasLeadingWork: true });
    expect(items.find(item => item.id === 'personal_work')?.pages.map(page => page.label))
      .toEqual(['Assigned work', 'Leading', 'Subtasks', 'History']);
    expect(items.some(item => ['leading', 'leader', 'mywork', 'command', 'deptportfolio', 'workspace'].includes(item.id))).toBe(false);
    expect(items.flatMap(item => item.pages).some(page => /Pinned|Work I'm Leading|Leading Work/.test(page.label))).toBe(false);
    for (const section of ['leading', 'leader', 'mywork', 'command', 'deptportfolio', 'workspace'])
      expect(getSidebarContent(role, section).sections).toEqual([]);
  });

  it.each(['head', 'member', 'accounting_staff'])('maps old Leading bookmarks to current My Work for %s', role => {
    for (const path of ['/leading?page=Leading+Work', '/leader?page=Pinned']) {
      window.history.replaceState({}, '', path);
      expect(readNavigationLocation(role, () => undefined)).toEqual({ section: 'personal_work', page: 'Leading' });
    }
  });

  it('keeps Admin on account management for an old operational bookmark', () => {
    window.history.replaceState({}, '', '/leading?page=Leading+Work');
    expect(readNavigationLocation('admin', () => 'All Users')).toEqual({ section: 'users', page: 'All Users' });
  });
});
