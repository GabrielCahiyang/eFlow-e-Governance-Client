// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {MoneyInput} from '../../src/app/components/ui/MoneyInput';
import {calendarMinDate, getPhilippineCalendarDate, getPhilippineLocalDateTime, historicalDateError, scheduleRangeError, scheduledDateError} from '../../src/app/shared/calendarDates';
import {attachmentError} from '../../src/app/shared/fileValidation';
import {moneyInputError, parseMoneyInput} from '../../src/app/shared/moneyInput';
import {validateLoginFields} from '../../src/app/features/authentication/services/loginValidation';
import {GovernanceRecordPanel} from '../../src/app/features/interdepartment-collaboration/components/governance/GovernanceRecordPanel';
import {WorkDetailsEditor} from '../../src/app/features/nested-work/components/WorkDetailsEditor';
import {workEditorDateError} from '../../src/app/features/nested-work/selectors/editorDraft';
import type {WorkEditorBaseline, WorkEditorFields} from '../../src/app/features/nested-work/types/editor';
import type {WorkTreeSnapshot} from '../../src/app/features/nested-work/types';
import {reviewedImportPayload} from '../../src/app/features/project-import/selectors/draftValidation';
import type {ProjectImportDraft} from '../../src/app/features/project-import/types';

afterEach(()=>{cleanup();vi.useRealTimers();});
function MoneyHarness({initial='', numeric=false}:{initial?:string;numeric?:boolean}) {
 const [value,setValue]=useState<string|number>(initial);
 return <><MoneyInput aria-label="Amount" value={value} onValueChange={raw=>setValue(numeric?Number(raw):raw)}/><output data-testid="raw">{value}</output><button onClick={()=>setValue('')}>Reset</button></>;
}
describe('grouped money editing',()=>{
 it('groups millions, preserves cents and sends ungrouped values',()=>{
  render(<MoneyHarness/>);const input=screen.getByRole('spinbutton') as HTMLInputElement;
  fireEvent.change(input,{target:{value:'1000000'}});expect(input.value).toBe('1,000,000');expect(screen.getByTestId('raw')).toHaveTextContent('1000000');
  fireEvent.change(input,{target:{value:'1,000,000.50'}});expect(input.value).toBe('1,000,000.50');expect(screen.getByTestId('raw')).toHaveTextContent('1000000.50');
  fireEvent.change(input,{target:{value:''}});expect(input.value).toBe('');
  fireEvent.change(input,{target:{value:'₱ 12,345.67'}});expect(input.value).toBe('12,345.67');
  fireEvent.click(screen.getByText('Reset'));expect(input.value).toBe('');
 });
 it('allows a decimal point and trailing zeros with a numeric parent',()=>{
  render(<MoneyHarness numeric/>);const input=screen.getByRole('spinbutton') as HTMLInputElement;
  for(const value of ['1','1.','1.0','1.05']){fireEvent.change(input,{target:{value}});expect(input.value).toBe(value);}
  expect(screen.getByTestId('raw')).toHaveTextContent('1.05');
 });
 it('supports typing a leading decimal without moving the cursor before it',()=>{
  render(<MoneyHarness/>);const input=screen.getByRole('spinbutton') as HTMLInputElement;input.focus();
  fireEvent.change(input,{target:{value:'.',selectionStart:1}});
  expect(input.value).toBe('0.');expect(input.selectionStart).toBe(2);
  fireEvent.change(input,{target:{value:'0.50',selectionStart:4}});expect(input.value).toBe('0.50');
  expect(parseMoneyInput('000123.50')).toBe('123.50');
 });
 it('deletes digits across grouping commas and restores the caret',()=>{
  render(<MoneyHarness initial="1234567"/>);const input=screen.getByRole('spinbutton') as HTMLInputElement;input.focus();
  input.setSelectionRange(2,2);fireEvent.keyDown(input,{key:'Backspace'});
  expect(input.value).toBe('234,567');expect(input.selectionStart).toBe(0);
  input.setSelectionRange(3,3);fireEvent.keyDown(input,{key:'Delete'});
  expect(input.value).toBe('23,467');expect(input.selectionStart).toBe(4);
 });
 it('rejects malformed input, enforces range, and respects read-only arrows',()=>{
  const change=vi.fn();const view=render(<MoneyInput value="100" min={.01} max={1000} onValueChange={change} readOnly/>);
  fireEvent.keyDown(screen.getByRole('spinbutton'),{key:'ArrowUp'});expect(change).not.toHaveBeenCalled();
  view.rerender(<MoneyInput value="1001" min={.01} max={1000} onValueChange={change}/>);
  expect((screen.getByRole('spinbutton') as HTMLInputElement).checkValidity()).toBe(false);
  expect(parseMoneyInput('1e6')).toBeNull();expect(parseMoneyInput('-1')).toBeNull();expect(parseMoneyInput('1.234')).toBeNull();
  expect(moneyInputError('0',.01,1000)).toContain('0.01');
 });
});
describe('Manila date guardrails',()=>{
 it('uses the Philippine day across UTC midnight boundaries',()=>{
  expect(getPhilippineCalendarDate(new Date('2026-10-16T16:15:00Z'))).toBe('2026-10-17');
  expect(getPhilippineLocalDateTime(new Date('2026-10-16T16:15:00Z'))).toBe('2026-10-17T00:15');
 });
 it('allows today and unchanged history while rejecting new past or inverted dates',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-17T04:00:00Z'));
  expect(scheduledDateError('2026-10-17')).toBe('');expect(scheduledDateError('2026-10-16')).toContain('before');
  expect(scheduledDateError('2026-10-01',{original:'2026-10-01'})).toBe('');expect(calendarMinDate('2026-10-01')).toBe('2026-10-01');
  expect(scheduledDateError('2026-02-30')).toContain('valid');expect(scheduleRangeError('2026-10-20','2026-10-19')).toContain('before the start');
  expect(historicalDateError('2026-10-18')).toContain('future');expect(historicalDateError('')).toContain('required');
 });
 it('checks active nested editor bounds before sending and preserves old dates only on edit',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-17T04:00:00Z'));
  const fields={title:'Task',due:'2026-10-01',parent:''} as WorkEditorFields;
  const baseline={command:'edit',fields} as WorkEditorBaseline;
  const data={root:{due:'2026-10-25'},nodes:[]} as unknown as WorkTreeSnapshot;
  expect(workEditorDateError(data,baseline,fields)).toBe('');
  expect(workEditorDateError(data,{...baseline,command:'create'},fields)).toContain('before');
  expect(workEditorDateError(data,baseline,{...fields,due:'2026-10-26'})).toContain('after');
  render(<WorkDetailsEditor fields={fields} disabled={false} update={vi.fn()} maxDue="2026-10-25"/>);
  expect(screen.getByLabelText('Subitem due date')).toHaveAttribute('min','2026-10-17');
 });
 it('rejects past dates and parent-bound violations at import commit, beyond HTML constraints',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-17T04:00:00Z'));
  const task={key:'task',title:'Prepare',description:'',priority:'medium',estimatedHours:2,startDate:'2026-10-16',dueDate:'2026-10-20',officeKey:'',dependencies:[],subitems:[],sourceQuote:'',included:true};
  const draft={schemaVersion:1,project:{title:'Plan',description:'',objectives:'',startDate:'',targetDate:''},offices:[],groups:[{key:'group',title:'Work',color:'#ffffff',existingGroupId:'',tasks:[task]}],warnings:[]} as ProjectImportDraft;
  expect(()=>reviewedImportPayload(draft,'plan.md',false)).toThrow('before');
  task.startDate='2026-10-17';
  draft.groups[0].tasks[0].subitems=[{title:'Child',dueDate:'2026-10-21'}];
  expect(()=>reviewedImportPayload(draft,'plan.md',false)).toThrow('after');
  draft.groups[0].tasks[0].subitems[0].dueDate='2026-10-20';
  expect(reviewedImportPayload(draft,'plan.md',false).groups[0].tasks).toHaveLength(1);
 });
});
describe('attachment and recorded meeting guards',()=>{
 it('accepts supported files and rejects oversized, disguised or excess evidence',()=>{
  expect(attachmentError([new File(['x'],'proof.pdf',{type:'application/pdf'})])).toBe('');
  expect(attachmentError([new File(['x'],'proof.pdf',{type:'application/x-msdownload'})])).toContain('supported');
  expect(attachmentError([new File(['x'],'program.exe')])).toContain('supported');
  const large=new File(['x'],'photo.png',{type:'image/png'});Object.defineProperty(large,'size',{value:26*1024*1024});
  expect(attachmentError([large])).toContain('25 MB');expect(attachmentError([large],{maxMb:2})).toContain('2 MB');
  expect(attachmentError(Array.from({length:11},()=>new File(['x'],'proof.pdf')))).toContain('10');
 });
 it('blocks empty and future governance records even when the save handler is invoked',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-17T04:00:00Z'));const save=vi.fn().mockResolvedValue(undefined);
  render(<GovernanceRecordPanel records={[]} signoffs={[]} organizations={[]} profiles={[]} actingOrgId="office" busy={false} onSaveRecord={save} onOpenMinutes={vi.fn()} onDownloadPacket={vi.fn()}/>);
  const button=screen.getByRole('button',{name:/Save formal record/i});expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Resolution number'),{target:{value:'RES-1'}});
  const date=screen.getByLabelText('Meeting date');expect(date).toHaveAttribute('max','2026-10-17');
  fireEvent.change(date,{target:{value:'2026-10-18'}});fireEvent.click(button);expect(save).not.toHaveBeenCalled();
  fireEvent.change(date,{target:{value:'2026-10-17'}});fireEvent.click(button);expect(save).toHaveBeenCalledOnce();
 });
 it('allows existing short passwords through login while still requiring a value',()=>{
  expect(validateLoginFields('person@example.com','abc')).toEqual({});expect(validateLoginFields('person@example.com','').password).toBeTruthy();
 });
});
