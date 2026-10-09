import type { Task } from "../tasks";
import type { Subtask } from "../subtasks";
import type { WorkNode, WorkTreeSnapshot } from "../nested-work";
import type {
  PersonalSnapshot,
  PersonalTask,
  Workspace,
  WorkspaceProject,
} from "../workspaces";
export const workDestinations = [
  "Assigned work",
  "Leading",
  "Subtasks",
  "History",
] as const;
export type WorkDestination = (typeof workDestinations)[number];
export const dateFilters = [
  "All my work",
  "Today",
  "This week",
  "Overdue",
] as const;
export type WorkDateFilter = (typeof dateFilters)[number];
export interface WorkRow {
  key: string;
  id: string;
  rootId: string;
  title: string;
  rootTitle?: string;
  kind: "office-task" | "office-node" | "personal-task" | "personal-node";
  projectId?: string;
  projectTitle: string;
  workspaceId?: string;
  workspaceName: string;
  officeName?: string;
  timezone: string;
  status: string;
  due?: string | null;
  progress: number;
  updatedAt?: number;
  mine: boolean;
  leading: boolean;
  actionable: boolean;
  history: boolean;
  relation: string;
  task?: Task;
  subtask?: Subtask;
  node?: WorkNode;
  tree?: WorkTreeSnapshot;
  personalTask?: PersonalTask;
  personal?: PersonalSnapshot;
}
export interface WorkProject extends WorkspaceProject {
  workspace_name: string;
  timezone: string;
}
export interface WorkSnapshot {
  rows: WorkRow[];
  projects: WorkProject[];
  workspaces: Workspace[];
  issues: string[];
  unavailable: string[];
  loadedAt: number;
}
export interface WorkScope {
  workspace: Workspace;
  projectIds?: string[];
}
