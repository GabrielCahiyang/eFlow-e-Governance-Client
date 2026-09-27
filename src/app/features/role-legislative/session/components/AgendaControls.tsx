import { useCallback, useRef, useState } from "react";
import { CheckmarkOutline, DragVertical, Pause, Play, Warning } from "@carbon/icons-react";
import { FeatureDialog } from "../../../../components/ui/FeatureDialog";
import { Pill } from "./primitives";
import type { AgendaItem } from "./agendaModel";
import type { SessionState } from "./AdjournmentControls";

export function InterruptionWarningModal({
  currentItem,
  targetItem,
  currentElapsed,
  onConfirm,
  onCancel,
}: {
  currentItem: AgendaItem;
  targetItem: AgendaItem;
  currentElapsed: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <FeatureDialog onClose={onCancel} title="Active Item on Floor" description="Broadcast interruption detected." contentClassName="!max-w-[440px]" showCloseButton={false}>
      <div className="w-full overflow-hidden bg-white">
        {/* Header */}
        <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Warning size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-white">Active Item on Floor</h3>
            <p className="text-[11px] font-normal text-amber-100 mt-0.5">Broadcast interruption detected</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Current item */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">Currently on Floor</p>
            <p className="text-[12px] font-medium text-neutral-900">{currentItem.title}</p>
            <div className="flex items-center gap-2 mt-1">
              {currentItem.ref && <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-emerald-600">{currentItem.ref}</span>}
              <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[10px] text-emerald-600">⏱ {currentElapsed}</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="text-[11px] font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              ↓ will be paused and replaced by ↓
            </div>
          </div>

          {/* Target item */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-1">Switch Broadcast To</p>
            <p className="text-[12px] font-medium text-neutral-900">{targetItem.title}</p>
            {targetItem.ref && <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-blue-600 mt-1 block">{targetItem.ref}</span>}
          </div>

          <p className="text-[11px] font-normal text-neutral-600">
            The current item will be <strong className="text-yellow-700">paused</strong> (not concluded). Its timer will freeze and can be resumed later.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center gap-3 bg-neutral-50/50">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-semibold text-neutral-600 bg-white border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors"
          >
            Cancel — Keep Current
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-amber-500 text-white cursor-pointer hover:bg-amber-600 transition-colors shadow-md shadow-amber-200"
          >
            <Play size={14} /> Switch Broadcast
          </button>
        </div>
      </div>
    </FeatureDialog>
  );
}

// Draggable Agenda Row (native HTML5 drag)
export function DraggableAgendaRow({
  item,
  globalIndex,
  moveItem,
  isLive,
  sessionState,
  isBroadcasting,
  isPaused,
  isDone,
  isDeferred,
  onBroadcast,
  onConclude,
  onUpdateTitle,
  itemElapsed,
  draggedIdx,
  setDraggedIdx,
}: {
  item: AgendaItem;
  globalIndex: number;
  moveItem: (fromGlobal: number, toGlobal: number) => void;
  isLive: boolean;
  sessionState: SessionState;
  isBroadcasting: boolean;
  isPaused: boolean;
  isDone: boolean;
  isDeferred: boolean;
  onBroadcast: () => void;
  onConclude: () => void;
  onUpdateTitle: (newTitle: string) => void;
  itemElapsed: string;
  draggedIdx: number | null;
  setDraggedIdx: (idx: number | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [isOver, setIsOver] = useState(false);
  const isDragging = draggedIdx === globalIndex;
  const isSuspended = sessionState === "suspended";

  const handleDoubleClick = useCallback(() => {
    if (sessionState === "pre" && !isDone) {
      setIsEditingTitle(true);
      setEditTitle(item.title);
    }
  }, [sessionState, isDone, item.title]);

  const handleTitleSave = () => {
    if (editTitle.trim() && editTitle !== item.title) {
      onUpdateTitle(editTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div
      ref={ref}
      draggable={sessionState === "pre"}
      onDragStart={(e) => {
        if (sessionState !== "pre") { e.preventDefault(); return; }
        setDraggedIdx(globalIndex);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (sessionState !== "pre") return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        if (draggedIdx !== null && draggedIdx !== globalIndex) {
          moveItem(draggedIdx, globalIndex);
        }
        setDraggedIdx(null);
      }}
      onDragEnd={() => { setDraggedIdx(null); setIsOver(false); }}
      className={`flex items-center gap-3 px-5 py-3.5 border-b last:border-b-0 transition-all duration-300 ${
        isDragging ? "opacity-40" : "opacity-100"
      } ${
        isOver && !isLive ? "bg-blue-50 border-b-blue-100" : ""
      } ${
        isBroadcasting ? "bg-emerald-50/70 border-l-4 border-l-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.08)]" :
        isPaused ? "bg-yellow-50/50 border-l-4 border-l-yellow-400" :
        isDone ? "bg-neutral-50/30 border-b-neutral-50" :
        isDeferred ? "bg-orange-50/30 border-b-orange-50" :
        "border-b-neutral-50 hover:bg-blue-50/20"
      }`}
    >
      {/* Drag grip — only visible pre-session */}
      {sessionState === "pre" && (
        <div
          className="cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500 transition-colors shrink-0"
          title="Drag to reorder"
        >
          <DragVertical size={16} />
        </div>
      )}

      {/* Item number */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold shrink-0 ${
        isDone ? "bg-emerald-100 text-emerald-700" :
        isBroadcasting ? "bg-emerald-500 text-white" :
        isPaused ? "bg-yellow-100 text-yellow-700" :
        isDeferred ? "bg-orange-100 text-orange-700" :
        "bg-neutral-100 text-neutral-600"
      }`}>
        {isDone ? <CheckmarkOutline size={14} /> : isPaused ? <Pause size={14} /> : item.id}
      </div>

      {/* Content — inline editable */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") setIsEditingTitle(false); }}
                onBlur={handleTitleSave}
                className="flex-1 px-2 py-1 text-[12px] font-medium text-neutral-900 border border-blue-300 rounded-lg outline-none bg-blue-50/50"
              />
              <span className="text-[9px] font-normal text-neutral-400 whitespace-nowrap">Enter to save · Esc to cancel</span>
            </div>
          ) : (
            <span
              className={`text-[12px] font-medium ${isDone ? "text-neutral-500 line-through" : "text-neutral-900"} ${sessionState === "pre" && !isDone ? "cursor-text hover:bg-blue-50/50 hover:px-1 hover:rounded transition-all" : ""}`}
              onDoubleClick={handleDoubleClick}
              title={sessionState === "pre" && !isDone ? "Double-click to edit" : undefined}
            >
              {item.title}
            </span>
          )}
          {isBroadcasting && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> ON FLOOR
            </span>
          )}
          {isPaused && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-yellow-400 text-yellow-900 text-[9px] font-semibold">
              <Pause size={10} /> PAUSED
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {item.ref && <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[9px] text-blue-500">{item.ref}</span>}
          {item.author && <span className="text-[10px] font-normal text-neutral-400">{item.author}</span>}
          {item.duration && <span className="text-[10px] font-normal text-neutral-400">~{item.duration}</span>}
          {(isBroadcasting || isPaused) && (
            <span className={`font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[10px] ml-2 tabular-nums ${isBroadcasting ? "text-emerald-600" : "text-yellow-600"}`}>
              ⏱ {itemElapsed}{isPaused ? " (paused)" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Status/Type */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-medium bg-neutral-50 text-neutral-500 rounded-full px-2 py-0.5 border border-neutral-100">{item.type}</span>
      </div>

      {/* Action zone — View State decoupled from Completion State */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Pending items: show Broadcast button (only when live, not done/deferred) */}
        {isLive && !isDone && !isBroadcasting && !isPaused && !isDeferred && (
          <button
            onClick={onBroadcast}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Play size={12} /> Broadcast to Floor
          </button>
        )}

        {/* Paused items: show Resume + Conclude */}
        {isLive && isPaused && (
          <div className="flex items-center gap-2">
            <button
              onClick={onBroadcast}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500 text-white rounded-lg text-[11px] font-semibold cursor-pointer hover:bg-yellow-600 transition-colors shadow-sm"
            >
              <Play size={12} /> Resume
            </button>
            <button
              onClick={onConclude}
              className="flex items-center gap-1 px-2.5 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-semibold cursor-pointer hover:bg-emerald-700 transition-colors"
            >
              <CheckmarkOutline size={12} /> Conclude Item
            </button>
            <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[10px] text-yellow-600 tabular-nums">{itemElapsed}</span>
          </div>
        )}

        {/* Broadcasting items: show LIVE indicator + Conclude */}
        {isBroadcasting && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 border-2 border-emerald-400"
              style={{ boxShadow: "0 0 12px rgba(16,185,129,0.25)" }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-700">LIVE</span>
              <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[11px] text-emerald-600 tabular-nums">{itemElapsed}</span>
            </div>
            <button
              onClick={onConclude}
              className="flex items-center gap-1 px-2.5 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-semibold cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <CheckmarkOutline size={12} /> Conclude Item
            </button>
          </div>
        )}

        {/* Done items */}
        {isDone && (isLive || isSuspended) && (
          <span className="text-[10px] font-normal text-emerald-500">✓ Concluded · {itemElapsed}</span>
        )}
        {isDone && !isLive && !isSuspended && (
          <span className="text-[10px] font-normal text-emerald-500">✓ Done</span>
        )}
        {isDeferred && (
          <Pill status="Unfinished Business" />
        )}
        {!isLive && isPaused && (
          <span className="text-[10px] font-medium text-yellow-600">
            ⏸ Paused · {itemElapsed}
          </span>
        )}
        {!isLive && !isDone && !isDeferred && !isPaused && (
          <span className="text-[10px] font-normal text-neutral-300 italic">
            {sessionState === "suspended" ? "⏸ Recessed" : sessionState === "grace" || sessionState === "adjourned" ? "Adjourned" : "Pre-session"}
          </span>
        )}
      </div>
    </div>
  );
}

// Session states: "pre" = not started, "live" = active, "suspended" = recessed, "adjourned" = ended, "grace" = undo window
