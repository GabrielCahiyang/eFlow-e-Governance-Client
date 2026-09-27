import { useState } from "react";
import { Checkbox, CheckboxCheckedFilled, CheckmarkOutline, ChevronDown, ChevronRight, EventSchedule, ListChecked, Pause, StopFilled, Warning } from "@carbon/icons-react";
import { FeatureDialog } from "../../../../components/ui/FeatureDialog";

export interface BroadcastEvent {
  id: number;
  itemId: number;
  itemTitle: string;
  itemRef?: string;
  action: "broadcast" | "paused" | "resumed" | "concluded" | "suspended" | "session_resumed" | "adjourned" | "undo_adjourn";
  timestamp: string;
}

export function getCurrentTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export const actionStyles: Record<BroadcastEvent["action"], { color: string; bg: string; border: string; icon: string; label: string }> = {
  broadcast: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: "📡", label: "Broadcast" },
  paused: { color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", icon: "⏸", label: "Paused" },
  resumed: { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: "▶️", label: "Resumed" },
  concluded: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: "✓", label: "Concluded" },
  suspended: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: "⏸", label: "Session Suspended" },
  session_resumed: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: "▶️", label: "Session Resumed" },
  adjourned: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: "🛑", label: "Session Adjourned" },
  undo_adjourn: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: "↩️", label: "Adjournment Undone" },
};

// ==================== AUDIT TIMELINE COMPONENT ====================
export function BroadcastTimeline({ events, isCollapsed, onToggle }: { events: BroadcastEvent[]; isCollapsed: boolean; onToggle: () => void }) {
  if (events.length === 0) return null;

  // Group consecutive events by itemId to show flow
  const recentEvents = events.slice(-30); // show last 30 events

  return (
    <div className="mt-5 overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 border-b border-border bg-muted/40 px-5 py-3 text-left transition-colors hover:bg-muted/70"
      >
        <EventSchedule size={16} className="text-slate-600" />
        <span className="text-[13px] font-semibold text-neutral-900">Broadcast Audit Trail</span>
        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{events.length} events</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-normal text-neutral-400">Real-time session activity log</span>
          {isCollapsed ? <ChevronRight size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
        </div>
      </button>
      {!isCollapsed && (
        <div className="px-5 py-4 max-h-[320px] overflow-y-auto">
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-neutral-200" />
            <div className="space-y-0">
              {recentEvents.map((event, idx) => {
                const style = actionStyles[event.action];
                const isSessionLevel = ["suspended", "session_resumed", "adjourned", "undo_adjourn"].includes(event.action);
                return (
                  <div key={event.id} className="flex items-start gap-3 relative group">
                    {/* Timeline dot */}
                    <div className={`w-[23px] h-[23px] rounded-full ${style.bg} border-2 ${style.border} flex items-center justify-center text-[10px] z-10 shrink-0 mt-1`}>
                      {style.icon}
                    </div>
                    {/* Content */}
                    <div className={`flex-1 py-1.5 ${idx < recentEvents.length - 1 ? "border-b border-neutral-50" : ""}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold ${style.color} uppercase tracking-wide`}>{style.label}</span>
                        <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-neutral-400">{event.timestamp}</span>
                      </div>
                      {isSessionLevel ? (
                        <p className="text-[11px] font-medium text-neutral-700 mt-0.5">
                          {event.action === "suspended" ? "Session recessed by Presiding Officer" :
                           event.action === "session_resumed" ? "Session resumed from recess" :
                           event.action === "adjourned" ? "Session officially adjourned" :
                           "Adjournment reversed — session restored"}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-medium text-neutral-800">{event.itemTitle}</span>
                          {event.itemRef && <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-blue-500">{event.itemRef}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== BATCH CONCLUDE MODAL ====================
export function BatchConcludeModal({
  items,
  groupName,
  onConfirm,
  onCancel,
}: {
  items: AgendaItem[];
  groupName: string;
  onConfirm: (ids: number[]) => void;
  onCancel: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(items.map(i => i.id)));

  const toggleId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  };

  return (
    <FeatureDialog onClose={onCancel} title="Batch Conclude Items" description={`Select items to mark as officially concluded in ${groupName}.`} contentClassName="!max-w-[480px]" showCloseButton={false}>
      <div className="w-full overflow-hidden rounded-[14px] border border-border bg-card">
        {/* Header */}
        <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <ListChecked size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white">Batch Conclude Items</h3>
            <p className="text-[11px] font-normal text-emerald-100 mt-0.5">{groupName}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-[11px] font-normal text-neutral-600">
            Select items to mark as officially concluded. This is typically used for procedural items (Roll Call, Approval of Minutes, etc.) that have clearly finished.
          </p>
          
          {/* Select All */}
          <button onClick={toggleAll} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer">
            {selectedIds.size === items.length
              ? <CheckboxCheckedFilled size={18} className="text-emerald-600" />
              : <Checkbox size={18} className="text-neutral-400" />}
            <span className="text-[11px] font-semibold text-neutral-700">Select All ({items.length})</span>
          </button>
          
          <div className="border-t border-neutral-100" />
          
          {/* Item list */}
          <div className="max-h-[240px] overflow-y-auto space-y-1">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => toggleId(item.id)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer text-left"
              >
                {selectedIds.has(item.id)
                  ? <CheckboxCheckedFilled size={18} className="text-emerald-600 shrink-0" />
                  : <Checkbox size={18} className="text-neutral-300 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium text-neutral-900 block truncate">{item.title}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.ref && <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-blue-500">{item.ref}</span>}
                    <span className="text-[9px] font-normal text-neutral-400">{item.type}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                  item.status === "broadcasting" ? "bg-emerald-100 text-emerald-700" :
                  item.status === "paused" ? "bg-yellow-100 text-yellow-700" :
                  "bg-neutral-100 text-neutral-500"
                }`}>
                  {item.status === "broadcasting" ? "On Floor" : item.status === "paused" ? "Paused" : "Pending"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center gap-3 bg-neutral-50/50">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-semibold text-neutral-600 bg-white border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-colors ${
              selectedIds.size > 0
                ? "bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700 shadow-md shadow-emerald-200"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }`}
          >
            <CheckmarkOutline size={14} /> Conclude {selectedIds.size} Item{selectedIds.size !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </FeatureDialog>
  );
}

// ==================== END-OF-SESSION CHECKLIST ====================
export function EndOfSessionChecklist({
  pausedItems,
  pendingItems,
  broadcastingItem,
  onProceed,
  onCancel,
  formatTime,
}: {
  pausedItems: AgendaItem[];
  pendingItems: AgendaItem[];
  broadcastingItem: AgendaItem | null;
  onProceed: () => void;
  onCancel: () => void;
  formatTime: (id: number) => string;
}) {
  const hasIssues = pausedItems.length > 0 || broadcastingItem !== null;

  return (
    <FeatureDialog onClose={onCancel} title={hasIssues ? "Pre-Adjournment Checklist" : "Session Ready for Adjournment"} description={hasIssues ? "Review incomplete items before proceeding." : "All active items have been resolved."} contentClassName="!max-w-[520px]" showCloseButton={false}>
      <div className="w-full overflow-hidden rounded-[14px] border border-border bg-card">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center gap-3 ${hasIssues ? "bg-amber-500" : "bg-emerald-600"}`}>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            {hasIssues ? <Warning size={20} className="text-white" /> : <CheckmarkOutline size={20} className="text-white" />}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white">
              {hasIssues ? "Pre-Adjournment Checklist" : "Session Ready for Adjournment"}
            </h3>
            <p className="text-[11px] font-normal text-white/80 mt-0.5">
              {hasIssues ? "Review incomplete items before proceeding" : "All active items have been resolved"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Broadcasting item warning */}
          {broadcastingItem && (
            <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Currently Broadcasting</span>
              </div>
              <p className="text-[12px] font-medium text-neutral-900">{broadcastingItem.title}</p>
              <div className="flex items-center gap-2 mt-1">
                {broadcastingItem.ref && <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-emerald-600">{broadcastingItem.ref}</span>}
                <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[10px] text-emerald-600">⏱ {formatTime(broadcastingItem.id)}</span>
              </div>
              <p className="text-[10px] font-normal text-amber-700 mt-2 bg-amber-50 rounded-lg px-2 py-1 border border-amber-200">
                ⚠️ This item is still on floor. It will be auto-deferred if you adjourn.
              </p>
            </div>
          )}

          {/* Paused items */}
          {pausedItems.length > 0 && (
            <div className="rounded-[14px] border border-yellow-200 bg-yellow-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Pause size={14} className="text-yellow-600" />
                <span className="text-[10px] font-semibold text-yellow-700 uppercase tracking-wide">
                  {pausedItems.length} Paused Item{pausedItems.length !== 1 ? "s" : ""} — Timer Frozen
                </span>
              </div>
              <div className="space-y-2">
                {pausedItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-2 border border-yellow-100">
                    <Pause size={12} className="text-yellow-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium text-neutral-900 block truncate">{item.title}</span>
                      {item.ref && <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-blue-500">{item.ref}</span>}
                    </div>
                    <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[10px] text-yellow-600 tabular-nums shrink-0">⏱ {formatTime(item.id)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-normal text-yellow-700 mt-2">
                These items were paused mid-debate. Adjourning will defer them as Unfinished Business for the next session.
              </p>
            </div>
          )}

          {/* Pending items count */}
          {pendingItems.length > 0 && (
            <div className="flex items-center gap-3 rounded-[14px] border border-border bg-muted/50 p-3">
              <span className="text-[11px] font-medium text-neutral-700">
                📋 {pendingItems.length} pending item{pendingItems.length !== 1 ? "s" : ""} not yet reached — will be auto-deferred
              </span>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-[14px] border border-border bg-muted/50 p-3">
            <p className="text-[11px] font-normal text-slate-700">
              {hasIssues
                ? "⚠️ Proceeding will trigger the Adjourn Friction Modal. All paused and pending items will be moved to Unfinished Business."
                : "✅ No items are currently broadcasting or paused. You may proceed safely."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center gap-3 bg-neutral-50/50">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-semibold text-neutral-600 bg-white border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors"
          >
            Go Back — Review Items
          </button>
          <button
            onClick={onProceed}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors shadow-md ${
              hasIssues
                ? "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200"
                : "bg-red-600 text-white hover:bg-red-700 shadow-red-200"
            }`}
          >
            <StopFilled size={14} /> Proceed to Adjourn
          </button>
        </div>
      </div>
    </FeatureDialog>
  );
}

// ==================== MOCK DATA ====================
import type { AgendaItem } from "./agendaModel";
