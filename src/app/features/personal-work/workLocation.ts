import { dateFilters, type WorkDateFilter } from "./types";
/** Old bucket bookmarks retain their filter when the sidebar moves to four destinations. */
export function readWorkFilters(search = window.location.search) {
  const params = new URLSearchParams(search),
    legacy = params.get("page") || "";
  const aliases: Record<string, WorkDateFilter> = {
    "Due today": "Today",
    "Due this week": "This week",
    Overdue: "Overdue",
  };
  return {
    date: dateFilters.includes(params.get("date") as WorkDateFilter)
      ? (params.get("date") as WorkDateFilter)
      : aliases[legacy] || ("All my work" as WorkDateFilter),
    query: params.get("q") || "",
    workspace: params.get("workScope") || "",
    recent: params.has("recent")
      ? params.get("recent") === "1"
      : legacy === "Recently completed",
  };
}
