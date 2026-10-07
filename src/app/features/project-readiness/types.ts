export type ReviewKind = 'structure' | 'dates' | 'budget';
export interface ReadinessCheck { key: string; label: string; ok: boolean; detail: string }
export interface ProjectReadiness { projectId: string; checks: ReadinessCheck[]; ready: boolean; canActivate: boolean; canPublish?: boolean; stage: string; governed: boolean }
export interface CloseoutSummary { tasks: number; completed: number; cancelled: number; budgetEstimate: number; offices: number; evidence: number; contributors: number; startDate: string | null; targetDate: string | null; financial: {requested: number; approved: number; settled: number; open: number} }
