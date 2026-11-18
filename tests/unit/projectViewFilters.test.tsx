// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectViewFilters } from '../../src/app/features/project-views/components/ProjectViewFilters';
import { EMPTY_PROJECT_FILTERS } from '../../src/app/features/project-views/types';
import { TableToolbar } from '../../src/app/features/project-table/components/TableToolbar';

afterEach(cleanup);

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

describe('ProjectViewFilters and TableToolbar UI controls', () => {
  it('renders bordered select pills, grouped date range controls, and active filter indicators', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ProjectViewFilters
        value={{ ...EMPTY_PROJECT_FILTERS, status: 'todo', dateFrom: '2026-10-01' }}
        onChange={onChange}
        profiles={[{ id: 'u1', full_name: 'Alex Rivera', email: 'alex@example.test', role: 'head' } as never]}
        offices={[{ id: 'o1', name: 'Planning Office' } as never]}
        count={3}
      />,
    );

    expect(container.querySelectorAll('.pv-select-field')).toHaveLength(4);
    expect(container.querySelector('.pv-date-range')).toBeTruthy();
    expect(container.querySelectorAll('.pv-date-field')).toHaveLength(2);
    expect(screen.getByLabelText('Filter status').closest('.pv-select-field')?.getAttribute('data-active')).toBe('true');
    expect(screen.getByLabelText('Filter date from').closest('.pv-date-field')?.getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('3 visible tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_PROJECT_FILTERS, sort: 'manual' });
  });

  it('uses matching bordered select pills and search control in standalone TableToolbar', () => {
    const setQuery = vi.fn();
    const setStatus = vi.fn();
    const setOwner = vi.fn();
    const setSort = vi.fn();
    const { container } = render(
      <TableToolbar
        sharedFilters={false}
        query="OutReach"
        setQuery={setQuery}
        status="in_progress"
        setStatus={setStatus}
        owner=""
        setOwner={setOwner}
        sort="manual"
        setSort={setSort}
        people={[{ id: 'u1', full_name: 'Alex Rivera', email: 'alex@example.test', role: 'head' } as never]}
        hidden={[]}
        toggleColumn={vi.fn()}
        canManage={false}
        onAddTask={vi.fn()}
        onAddInlineTask={vi.fn()}
        onAddGroup={vi.fn()}
        onImport={vi.fn()}
        onAi={vi.fn()}
      />,
    );

    expect(container.querySelector('.pt-search')?.getAttribute('data-active')).toBe('true');
    expect(container.querySelectorAll('.pt-select-field')).toHaveLength(3);
    expect(screen.getByLabelText('Filter status').closest('.pt-select-field')?.getAttribute('data-active')).toBe('true');
    expect(screen.getByLabelText('Filter owner').closest('.pt-select-field')?.getAttribute('data-active')).toBeNull();
  });
});
