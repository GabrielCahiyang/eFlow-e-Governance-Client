// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { budgetViewGroups, readBudgetView } from '../../src/app/features/budget/budgetViews';
import { BudgetViewControl } from '../../src/app/features/budget/components/BudgetViewControl';
import { groupOfficeTools } from '../../src/app/features/app-shell/officeToolGroups';
import { buildShellNavigation } from '../../src/app/features/navigation';

describe('P4 authorized destinations and budget views', () => {
  it('preserves all nine URL views without treating areas as routes or authority', () => {
    const values = ['overview','annual','funding','approvals','releases','expenses','vouchers','journal','audit'];
    expect(budgetViewGroups.flatMap(group => group.views.map(view => view.id))).toEqual(values);
    for (const value of values) expect(readBudgetView(value)).toBe(value);
    for (const value of ['planning','ledger','requests','foreign','',null]) expect(readBudgetView(value)).toBeNull();
  });
  it('shows the current local view through one control even for the longest labels', () => {
    const view = render(<BudgetViewControl value="funding" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Budget view' }).textContent).toContain('Proposal & Task Funding');
    expect(screen.queryByRole('tablist')).toBeNull();
    view.rerender(<BudgetViewControl value="vouchers" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Budget view' }).textContent).toContain('Petty Cash Vouchers');
    cleanup();
  });
  it('groups only supplied authorized Office destinations and preserves every page', () => {
    for (const role of ['head','member','accounting_staff','admin']) {
      const items = buildShellNavigation({ role, can: permission => permission !== 'navigation.team_intelligence' });
      const allowed = items.filter(item => item.group === 'workspaces' && item.id !== 'projects');
      const grouped = groupOfficeTools(items);
      expect(grouped.flatMap(group => group.items)).toHaveLength(allowed.length);
      expect(new Set(grouped.flatMap(group => group.items.map(item => item.id)))).toEqual(new Set(allowed.map(item => item.id)));
      expect(grouped.flatMap(group => group.items.flatMap(item => item.pages.map(page => item.id+':'+page.label))).sort()).toEqual(allowed.flatMap(item => item.pages.map(page => item.id+':'+page.label)).sort());
      expect(grouped.flatMap(group => group.items).some(item => item.id === 'intelligence')).toBe(false);
    }
  });
});
