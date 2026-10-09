import {
  buildReportHtml,
  type ReportColumn,
} from "../../../services/reportService";
import type { ProjectActivityItem } from "../components/project-command/types";
import type { ActivityFilters, ActivityPage } from "./types";
export function formatActivityTime(time: number, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "long",
  }).format(time);
}
export function buildActivityPrint(
  events: ProjectActivityItem[],
  project: string,
  workspace: string,
  timezone: string,
  filters: ActivityFilters,
  page: ActivityPage,
  scope: "all" | "page",
) {
  const columns: ReportColumn<ProjectActivityItem>[] = [
    {
      key: "time",
      header: `Occurred (${timezone})`,
      value: (e) => formatActivityTime(e.occurredAt, timezone),
    },
    { key: "type", header: "Type", value: (e) => e.kind },
    { key: "actor", header: "Actor", value: (e) => e.actorName || "System" },
    { key: "event", header: "Event", value: (e) => e.title },
    { key: "detail", header: "Detail", value: (e) => e.detail },
    { key: "id", header: "Source event", value: (e) => e.id },
  ];
  return buildReportHtml(events, columns, {
    timezone,
    title: `${project} · Activity`,
    subtitle: workspace,
    filters: {
      Scope:
        scope === "all"
          ? "All matching authorized events"
          : `Current page ${page.page + 1}`,
      Type: filters.kind,
      Search: filters.search || "None",
      From: filters.from || "Beginning",
      To: filters.to || "Present",
      Timezone: timezone,
      Snapshot: formatActivityTime(Date.parse(page.asOf), timezone),
    },
    totals: { "Printed events": events.length, "Matching events": page.total },
  });
}
