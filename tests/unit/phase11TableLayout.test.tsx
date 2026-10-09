// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeColumnWidths, normalizeHiddenColumns, DEFAULT_COLUMN_WIDTHS, COMPACT_HIDDEN_COLUMNS, COMPACT_COLUMN_WIDTHS } from '../../src/app/features/project-table/columnLayout';
import { useTableLayout } from '../../src/app/features/project-table/hooks/useTableLayout';
import { ColumnResizer } from '../../src/app/features/project-table/components/ColumnResizer';
import { ProjectFilterChips } from '../../src/app/features/project-views/components/ProjectFilterChips';
beforeEach(()=>localStorage.clear());afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('Phase 11 local table layout',()=>{
 it('normalizes malformed/unknown preferences and bounds actual numeric widths',()=>{
  expect(normalizeColumnWidths(null)).toEqual(DEFAULT_COLUMN_WIDTHS);
  expect(normalizeColumnWidths({task:900,owner:-1,status:'900',office:NaN})).toMatchObject({task:640,owner:150,status:160,office:170});
  expect(normalizeHiddenColumns(['task','owner','owner','office','unknown'])).toEqual(['office','owner']);
 });
 it('keeps visibility and widths scoped through project switching and reset',()=>{
  localStorage.setItem('eflow_project_columns_a','[]');
  localStorage.setItem('eflow_project_columns_b','["status"]');
  const view=renderHook(({projectId})=>useTableLayout(projectId),{initialProps:{projectId:'a'}});
  act(()=>{view.result.current.toggleColumn('owner');view.result.current.resizeColumn('task',500);});
  view.rerender({projectId:'b'});expect(view.result.current.hidden).toEqual(['status']);expect(view.result.current.widths.task).toBe(320);
  expect(localStorage.getItem('eflow_project_columns_b')).toBe('["status"]');
  act(()=>view.result.current.resizeColumn('budget',300));view.rerender({projectId:'a'});
  expect(view.result.current.widths.task).toBe(500);expect(view.result.current.hidden).toEqual(['owner']);
  act(()=>view.result.current.resetWidths());expect(view.result.current.widths).toEqual(DEFAULT_COLUMN_WIDTHS);expect(view.result.current.hidden).toEqual(['owner']);
 });
 it.each([null, 'broken', '{}', 'null', '[2]'])('starts compact for absent or malformed preferences (%s)',saved=>{
  if(saved!==null)localStorage.setItem('eflow_project_columns_a',saved);
  const view=renderHook(()=>useTableLayout('a'));
  expect(view.result.current.hidden).toEqual(COMPACT_HIDDEN_COLUMNS);
  expect(view.result.current.widths).toEqual(COMPACT_COLUMN_WIDTHS);
 });
 it('preserves explicit all-visible and partial layouts and supports an intentional compact reset',()=>{
  localStorage.setItem('eflow_project_columns_a','[]');
  localStorage.setItem('eflow_project_table_layout_v1_a',JSON.stringify({version:1,widths:{task:480,effort:160}}));
  const view=renderHook(()=>useTableLayout('a'));
  expect(view.result.current.hidden).toEqual([]);expect(view.result.current.widths).toMatchObject({task:480,effort:160});
  act(()=>view.result.current.resetCompact());
  expect(view.result.current.hidden).toEqual(COMPACT_HIDDEN_COLUMNS);expect(view.result.current.widths).toEqual(COMPACT_COLUMN_WIDTHS);
  act(()=>{view.result.current.showColumn('effort');view.result.current.showColumn('effort');});
  expect(view.result.current.hidden).toEqual(COMPACT_HIDDEN_COLUMNS.filter(id=>id!=='effort'));
  expect(localStorage.getItem('eflow_project_columns_a')).toBe(JSON.stringify(view.result.current.hidden));
  localStorage.setItem('eflow_project_table_layout_v1_c',JSON.stringify({version:1,widths:{task:480,timeline:250}}));
  view.unmount();
  const widthsOnly=renderHook(()=>useTableLayout('c'));
  expect(widthsOnly.result.current.hidden).toEqual(COMPACT_HIDDEN_COLUMNS);expect(widthsOnly.result.current.widths).toMatchObject({task:480,timeline:250});
 });
 it('works in memory when browser storage is unavailable',()=>{
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Blocked');});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Blocked');});
  const view=renderHook(()=>useTableLayout('a'));act(()=>{view.result.current.hideColumn('effort');view.result.current.resizeColumn('task',480);});
  expect(view.result.current.hidden).toEqual(COMPACT_HIDDEN_COLUMNS);expect(view.result.current.widths.task).toBe(480);
 });
 it('supports keyboard width adjustments and announces bounds',()=>{
  const change=vi.fn();render(<ColumnResizer column="task" label="Task" width={320} onResize={change}/>);
  const resize=screen.getByRole('separator',{name:'Resize Task column'});fireEvent.keyDown(resize,{key:'ArrowRight',shiftKey:true});expect(change).toHaveBeenLastCalledWith('task',352);
  fireEvent.keyDown(resize,{key:'Home'});expect(change).toHaveBeenLastCalledWith('task',200);expect(resize.getAttribute('aria-valuemax')).toBe('640');
 });
 it('removes one filter while preserving other filters and the selected sort',()=>{
  const change=vi.fn();const filters={query:'road',owner:'person',status:'todo',office:'office',sort:'deadline' as const};
  render(<ProjectFilterChips value={filters} onChange={change} profiles={[]} offices={[]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Remove Search: road'}));expect(change).toHaveBeenLastCalledWith({...filters,query:''});
  fireEvent.click(screen.getByRole('button',{name:'Restore manual order'}));expect(change).toHaveBeenLastCalledWith({...filters,sort:'manual'});
  expect(screen.getByText(/appointed task lead/)).toBeTruthy();
 });
});
