// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkDetailsEditor} from '../../src/app/features/nested-work/components/WorkDetailsEditor';
import type {WorkEditorFields} from '../../src/app/features/nested-work/types/editor';

afterEach(cleanup);
const fields:WorkEditorFields={title:'Prepare report',start:'2026-11-20',due:'2026-12-01',priority:'medium',lead:'',people:[],parent:'',standalone:false,note:'',progress:0,order:[]};
const makeProps=(disabled=false)=>({fields,disabled,planningLocked:true,dueDisabled:true,showStart:true,update:vi.fn()});

it('keeps title and priority editable while started planning and due fields are locked',()=>{
 const props=makeProps();render(<WorkDetailsEditor {...props}/>);
 expect((screen.getByLabelText('Subtask title') as HTMLInputElement).disabled).toBe(false);
 expect((screen.getByLabelText('Priority') as HTMLSelectElement).disabled).toBe(false);
 expect((screen.getByLabelText('Subtask start date') as HTMLInputElement).disabled).toBe(true);
 expect((screen.getByLabelText('Subtask due date') as HTMLInputElement).disabled).toBe(true);
 expect((screen.getByLabelText('Work order') as HTMLSelectElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Priority'),{target:{value:'high'}});
 expect(props.update).toHaveBeenCalledWith('priority','high');
});

it('disables every editable field while the editor is pending or unauthorized',()=>{
 render(<WorkDetailsEditor {...makeProps(true)}/>);
 for(const label of ['Subtask title','Priority','Subtask start date','Subtask due date','Work order'])expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true);
});
