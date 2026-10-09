export interface Workspace {
  id: string;
  name: string;
  kind: 'office' | 'personal';
  office_id: string | null;
  owner_id: string | null;
  owner_name?: string;
  timezone: string;
  state: 'active' | 'ended';
}
export interface WorkspaceProject {
  id: string; title: string; status: string; kind: 'office' | 'personal';
  home_workspace_id: string | null; shortcut?: boolean;
}
export interface WorkspaceSnapshot { workspace: Workspace; projects: WorkspaceProject[] }
export interface PersonalProject {
  id: string; workspace_id: string; title: string; status: 'active' | 'completed' | 'archived'; revision: number;
}
export interface PersonalTask {
  id: string; project_id: string; title: string; lead_id: string | null; reviewer_id: string | null;
  status: 'todo' | 'in_progress' | 'submitted' | 'done'; progress: number;
  note: string; review_note: string; revision: number;
}
export interface PersonalMember { user_id: string; name: string; access: 'viewer' | 'member'; state: 'active' | 'ended' | 'revoked'; eligible: boolean }
export interface PersonalSnapshot { project: PersonalProject; owner: string; tasks: PersonalTask[]; members: PersonalMember[]; shortcuts: string[] }
export type PersonalCommand = 'set_member' | 'create_task' | 'staff_task' | 'progress_task' | 'submit_task' | 'review_task' | 'complete_project' | 'archive_project' | 'shortcut';
