export interface ProposedOffice {
  key: string; name: string; evidence: string; officeId: string; confirmed: boolean;
}
export interface ImportSubitem { title: string; dueDate: string }
export interface ImportTask {
  key: string; title: string; description: string; priority: 'low' | 'medium' | 'high';
  estimatedHours: number; startDate: string; dueDate: string; officeKey: string;
  dependencies: string[]; subitems: ImportSubitem[]; sourceQuote: string;
  included: boolean; advisory?: Record<string, unknown>;
}
export interface ImportGroup {
  key: string; title: string; color: string; existingGroupId: string; tasks: ImportTask[];
}
export interface ImportProjectDetails { title: string; description: string; objectives: string; startDate: string; targetDate: string }
export interface ProjectImportDraft {
  schemaVersion: 1; project: ImportProjectDetails; offices: ProposedOffice[]; groups: ImportGroup[];
  warnings: string[]; pipeline?: Record<string, unknown>;
}
export interface ProjectImportResult { taskCount: number; subitemCount: number; groupCount: number; taskIds: Record<string, string>; groupIds: string[] }
