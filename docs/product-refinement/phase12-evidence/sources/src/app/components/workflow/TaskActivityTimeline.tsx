// ─── TaskActivityTimeline ────────────────────────────────────────
// Merges immutable system events (status history) with structured progress
// updates into one chronological, differently-styled stream. System events use
// a muted rail + icon; progress updates get a richer card.

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Send,
  RotateCcw,
  XCircle,
  Flag,
  Gauge,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import {
  subscribeToProgressUpdates,
  type ProgressUpdate,
} from "../../services/taskDiscussionService";
import { InitialsAvatar } from "./StatusBadges";

interface SystemEvent {
  id: string;
  fromStatus?: string;
  toStatus: string;
  actorName: string;
  note?: string;
  at: number;
}

type TimelineItem =
  | { kind: "system"; at: number; data: SystemEvent }
  | { kind: "progress"; at: number; data: ProgressUpdate };

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending_assignment: <Circle size={13} />,
  todo: <Flag size={13} />,
  in_progress: <RotateCcw size={13} />,
  for_review: <Send size={13} />,
  completed: <CheckCircle2 size={13} />,
  rejected: <XCircle size={13} />,
  archived: <Archive size={13} />,
};

const STATUS_LABEL: Record<string, string> = {
  pending_assignment: "moved to Unassigned",
  todo: "moved to To Do",
  in_progress: "moved to In Progress",
  for_review: "submitted for review",
  completed: "approved & completed",
  archived: "archived the task",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function TaskActivityTimeline({ taskId }: { taskId: string }) {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setEvents([]); setProgress([]); setLoading(true); setLoadError('');
    const loadHistory = async () => {
      const { data, error } = await supabase
        .from("task_status_history")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) { setLoadError(error.message); setLoading(false); return; }
      setLoadError('');
      setEvents(
        (data || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          fromStatus: (r.from_status as string) || undefined,
          toStatus: (r.to_status as string) || "",
          actorName: (r.actor_name as string) || "System",
          note: (r.note as string) || undefined,
          at: new Date((r.created_at as string) || Date.now()).getTime(),
        })),
      );
      setLoading(false);
    };
    loadHistory();

    const channel = supabase
      .channel(`history-${taskId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_status_history", filter: `task_id=eq.${taskId}` },
        () => loadHistory(),
      )
      .subscribe();

    const unsubProgress = subscribeToProgressUpdates(taskId, (p) => { if (active) setProgress(p); });

    return () => {
      active = false;
      supabase.removeChannel(channel);
      unsubProgress();
    };
  }, [taskId, retry]);

  const items: TimelineItem[] = [
    ...events.map((e) => ({ kind: "system" as const, at: e.at, data: e })),
    ...progress.map((p) => ({ kind: "progress" as const, at: p.createdAt, data: p })),
  ].sort((a, b) => b.at - a.at);

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-neutral-100" />
            <div className="flex-1 h-10 bg-neutral-50 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (loadError) return <div role="alert"><p>{loadError}</p><button onClick={() => setRetry(value => value + 1)}>Retry activity</button></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-[12px] font-normal text-neutral-400">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="relative pl-1">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-neutral-100" />
      <div className="space-y-3">
        {items.map((item) =>
          item.kind === "system" ? (
            <div key={`s-${item.data.id}`} className="relative flex gap-3">
              <div className="relative z-10 w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-500 shrink-0">
                {STATUS_ICON[item.data.toStatus] || <Circle size={13} />}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="text-[12px] font-normal text-neutral-700">
                  <span className="font-medium text-neutral-900">{item.data.actorName}</span>{" "}
                  {STATUS_LABEL[item.data.toStatus] || `moved to ${item.data.toStatus}`}
                </div>
                {item.data.note && (
                  <div className="text-[11.5px] font-normal text-neutral-500 mt-0.5 bg-neutral-50 border border-neutral-100 rounded-md px-2 py-1">
                    “{item.data.note}”
                  </div>
                )}
                <div className="text-[10.5px] text-neutral-400 mt-0.5">
                  {timeAgo(item.data.at)}
                </div>
              </div>
            </div>
          ) : (
            <div key={`p-${item.data.id}`} className="relative flex gap-3">
              <div className="relative z-10 w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Gauge size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-white border border-neutral-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <InitialsAvatar name={item.data.authorName} size={18} />
                    <span className="text-[12px] font-medium text-neutral-900">
                      {item.data.authorName}
                    </span>
                    <span className="text-[10.5px] text-neutral-400">posted a progress update</span>
                    {item.data.percentComplete != null && (
                      <span className="ml-auto text-[11px] font-semibold text-blue-700 tabular-nums">
                        {item.data.percentComplete}%
                      </span>
                    )}
                  </div>
                  {item.data.blocker && (
                    <div className="flex items-start gap-1.5 text-[11.5px] font-normal text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mb-1">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>
                        <b className="font-medium">{item.data.blockerCategory || "Blocker"}:</b>{" "}
                        {item.data.blocker}
                      </span>
                    </div>
                  )}
                  {item.data.nextStep && (
                    <div className="text-[11.5px] font-normal text-neutral-600">
                      <b className="font-medium text-neutral-700">Next:</b> {item.data.nextStep}
                    </div>
                  )}
                  {item.data.note && (
                    <div className="text-[11.5px] font-normal text-neutral-500 mt-0.5">
                      {item.data.note}
                    </div>
                  )}
                </div>
                <div className="text-[10.5px] text-neutral-400 mt-0.5">
                  {timeAgo(item.data.createdAt)}
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
