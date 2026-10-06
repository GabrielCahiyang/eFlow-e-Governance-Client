// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkspaceTabs } from '../../src/app/components/ui/workspace/WorkspaceTabs';
import { ProgressBar } from '../../src/app/components/workflow/primitives';

afterEach(cleanup);
it('keeps original tab values while linking panels with whitespace-safe IDs', () => {
  const changed = vi.fn();
  render(<WorkspaceTabs tabs={[{id:'All Users',label:'All users',content:'Directory'},{id:'Role Defaults',label:'Roles',content:'Role editor'}]} value="All Users" onValueChange={changed}/>);
  const tab = screen.getByRole('tab', {name:'All users'});
  const target = tab.getAttribute('aria-controls')!;
  expect(target).not.toMatch(/\s/);
  expect(document.getElementById(target)?.textContent).toBe('Directory');
  fireEvent.mouseDown(screen.getByRole('tab', {name:'Roles'}), {button:0,ctrlKey:false});
  expect(changed).toHaveBeenCalledWith('Role Defaults');
});
it('announces one named progress meter with clamped bounds', () => {
  render(<ProgressBar value={140}/>);
  const bars = screen.getAllByRole('progressbar');
  expect(bars).toHaveLength(1);
  expect(bars[0].getAttribute('aria-label')).toBe('100% complete');
  expect(bars[0].getAttribute('aria-valuenow')).toBe('100');
});
