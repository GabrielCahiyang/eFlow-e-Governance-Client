// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({flow:{} as any}));
vi.mock('../../src/app/features/project-import/hooks/usePdfImportSession',()=>({usePdfImportSession:()=>api.flow}));
import {ProjectPdfImportPanel} from '../../src/app/features/project-import/components/ProjectPdfImportPanel';
beforeEach(()=>{api.flow={session:null,busy:false,loading:false,error:'',message:'',result:null,upload:vi.fn(),resume:vi.fn(),discard:vi.fn(),confirmOffices:vi.fn()};});
afterEach(cleanup);
const show=(close=vi.fn())=>{render(<ProjectPdfImportPanel projectId="p" projectTitle="Project" onClose={close} onImported={vi.fn()}/>);return close;};
describe('PDF import modal',()=>{
 it('shows only the success receipt when a stale session error exists',()=>{
  api.flow.error='Import session is no longer available';api.flow.result={taskCount:10,groupCount:8,taskIds:{},groupIds:[],assignedTaskCount:10};
  show();expect(screen.getByText('Your project table is ready')).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull();
 });
 it('offers optional offices and sends the choices with the uploaded PDF',()=>{
  show();expect(screen.getByRole('dialog',{name:'Import PDF into Project'})).toBeTruthy();
  const offices=screen.getByRole('checkbox',{name:/Add offices/}) as HTMLInputElement;
  expect(offices.checked).toBe(false);
  fireEvent.click(offices);
  const file=new File(['pdf'],'proposal.pdf',{type:'application/pdf'});
  fireEvent.change(screen.getByLabelText('Import project PDF'),{target:{files:[file]}});
  expect(api.flow.upload).toHaveBeenCalledWith(file,expect.any(String),true,true);
 });
 it('keeps the dialog open during processing and disables the footer close',()=>{
  api.flow.busy=true;api.flow.message='Choosing people for task 1';
  api.flow.session={state:{sourceName:'proposal.pdf',stage:'staffing',events:['Reading your PDF','Choosing people for task 1']}};
  const close=show();
  const button=screen.getByRole('button',{name:'Close',exact:true});
  expect(button.getAttribute('aria-disabled')).toBe('true');fireEvent.click(button);expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(document,{key:'Escape'});expect(close).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Import activity').textContent).toContain('Reading your PDF');
 });
 it('offers resume instead of a new upload for saved work',()=>{
  api.flow.session={state:{sourceName:'proposal.pdf',sourceText:'text',stage:'staffing',events:['Found 8 groups and 10 tasks']}};
  show();fireEvent.click(screen.getByRole('button',{name:/Resume import/}));
  expect(api.flow.resume).toHaveBeenCalledOnce();expect(screen.queryByLabelText('Import project PDF')).toBeNull();
 });
 it('shows an existing import without claiming new assignments',()=>{
  api.flow.result={alreadyImported:true,existingTaskCount:10,taskCount:0,groupCount:0,subitemCount:0,taskIds:{},groupIds:[]};
  show();expect(screen.getByText(/10 existing tasks were kept/)).toBeTruthy();expect(screen.queryByRole('button',{name:/Resume import/})).toBeNull();
 });
 it('shows completion counts and unlocks closing after a failure',()=>{
  api.flow.error='AI service unavailable';const close=show();
  expect(screen.getByRole('alert').textContent).toContain('saved import is kept');
  fireEvent.click(screen.getByRole('button',{name:'Close',exact:true}));expect(close).toHaveBeenCalledOnce();
 });
});
