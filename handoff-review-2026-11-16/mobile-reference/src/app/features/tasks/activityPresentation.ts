import type { WorkEvent } from "../../../core/web/app/features/nested-work/services/workTreeService";
import type {
  WorkNode,
  WorkTreeSnapshot,
} from "../../../core/web/app/features/nested-work/types";
import { descendantIds } from "../../../core/web/app/features/nested-work/selectors/tree";
import { workEventTitle } from "../../../core/web/app/features/nested-work/selectors/workEventPresentation";
import {
  workDateLabel,
  workDay,
} from "../../../core/web/app/shared/workCalendar";
import { statusLabel } from "../../shared/statusLabels";

export type ActivityField = { label: string; value: string };
const unavailable = "Historical value unavailable";
const calendarDate = (value: string | null | undefined) =>
  value === null
    ? "No due date"
    : workDay(value, "Asia/Manila") == null
      ? unavailable
      : workDateLabel(value, "Asia/Manila");
const timestampFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
export const activityTime = (time: number) =>
  Number.isFinite(time) && time > 0
    ? timestampFormat.format(time)
    : "Time unavailable";

export function describeWorkEvent(event: WorkEvent, branchId?: string) {
  const verified = (snapshot: WorkTreeSnapshot | undefined) =>
    snapshot?.root &&
    snapshot.root.id === event.root_id &&
    typeof snapshot.root.project === "string" &&
    ["office", "personal"].includes(snapshot.root.kind) &&
    Array.isArray(snapshot.nodes)
      ? snapshot
      : undefined;
  let before = verified(event.before_data),
    after = verified(event.after_data);
  if (
    before &&
    after &&
    (before.root.project !== after.root.project ||
      before.root.office !== after.root.office ||
      before.root.kind !== after.root.kind)
  )
    before = after = undefined;
  const nodes = (snapshot?: WorkTreeSnapshot) =>
    snapshot?.nodes.filter(
      (node) =>
        node &&
        node.task_id === event.root_id &&
        typeof node.title === "string",
    ) ?? [];
  const previous = nodes(before),
    current = nodes(after);
  const old = previous.find((node) => node.id === event.node_id);
  const next = current.find((node) => node.id === event.node_id);
  const name = (
    snapshot: WorkTreeSnapshot | undefined,
    id: string | null | undefined,
  ) =>
    !snapshot || id === undefined
      ? unavailable
      : id === null
        ? "Unassigned"
        : (Array.isArray(snapshot.people)
            ? snapshot.people.find((person) => person?.id === id)?.name
            : undefined) || "Historical name unavailable";
  const contributors = (
    ids: string[] | undefined,
    lead: string | null | undefined,
  ) =>
    Array.isArray(ids)
      ? [...new Set(ids.filter((id) => id !== lead))].sort()
      : undefined;
  const list = (snapshot: WorkTreeSnapshot | undefined, ids?: string[]) =>
    !ids || !snapshot
      ? unavailable
      : ids.map((id) => name(snapshot, id)).join(", ") || "None";
  const path = (items: WorkNode[], id: string | null) => {
    if (!id) return "Root task";
    const titles: string[] = [],
      visited = new Set<string>();
    for (let cursor: string | null = id; cursor;) {
      const node = items.find((item) => item.id === cursor);
      if (!node || visited.has(cursor)) return "Historical path unavailable";
      visited.add(cursor);
      titles.unshift(node.title);
      cursor = node.parent_subtask_id;
    }
    return titles.join(" / ");
  };
  let title = workEventTitle(event.command).replace(/subitem/gi, (word) =>
    word.startsWith("S") ? "Subtask" : "subtask",
  );
  const subject = next?.title || old?.title;
  const fields: ActivityField[] = [];
  const add = (label: string, value: string) => fields.push({ label, value });
  const change = <T>(
    label: string,
    left: T,
    right: T,
    display: (value: T) => string,
  ) => {
    if (left !== right) add(label, `${display(left)} → ${display(right)}`);
  };
  const staffing = (left?: WorkNode, right?: WorkNode, root = false) => {
    const oldLead = root ? before?.root.lead : left?.lead_id;
    const nextLead = root ? after?.root.lead : right?.lead_id;
    const oldIds = contributors(
      root ? before?.root.people : left?.assigned_to_ids,
      oldLead,
    );
    const nextIds = contributors(
      root ? after?.root.people : right?.assigned_to_ids,
      nextLead,
    );
    if (oldLead !== nextLead)
      add("Lead", `${name(before, oldLead)} → ${name(after, nextLead)}`);
    if (JSON.stringify(oldIds) !== JSON.stringify(nextIds))
      add("Contributors", `${list(before, oldIds)} → ${list(after, nextIds)}`);
  };
  if (event.command === "create" && next) {
    add("Lead", name(after, next.lead_id));
    add(
      "Contributors",
      list(after, contributors(next.assigned_to_ids, next.lead_id)),
    );
    add("Due date", calendarDate(next.due_date));
    if (next.parent_subtask_id)
      add("Parent", path(current, next.parent_subtask_id));
  } else if (event.command === "delete" && old) {
    const count = descendantIds(previous, old.id).size;
    if (old.parent_subtask_id)
      add("Parent", path(previous, old.parent_subtask_id));
    add("Lead", name(before, old.lead_id));
    add(
      "Contributors",
      list(before, contributors(old.assigned_to_ids, old.lead_id)),
    );
    if (count) add("Child subtasks removed", String(count));
  } else if (
    event.command === "root_lead" ||
    event.command === "contributors" ||
    event.command === "staff"
  ) {
    staffing(old, next, !event.node_id);
    if (
      event.command === "staff" &&
      old &&
      next &&
      old.lead_id !== next.lead_id
    )
      title = next.lead_id
        ? old.lead_id
          ? "Subtask Lead replaced"
          : "Subtask Lead assigned"
        : "Subtask Lead removed";
    const descendants = old ? descendantIds(previous, old.id) : undefined;
    if (event.command !== "contributors" && (!event.node_id || descendants)) {
      for (const from of previous) {
        if (descendants && !descendants.has(from.id)) continue;
        const to = current.find((node) => node.id === from.id);
        if (to && to.lead_id !== from.lead_id)
          add(
            path(previous, from.id) + " · Lead",
            `${name(before, from.lead_id)} → ${name(after, to.lead_id)}`,
          );
      }
    }
  } else if (event.command === "order") {
    const priorBranch = branchId
      ? descendantIds(previous, branchId)
      : undefined;
    const nextBranch = branchId ? descendantIds(current, branchId) : undefined;
    for (const to of current) {
      if (
        branchId &&
        to.id !== branchId &&
        !(priorBranch?.has(to.id) && nextBranch?.has(to.id))
      )
        continue;
      const from = previous.find((node) => node.id === to.id);
      if (from && from.sibling_order !== to.sibling_order)
        add(
          path(current, to.id) + " · Position",
          `${from.sibling_order + 1} → ${to.sibling_order + 1}`,
        );
    }
  } else if (old && next) {
    change("Title", old.title, next.title, String);
    type DetailNode = WorkNode & { priority?: string; dependency_ids?: string[] | null; due_date_change_reason?: string };
    const left = old as DetailNode, right = next as DetailNode;
    change("Priority", left.priority, right.priority, value => value ? value.charAt(0).toUpperCase() + value.slice(1) : unavailable);
    change("Start date", old.start_date, next.start_date, value => value === null ? "No start date" : calendarDate(value));
    change("Due date", old.due_date, next.due_date, calendarDate);
    const prerequisiteNames = (ids: string[] | null | undefined, items: WorkNode[]) =>
      ids === undefined ? unavailable : ids === null ? "Legacy sequential prerequisites" :
        ids.map(id => items.find(item => item.id === id)?.title || "Historical prerequisite unavailable").join(", ") || "None";
    const canonicalDependencies = (ids: string[] | null | undefined) => Array.isArray(ids) ? [...new Set(ids)].sort() : ids;
    if (JSON.stringify(canonicalDependencies(left.dependency_ids)) !== JSON.stringify(canonicalDependencies(right.dependency_ids)))
      add("Prerequisites", `${prerequisiteNames(left.dependency_ids, previous)} → ${prerequisiteNames(right.dependency_ids, current)}`);
    if ((old.due_date !== next.due_date || old.start_date !== next.start_date) && right.due_date_change_reason)
      add("Schedule change reason", right.due_date_change_reason);
    change("Sequencing", old.is_standalone, next.is_standalone, (value) =>
      typeof value !== "boolean"
        ? unavailable
        : value
          ? "Independent"
          : "Sequential",
    );
    if (old.parent_subtask_id !== next.parent_subtask_id)
      add(
        "Parent",
        `${path(previous, old.parent_subtask_id)} → ${path(current, next.parent_subtask_id)}`,
      );
    staffing(old, next);
    change("Progress", old.percent_complete, next.percent_complete, (value) =>
      Number.isFinite(value) ? `${value}%` : unavailable,
    );
    change(
      "Blocker",
      old.blocker,
      next.blocker,
      (value) => value || "None recorded",
    );
    change("Status", old.status, next.status, (value) =>
      value ? statusLabel(value) : unavailable,
    );
    if (event.command === "review" && next.status === "completed")
      title = "Subtask approved";
    if (event.command === "review" && next.status === "changes_requested")
      title = "Changes requested";
  }
  if (!old && !next && (!before || !after) && !fields.length)
    add("Details", unavailable);
  return { title, subject, fields };
}
