// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {requestNavigation,installNavigationConfirmation} from '../../src/app/shared/navigationGuard';
const service=vi.hoisted(()=>({load:vi.fn(),upload:vi.fn(),command:vi.fn(),open:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'member'}})}));
vi.mock('../../src/app/features/project-files/services/projectFileService',()=>({fetchProjectFiles:service.load,uploadProjectFile:service.upload,projectFileCommand:service.command,openProjectFile:service.open}));
import {ProjectFileLibrary} from '../../src/app/features/project-files';
const file={id:'source',file_name:'Reference.pdf',uploader_name:'Author',created_at:'2026-10-01',file_size:40,linked:false,can_remove:false,links:0};
beforeEach(()=>{vi.resetAllMocks();service.load.mockResolvedValue({can_write:true,files:[file]});});
afterEach(cleanup);
describe('R6 project file interaction',()=>{
 it('guards upload drafts, prevents concurrent saves and retries the same failed draft',async()=>{
  let reject:(reason:Error)=>void=()=>{};service.upload.mockImplementationOnce(()=>new Promise((_resolve,r)=>{reject=r;})).mockResolvedValue(file);
  const uninstall=installNavigationConfirmation(vi.fn().mockResolvedValue(false));
  render(<ProjectFileLibrary projectId="p" taskId="t"/>);
  const input=await screen.findByLabelText('Upload a project document');
  fireEvent.change(input,{target:{files:[new File(['pdf'],'Plan.pdf',{type:'application/pdf'})]}});
  expect(await requestNavigation(vi.fn())).toBe(false);
  const save=screen.getByRole('button',{name:'Save document / retry'});fireEvent.click(save);fireEvent.click(save);
  expect(service.upload).toHaveBeenCalledTimes(1);expect(await requestNavigation(vi.fn())).toBe(false);
  await act(async()=>reject(new Error('Upload denied')));await screen.findByText('Upload denied');
  const retained=service.upload.mock.calls[0][2];fireEvent.click(screen.getByRole('button',{name:'Save document / retry'}));
  await screen.findByText('Document saved to the project library.');expect(service.upload.mock.calls[1][2]).toBe(retained);uninstall();
 });
 it('uses recorded source IDs for insertion and hides writes for Viewer and archived contexts',async()=>{
  service.command.mockResolvedValue(file);render(<ProjectFileLibrary projectId="p" taskId="t"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Insert from project library'}));fireEvent.click(screen.getByRole('button',{name:'Insert Reference.pdf'}));
  await waitFor(()=>expect(service.command).toHaveBeenCalledWith('p','t','link',{id:'source'}));cleanup();
  render(<ProjectFileLibrary projectId="p" taskId="t" readOnly/>);await screen.findByText('No general documents linked to this task.');expect(screen.queryByLabelText('Upload a project document')).toBeNull();
 });
 it('keeps a successful receipt after refresh fails and clears stale scope data',async()=>{
  service.load.mockResolvedValueOnce({can_write:true,files:[]}).mockRejectedValueOnce(new Error('Refresh denied'));service.upload.mockResolvedValue(file);
  const {rerender}=render(<ProjectFileLibrary projectId="p" taskId="t"/>);
  fireEvent.change(await screen.findByLabelText('Upload a project document'),{target:{files:[new File(['pdf'],'Plan.pdf',{type:'application/pdf'})]}});
  fireEvent.click(screen.getByRole('button',{name:'Save document / retry'}));await screen.findByText('Refresh denied');expect(screen.getByText('Document saved to the project library.')).toBeTruthy();expect(screen.queryByRole('button',{name:'Save document / retry'})).toBeNull();
  service.load.mockResolvedValue({can_write:false,files:[]});rerender(<ProjectFileLibrary projectId="other" taskId="other-task"/>);
  await screen.findByText('No general documents linked to this task.');expect(screen.queryByText('Document saved to the project library.')).toBeNull();
 });
});
