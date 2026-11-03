// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({upload:vi.fn(),remove:vi.fn(),rpc:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,storage:{from:()=>({upload:api.upload,remove:api.remove})}}}));
import {saveSubtaskWorkUpdate} from '../../src/app/features/subtasks/services/subtaskWorkflowService';
beforeEach(()=>{vi.resetAllMocks();api.upload.mockResolvedValue({error:null});api.rpc.mockResolvedValue({error:null});api.remove.mockResolvedValue({error:null});});
it('uploads ordinary work updates under the progress path accepted by evidence policies',async()=>{
 const attachment=new File(['test'],'report.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
 await saveSubtaskWorkUpdate({subtaskId:'subtask',state:'in_progress',note:'Ready',attachment});
 const path=api.upload.mock.calls[0][0];expect(path).toMatch(/^subtasks\/subtask\/progress\/\d+-report.docx$/);
 expect(api.rpc).toHaveBeenCalledWith('save_subtask_work_update',expect.objectContaining({p_subtask_id:'subtask',p_attachment_path:path,p_note:'Ready'}));
});
it('does not write a work update when the attachment is denied',async()=>{
 api.upload.mockResolvedValue({error:{message:'Upload denied'}});await expect(saveSubtaskWorkUpdate({subtaskId:'subtask',state:'in_progress',attachment:new File(['x'],'proof.pdf',{type:'application/pdf'})})).rejects.toThrow('Upload denied');expect(api.rpc).not.toHaveBeenCalled();
});
