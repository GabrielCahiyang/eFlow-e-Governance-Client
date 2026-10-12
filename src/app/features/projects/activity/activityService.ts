import { supabase } from "../../../../lib/supabase";
import type { ActivityFilters, ActivityPage } from "./types";
import { activityDateBound } from "./activityDates";
import {isWorkEventRecord,presentWorkEvent,workEventTitle} from '../../nested-work';

export async function fetchActivityPage(
  project: string,
  filters: ActivityFilters,
  size = 25,
  page = 0,
  snapshot?: string,
): Promise<ActivityPage> {
  const timezone =
    filters.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await supabase.rpc("r11_project_activity", {
    p_project: project,
    p_snapshot: snapshot || null,
    p_page: page,
    p_size: size,
    p_kind: filters.kind,
    p_search: filters.search,
    p_from: activityDateBound(filters.from, timezone),
    p_to: activityDateBound(filters.to, timezone, true),
  });
  if (error)
    throw new Error(
      error.code === "PGRST202"
        ? "Complete Activity history is not installed on this server. Apply the reviewed R11 migration before acceptance."
        : error.message,
    );
  if (
    !data ||
    typeof data.snapshot !== "string" ||
    !Number.isInteger(data.total) ||
    data.total < 0 ||
    !Number.isInteger(data.page) ||
    data.page < 0 ||
    data.size !== size ||
    typeof data.more !== "boolean" ||
    !Array.isArray(data.events) ||
    !Number.isFinite(Date.parse(data.asOf)) ||
    !Number.isFinite(Date.parse(data.expiresAt))
  )
    throw new Error("Activity completeness could not be verified.");
  if (snapshot && data.snapshot !== snapshot)
    throw new Error("History snapshot changed. Refresh history.");
  const events = data.events.map((row: Record<string, unknown>) => {
    if (
      typeof row.event_id !== "string" ||
      !["project", "status", "progress", "submission"].includes(
        String(row.kind),
      ) ||
      !Number.isFinite(Date.parse(String(row.occurred_at)))
    )
      throw new Error("Invalid history event received.");
    let title=String(row.title||''),detail=String(row.detail||'');
    if(row.event_id.startsWith('work:')){
      if(row.work_event!==undefined&&row.work_event!==null){
        const work=row.work_event;
        if(!isWorkEventRecord(work)||row.event_id!==`work:${work.id}`||row.task_id!==work.root_id||row.actor_name!==work.actor_name||Date.parse(String(row.occurred_at))!==Date.parse(work.occurred_at)
          ||[work.before_data,work.after_data].some(snapshot=>snapshot?.root&&snapshot.root.project!==project))throw new Error('Invalid historical work context received.');
        const presentation=presentWorkEvent(work);title=presentation.title;detail=presentation.detail;
      }else{
        // Older installations/frozen snapshots retain their original rows, but
        // cannot establish former paths or people. Never fetch current context.
        title=workEventTitle(title.replace(/ /g,'_'));
        detail=[detail,'Historical changed fields unavailable'].filter(Boolean).join(' · ');
      }
    }else if(row.work_event!==undefined&&row.work_event!==null)throw new Error('Invalid historical work context received.');
    return {
      id: row.event_id,
      kind: row.kind,
      title,
      detail,
      actorName: String(row.actor_name || "System"),
      occurredAt: Date.parse(String(row.occurred_at)),
      taskId: row.task_id ? String(row.task_id) : undefined,
    };
  });
  if (
    events.length !==
      Math.min(size, Math.max(0, data.total - data.page * size)) ||
    new Set(events.map((e: { id: string }) => e.id)).size !== events.length ||
    data.more !== (data.page + 1) * size < data.total
  )
    throw new Error("Activity page is incomplete. Retry history.");
  return { ...data, events } as ActivityPage;
}

/** Revalidate even the visible page, and publish no partial print document. */
export async function fetchActivityPrint(
  project: string,
  filters: ActivityFilters,
  current: ActivityPage,
  scope: "all" | "page",
  progress?: (loaded: number, total: number) => void,
): Promise<ActivityPage["events"]> {
  const rows: ActivityPage["events"] = [],
    seen = new Set<string>();
  const pages =
    scope === "page"
      ? [current.page]
      : Array.from(
          { length: Math.max(1, Math.ceil(current.total / current.size)) },
          (_, i) => i,
        );
  for (const page of pages) {
    const next = await fetchActivityPage(
      project,
      filters,
      current.size,
      page,
      current.snapshot,
    );
    if (
      next.snapshot !== current.snapshot ||
      next.total !== current.total ||
      next.page !== page
    )
      throw new Error(
        "History changed while preparing print. Refresh history.",
      );
    for (const event of next.events) {
      if (seen.has(event.id))
        throw new Error("Duplicate history event. Print preparation stopped.");
      seen.add(event.id);
      rows.push(event);
    }
    progress?.(
      rows.length,
      scope === "page" ? current.events.length : current.total,
    );
  }
  const count = scope === "all" ? current.total : current.events.length;
  if (rows.length !== count)
    throw new Error(
      `Incomplete print: ${rows.length} of ${count} events. Retry history.`,
    );
  return rows;
}
