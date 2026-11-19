export type WorkflowStageName =
  | "Planning & Setup"
  | "Budget & Funding"
  | "Task Execution"
  | "Work Review & Approval"
  | "Cash Advance & Liquidation"
  | "Project Closure";

export interface ProcessMiningFilters {
  projectId: string;
  includeCompleted: boolean;
  fromDate: string;
  toDate: string;
}

export interface ProcessMiningProgressStep {
  stage: string;
  message: string;
}

export interface ProcessMiningProgress {
  stage: string;
  message: string;
  current?: number | null;
  total?: number | null;
  updated_at?: number;
  history: ProcessMiningProgressStep[];
}

export interface ProcessMiningJobSnapshot {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  position?: number | null;
  jobs_ahead?: number;
  queue_depth?: number;
  progress?: ProcessMiningProgress | null;
  result?: ProcessMiningReport | null;
  error?: string | null;
}

export interface ProcessMiningSummary {
  projectsAnalyzed: number;
  totalEvents: number;
  totalTasks: number;
  totalCashRequests: number;
  variantCount: number;
  bottleneckCount: number;
  reworkLoops: number;
  deviationCount: number;
  conformanceRate: number;
  avgProjectCycleDays: number | null;
  longestWaitStage: {
    stage: string;
    label: string;
    medianHours: number;
    maxHours: number;
    meanHours: number;
  } | null;
  generatedAt: string;
}

export interface DfgNode {
  id: string;
  label: string;
  stage: string;
  eventCount: number;
  projectCount: number;
  reworkCount: number;
  medianWaitHours: number;
  maxWaitHours: number;
  activeWaitingCount: number;
  isBottleneck: boolean;
}

export interface DfgEdge {
  id: string;
  source: string;
  target: string;
  count: number;
  projectCount: number;
  medianHours: number;
  meanHours: number;
  p90Hours: number;
  maxHours: number;
  kind: "normal" | "bottleneck" | "rework";
}

export interface ActivityEdge {
  fromActivity: string;
  toActivity: string;
  stageFrom: string;
  stageTo: string;
  count: number;
  medianHours: number;
  p90Hours: number;
  maxHours: number;
  isRework: boolean;
  isBottleneck: boolean;
}

export interface StageBreakdownItem {
  stage: string;
  eventCount: number;
  projectCount: number;
  transitionSamples: number;
  activeWaitingCount: number;
  medianWaitHours: number;
  meanWaitHours: number;
  p90WaitHours: number;
  maxWaitHours: number;
  totalWaitHours: number;
  reworkCount: number;
  isBottleneck: boolean;
}

export interface WorkflowVariantProject {
  id: string;
  title: string;
  status: string;
  reworkLoops: number;
  conformanceRate: number;
}

export interface WorkflowVariant {
  variantId: string;
  stages: string[];
  projectCount: number;
  sharePercent: number;
  avgCycleDays: number;
  medianCycleDays: number;
  reworkProjectCount: number;
  projects: WorkflowVariantProject[];
}

export interface ProjectProcessSummary {
  projectId: string;
  title: string;
  status: string;
  startDate?: string | null;
  targetDate?: string | null;
  completedAt?: string | null;
  eventCount: number;
  taskCount: number;
  completedTasks: number;
  budgetAllocated: number;
  cashSpent: number;
  cycleDays: number;
  reworkLoops: number;
  deviationCount: number;
  conformanceRate: number;
  topBottleneckStage?: string | null;
  longestWaitHours: number;
  variantId?: string;
  tracePreview: string[];
}

export interface ReworkDeviationItem {
  id: string;
  category: "rework" | "deviation";
  kind: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  projectId: string;
  projectTitle: string;
  taskId?: string | null;
  taskTitle?: string | null;
  entityType: string;
  entityId: string;
  count: number;
  durationHours?: number | null;
  occurredAt?: string | null;
}

export interface ProcessRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  stage: string;
  title: string;
  finding: string;
  recommendation: string;
  metricLabel: string;
  metricValue: string;
  affectedProjects: Array<{ id: string; title: string }>;
  affectedTaskIds: string[];
  affectedTasks?: Array<{ id: string; title: string }>;
}

export interface SavedProcessMiningSnapshot {
  report: ProcessMiningReport;
  savedAt: string;
  savedByName?: string | null;
}

export interface ProcessEventItem {
  id: string;
  projectId: string;
  projectTitle: string;
  activity: string;
  stage: string;
  timestamp: number;
  isoTime: string;
  actorName: string;
  entityType: string;
  entityId: string;
  taskId?: string | null;
  taskTitle?: string | null;
  outcome: string;
  isRework: boolean;
  isDeviation: boolean;
  detail: string;
}

export interface ProcessMiningReport {
  scope: {
    projectId?: string | null;
    includeCompleted: boolean;
    fromMs?: number | null;
    toMs?: number | null;
  };
  summary: ProcessMiningSummary;
  dfg: {
    nodes: DfgNode[];
    edges: DfgEdge[];
    activityEdges: ActivityEdge[];
  };
  stageBreakdown: StageBreakdownItem[];
  variants: WorkflowVariant[];
  projects: ProjectProcessSummary[];
  reworkAndDeviations: ReworkDeviationItem[];
  recommendations: ProcessRecommendation[];
  recentEvents: ProcessEventItem[];
}
