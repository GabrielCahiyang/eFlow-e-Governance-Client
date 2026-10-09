export interface ProjectFile {
 id: string; project_id: string; project_kind: 'office'|'personal';
 uploader_id: string; uploader_name: string; initial_task_id: string|null;
 file_name: string; file_size: number; mime_type: string; sha256: string;
 object_path: string; state: 'pending'|'ready'|'removed'; created_at: string;
 committed_at: string|null; linked?: boolean; links?: number; can_remove?: boolean;
 link?: {linked_by:string;linked_at:string}|null;
}
export interface ProjectFileSnapshot {can_write:boolean;files:ProjectFile[]}
export interface ProjectUploadDraft {id:string;file:File;sha256?:string}
export interface ProjectFileEvent {id:string;actorName:string;action:'uploaded'|'linked'|'unlinked'|'removed';at:number}
