import type { ProjectActivityItem } from "../components/project-command/types";
export interface ActivityFilters {
  timezone?: string;
  kind: "all" | ProjectActivityItem["kind"];
  search: string;
  from: string;
  to: string;
}
export interface ActivityPage {
  snapshot: string;
  asOf: string;
  expiresAt: string;
  page: number;
  size: number;
  total: number;
  more: boolean;
  events: ProjectActivityItem[];
}
export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  kind: "all",
  search: "",
  from: "",
  to: "",
};
