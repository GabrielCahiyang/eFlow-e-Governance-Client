import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, SearchCheck, ShieldCheck, UsersRound } from "lucide-react";
import { useTasks } from "../../../hooks/useFirebaseData";
import { useProfiles, useProjectsData } from "../../../hooks/useSupabaseData";
import { Card, LoadingState, PageHeader, SearchInput, SectionEmpty, StatCard, WSelect } from "../../../components/workflow/primitives";
import { subscribeToAuditEvents, type AuditEvent } from "../../../services/auditService";
import { auditActionTone, humanizeAuditAction, humanizeEntityType, shortenIdentifier } from "../presentation";
import { AuditDetailDrawer } from "./AuditDetailDrawer";
import { AuditEventFeed } from "./AuditEventFeed";

export function AdminAuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const { tasks } = useTasks();
  const { projects } = useProjectsData();
  const { profiles } = useProfiles();

  useEffect(() => subscribeToAuditEvents((nextEvents) => {
    setEvents(nextEvents);
    setLoading(false);
  }, { limit: 500 }), []);

  const entityTypes = useMemo(() => Array.from(new Set(events.map((event) => event.entityType))).sort(), [events]);
  const actions = useMemo(() => Array.from(new Set(events.map((event) => event.action))).sort(), [events]);
  const taskNames = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.title])), [projects]);
  const profileNames = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.full_name])), [profiles]);

  const entityLabel = (event: AuditEvent): string => {
    const type = event.entityType.toLowerCase().replace(/s$/, "");
    const knownName = type === "task"
      ? taskNames.get(event.entityId || "")
      : type === "project"
        ? projectNames.get(event.entityId || "")
        : ["profile", "user", "employee"].includes(type)
          ? profileNames.get(event.entityId || "")
          : undefined;
    if (knownName) return knownName;
    return event.entityId ? `${humanizeEntityType(event.entityType)} · ${shortenIdentifier(event.entityId)}` : humanizeEntityType(event.entityType);
  };

  const filtered = useMemo(() => {
    let rows = events;
    if (entityType !== "all") rows = rows.filter((event) => event.entityType === entityType);
    if (action !== "all") rows = rows.filter((event) => event.action === action);
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      rows = rows.filter((event) => [
        event.actorName,
        event.action,
        humanizeAuditAction(event.action),
        event.entityId,
        event.reason,
        entityLabel(event),
      ].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery)));
    }
    return rows;
  }, [action, entityType, events, profileNames, projectNames, query, taskNames]);

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);
  const metrics = useMemo(() => ({
    today: events.filter((event) => event.createdAt >= todayStart).length,
    actors: new Set(events.map((event) => event.actorId || event.actorName)).size,
    attention: events.filter((event) => ["bad", "warn"].includes(auditActionTone(event.action))).length,
  }), [events, todayStart]);

  if (loading) return <div className="p-8"><LoadingState label="Loading audit trail…" /></div>;

  return (
    <div className="min-h-full bg-neutral-50 p-6 sm:p-8">
      <PageHeader
        eyebrow="Administration · Accounts"
        title="Account Audit"
        subtitle="Review account corrections, access changes, office assignments, and their recorded reasons."
        actions={<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10.5px] font-medium text-emerald-700"><ShieldCheck size={13} /> Tamper-resistant history</span>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Recorded events" value={events.length} hint="Latest 500 records" icon={<Activity size={15} />} />
        <StatCard label="Today" value={metrics.today} hint="Since midnight" tone="info" icon={<CalendarDays size={15} />} />
        <StatCard label="People represented" value={metrics.actors} hint="Actors in this view" icon={<UsersRound size={15} />} />
        <StatCard label="Attention events" value={metrics.attention} hint="Review, revision, or exception" tone={metrics.attention ? "warn" : "good"} icon={<SearchCheck size={15} />} />
      </div>

      <Card className="mb-4 shadow-sm" bodyClassName="p-3.5">
        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_13rem_13rem_auto]">
          <SearchInput value={query} onChange={setQuery} placeholder="Search person, event, record, or note…" className="w-full" />
          <WSelect ariaLabel="Filter audit events by record type" className="!w-full" value={entityType} onChange={setEntityType} options={[{ value: "all", label: "All record types" }, ...entityTypes.map((type) => ({ value: type, label: humanizeEntityType(type) }))]} />
          <WSelect ariaLabel="Filter audit events by event type" className="!w-full" value={action} onChange={setAction} options={[{ value: "all", label: "All event types" }, ...actions.map((eventAction) => ({ value: eventAction, label: humanizeAuditAction(eventAction) }))]} />
          <span className="justify-self-start text-[10.5px] text-neutral-500 lg:justify-self-end">{filtered.length} matching events</span>
        </div>
      </Card>

      {filtered.length ? (
        <AuditEventFeed events={filtered} entityLabel={entityLabel} onSelect={setSelected} />
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white"><SectionEmpty icon={<ShieldCheck size={30} />} title="No audit events match" description={events.length ? "Adjust the person, event, record, or note filters." : "System activity will appear here as work moves through eFlow."} /></div>
      )}

      {selected && <AuditDetailDrawer event={selected} entityLabel={entityLabel(selected)} onClose={() => setSelected(null)} />}
    </div>
  );
}
