import type { Task } from '../tasks';
export interface ProjectGroup { id: string; projectId: string; title: string; color: string; position: number; isDefault: boolean }
export type ProjectColumn = 'office' | 'owner' | 'status' | 'priority' | 'timeline' | 'effort' | 'dependencies' | 'budget' | 'progress';
export interface WorkspaceTaskPatch {
 title?: string; priority?: Task['priority']; deadline?: string; start_date?: string | null;
 estimated_hours?: number; budget_impact?: number; dependency_ids?: string[];
 group_id?: string; workspace_position?: number;
}
export const PROJECT_COLUMNS: {id: ProjectColumn; label: string}[] = [
 {id:'office',label:'Office'}, {id:'owner',label:'Owner'}, {id:'status',label:'Status'},
 {id:'timeline',label:'Due date'}, {id:'priority',label:'Priority'},
 {id:'effort',label:'Estimated hours'}, {id:'dependencies',label:'Dependencies'},
 {id:'budget',label:'Budget estimate'}, {id:'progress',label:'Progress'},
];
