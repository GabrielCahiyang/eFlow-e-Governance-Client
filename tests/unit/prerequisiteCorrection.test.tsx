// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkNodeDependenciesCell } from '../../src/app/features/nested-work/components/WorkNodePlanningCells';
import type { WorkNode } from '../../src/app/features/nested-work';

afterEach(cleanup);
const node = (id: string, patch: Partial<WorkNode> = {}) => ({ id, title: id, task_id: 'task', parent_subtask_id: null,
  status: 'todo', sibling_order: 0, dependency_ids: [], can_edit_dependencies: true, ...patch }) as WorkNode;
const selected = node('current', { dependency_ids: ['cancelled'], pending_dependency_count: 1 });
const records = [selected, node('cancelled', { status: 'cancelled' }), node('replacement'), node('another-cancelled', { status: 'cancelled' })];

it('lets an authorized pre-start planner remove a visible cancelled selection and replace it', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<WorkNodeDependenciesCell node={selected} nodes={records} supported disabled={false} save={save}/>);
  expect(screen.getByRole('button', { name: 'Edit dependencies for current' }).textContent).toContain('Waiting for 1 subtask');
  fireEvent.click(screen.getByRole('button', { name: 'Edit dependencies for current' }));
  const cancelled = screen.getByRole('checkbox', { name: /cancelled.*remove or replace/i });
  expect(cancelled.matches(':disabled')).toBe(false); expect((cancelled as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByRole('checkbox', { name: /another-cancelled/ })).toBeNull();
  fireEvent.click(cancelled); fireEvent.click(screen.getByRole('checkbox', { name: /replacement/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Save dependencies' }));
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith({ dependency_ids: ['replacement'] }));
});

it.each([
  { dependency_ids: ['missing'] },
  { restricted_dependency_count: 1 },
  { started_at: '2026-11-15T00:00:00Z' },
  { status: 'in_progress' },
  { can_edit_dependencies: false },
])('keeps missing/restricted and unauthorized or started edits closed: %j', patch => {
  const current = { ...selected, ...patch } as WorkNode;
  render(<WorkNodeDependenciesCell node={current} nodes={records} supported disabled={false} save={vi.fn()}/>);
  expect(screen.getByRole('button', { name: 'Edit dependencies for current' }).matches(':disabled')).toBe(true);
});
it('saves an intentional empty selection from NULL without a temporary prerequisite write',async()=>{
  const save=vi.fn().mockResolvedValue(undefined);
  const legacy=node('current',{dependency_ids:null,is_standalone:false,sibling_order:1});
  render(<WorkNodeDependenciesCell node={legacy} nodes={[legacy,node('earlier',{is_standalone:false,sibling_order:0})]} supported disabled={false} save={save}/>);
  fireEvent.click(screen.getByRole('button',{name:'Edit dependencies for current'}));
  expect(screen.getByRole('button',{name:'Save dependencies'}).matches(':disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Use no prerequisites'}));
  fireEvent.click(screen.getByRole('button',{name:'Save dependencies'}));
  await waitFor(()=>expect(save).toHaveBeenCalledExactlyOnceWith({dependency_ids:[]}));
});
