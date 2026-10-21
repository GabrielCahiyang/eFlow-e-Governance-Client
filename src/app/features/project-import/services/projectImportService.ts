import { supabase } from '../../../../lib/supabase';
import { requestAiChat, readAiText, type AiQueueUpdate } from '../../ai';
import { notifyTaskListeners } from '../../tasks';
import { notifyProjectListeners } from '../../projects';
import { controlPanelFetch } from '../../../shared/controlPanelClient';
import { parseProjectImportDraft } from '../selectors/draftValidation';
import type { ProjectImportResult } from '../types';
import { readSourceBudget } from '../../proposal-import';
export class ProjectImportSaveError extends Error {
  constructor(message: string, readonly retrySameBatch: boolean) { super(message); }
}

export async function generateProjectDraft(projectId: string, sourceText: string, sourceName: string, onQueueUpdate: (update: AiQueueUpdate) => void) {
  if(readSourceBudget(sourceText))throw new Error('Use Import PDF beside Add people in this project to include its source budget.');
  const validation = await controlPanelFetch('proposals/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_text: sourceText, file_name: sourceName, mode: 'workspace' }) }, { requireAiOnline: true, timeoutMs: 30000 });
  const gate = await validation.json();
  if (!validation.ok || !gate.is_proposal) throw new Error(gate.detail || gate.message || 'Document validation failed.');
  const response = await requestAiChat({ messages: [{ role: 'user', content: 'Prepare a project workspace draft for human review.' }], workspace_decomposition: { schemaVersion: 1, projectId, sourceText, context: {} } }, { onQueueUpdate });
  return parseProjectImportDraft(readAiText(response), sourceText);
}

export async function importReviewedProject(projectId: string, requestId: string, review: unknown): Promise<ProjectImportResult> {
  return saveReviewedProject('phase5_import_project_work', projectId, requestId, review);
}
export async function importReviewedProjectWithOffices(projectId: string, requestId: string, review: unknown): Promise<ProjectImportResult> {
  return saveReviewedProject('phase65_import_project_work', projectId, requestId, review);
}
export async function importPdfProjectWork(projectId:string,requestId:string,review:unknown):Promise<ProjectImportResult>{
  return saveReviewedProject('import_project_pdf_work',projectId,requestId,review);
}
async function saveReviewedProject(rpcName: string, projectId: string, requestId: string, review: unknown): Promise<ProjectImportResult> {
  const { data, error } = await supabase.rpc(rpcName, { p_project_id: projectId, p_request_id: requestId, p_review: review });
  if (error) {
    const message = error.code === 'PGRST202' ? 'The reviewed import database update is not available yet. Contact your administrator.'
      : error.code === '23505' ? /eflow_unique_group_name/.test(error.message) ? 'A group with this name already exists in this project. No work was added. Use its existing group or choose a different name.'
        : /eflow_unique_(task|subitem)_name/.test(error.message) ? 'Some work already has the same name in this project. No work was added. Open the existing work or use a new project for a separate copy.'
          : 'This import conflicts with existing work. No work was added. Reopen the project and check its current tasks.'
      : error.message;
    throw new ProjectImportSaveError(message,!['22023', '42501', '23505', '23514', '23503', '22P02', '22007', '22008'].includes(error.code));
  }
  const result = data as ProjectImportResult;
  // Publishing succeeded even if a later refresh fails. Never expose a false
  // "failed import" state that encourages a fresh duplicate batch.
  await Promise.allSettled([notifyTaskListeners(), notifyProjectListeners()]);
  return result;
}
