import type { ComponentType } from "react";
import { NLPTranscription } from "./components/NLPTranscription";
import { SessionSummaries } from "./components/SessionSummaries";
import { ArchivedMinutes } from "./components/ArchivedMinutes";
import { Btn, PageHeader, StatCard } from "./components/primitives";
import { BatchConcludeModal, BroadcastTimeline, EndOfSessionChecklist } from "./components/SessionBroadcast";
import { groupColors, groupOrder } from "./components/agendaModel";
import { DraggableAgendaRow, InterruptionWarningModal } from "./components/AgendaControls";
import { AdjournFrictionModal, GracePeriodBanner } from "./components/AdjournmentControls";
import { AgendaItemDrawer } from "./components/AgendaItemDrawer";
import { useOrderOfBusiness } from "./hooks/useOrderOfBusiness";
import {
  CheckmarkOutline, DocumentExport, Renew, Play, StopFilled,
  Edit, Locked, Add, Pause, ListChecked,
} from "@carbon/icons-react";

function OrderOfBusiness() {
  const {
    items, sessionState,
    drawerOpen, setDrawerOpen, showAdjournModal, setShowAdjournModal,
    graceSecondsLeft, drawerType, setDrawerType, drawerRef, setDrawerRef,
    drawerTitle, setDrawerTitle, drawerSponsor, setDrawerSponsor,
    drawerDuration, setDrawerDuration, drawerGroup, setDrawerGroup,
    draggedIdx, setDraggedIdx, interruptTarget, setInterruptTarget,
    broadcastHistory, timelineCollapsed, setTimelineCollapsed,
    batchConcludeGroup, setBatchConcludeGroup, showChecklist, setShowChecklist,
    isLive, isSuspended, isAdjourned, isGrace, isPreSession, formatTime,
    pendingCount, handleBroadcast, executeBroadcastSwitch, handleConclude,
    handleBatchConclude, handleUpdateTitle, handleSuspend, handleResume,
    handleAdjournClick, handleAdjournConfirm, handleUndoAdjourn,
    handleStartSession, moveItem, handleAddItem, doneCount, totalCount, currentItem,
    autoDeferredCount,
  } = useOrderOfBusiness();

  let globalIdx = 0;

  return (
    <>
      <div className={`relative transition-all duration-500 ${drawerOpen ? "mr-[400px]" : ""}`} style={{ transitionTimingFunction: "cubic-bezier(0.25, 1.1, 0.4, 1)" }}>
        <PageHeader
          title="142nd Regular Session — Order of Business"
          subtitle="Session Management · SP Secretariat Control Panel"
          actions={<>
            {/* Session control buttons based on state */}
            {isPreSession && (
              <button
                onClick={handleStartSession}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200"
              >
                <Play size={14} /> Start Live Session
              </button>
            )}
            {isLive && (
              <>
                {/* Suspend / Recess — safe, non-destructive */}
                <button
                  onClick={handleSuspend}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-all bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-200"
                >
                  <Pause size={14} /> Suspend / Recess
                </button>
                {/* Adjourn — destructive, opens friction modal */}
                <button
                  onClick={handleAdjournClick}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-all bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200"
                >
                  <StopFilled size={14} /> Adjourn Session
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-[11px] font-semibold text-white">LIVE</span>
                </div>
              </>
            )}
            {isSuspended && (
              <>
                <button
                  onClick={handleResume}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-all bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 animate-pulse"
                >
                  <Play size={14} /> Resume Session
                </button>
                <button
                  onClick={handleAdjournClick}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-all bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200"
                >
                  <StopFilled size={14} /> Adjourn Session
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 rounded-lg">
                  <Pause size={12} className="text-white" />
                  <span className="text-[11px] font-semibold text-white">RECESSED</span>
                </div>
              </>
            )}
            {(isGrace || isAdjourned) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 rounded-lg">
                <span className="text-[11px] font-semibold text-white">ADJOURNED</span>
              </div>
            )}
            {!isAdjourned && !isGrace && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Add size={14} /> Add Agenda Item
              </button>
            )}
            <Btn icon={<DocumentExport size={14} />} label="Export Agenda PDF" />
          </>}
        />

        {/* Grace Period Banner — Fail-Safe 3 */}
        {isGrace && (
          <GracePeriodBanner
            secondsLeft={graceSecondsLeft}
            onUndo={handleUndoAdjourn}
            deferredCount={autoDeferredCount}
          />
        )}

        {/* Sealed record banner */}
        {isAdjourned && (
          <div className="bg-neutral-100 border border-neutral-300 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <Locked size={16} className="text-neutral-600" />
            <div>
              <span className="text-[12px] font-semibold text-neutral-800">SESSION ADJOURNED — Record Sealed</span>
              <p className="text-[10px] font-normal text-neutral-600 mt-0.5">
                The 142nd Regular Session has been officially adjourned. The undo grace period has expired. Session data is now immutable.
              </p>
            </div>
          </div>
        )}

        {/* Suspended / Recess banner */}
        {isSuspended && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Pause size={16} className="text-amber-600" />
                <span className="text-[13px] font-semibold text-amber-800">SESSION SUSPENDED — Recess in Progress</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] font-normal text-amber-700">All items preserved · Click <strong>[Resume]</strong> to continue</span>
              </div>
            </div>
            <p className="text-[10px] font-normal text-amber-700 mt-1.5">
              The agenda board is locked during recess. No items have been moved or deferred. The session timer is paused.
            </p>
          </div>
        )}

        {/* Real-time sync banner */}
        {isLive && (
          <div className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[12px] font-semibold text-emerald-300">SYNCED</span>
              </div>
              <div className="h-4 w-px bg-slate-600" />
              <span className="text-[11px] font-normal text-slate-300">
                13 devices connected — Mayor · Vice Mayor · 12 Councilors · SP Secretary
              </span>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-[11px] font-normal text-slate-400">Session Duration: <strong className="text-white">1h 42m</strong></span>
                <span className="text-[11px] font-normal text-slate-400">Progress: <strong className="text-white">{doneCount}/{totalCount}</strong></span>
              </div>
            </div>
            {currentItem && (
              <div className="mt-2 pt-2 border-t border-slate-700 flex items-center gap-2">
                <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide">Now Broadcasting →</span>
                <span className="text-[12px] font-semibold text-white">{currentItem.title}</span>
                <span className="font-['JetBrains_Mono',_'Fira_Code',_monospace] text-[11px] text-emerald-300 ml-2 tabular-nums">⏱ {currentItem ? formatTime(currentItem.id) : "00:00"}</span>
              </div>
            )}
          </div>
        )}

        {/* Pre-session mode indicator */}
        {isPreSession && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <Edit size={16} className="text-amber-600" />
            <div>
              <span className="text-[12px] font-semibold text-amber-800">PRE-SESSION MODE · Agenda Builder Active</span>
              <p className="text-[10px] font-normal text-amber-700 mt-0.5">
                Drag items to reorder (⋮⋮) · Double-click any title to edit inline · Add items via the <strong>[+ Add Agenda Item]</strong> drawer. Click <strong>[Start Live Session]</strong> to lock the agenda and arm broadcast buttons.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-5 flex-wrap">
          <StatCard label="Agenda Items" value={`${totalCount}`} sub="Total for session" />
          <StatCard label="Completed" value={`${doneCount}`} sub={`${totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}% complete`} trend="up" />
          <StatCard label="Pending" value={`${items.filter(i => i.status === "pending" || i.status === "paused").length}`} sub={`${items.filter(i => i.status === "paused").length} paused`} />
          <StatCard label="Deferred" value={`${items.filter(i => i.status === "deferred").length}`} sub="Moved to next session" trend={items.filter(i => i.status === "deferred").length > 0 ? "down" : "flat"} />
        </div>

        {/* Agenda Board */}
        <div className="space-y-4">
          {groupOrder.map(group => {
            const groupItems = items.filter(i => i.group === group);
            if (groupItems.length === 0) return null;
            const allDone = groupItems.every(i => i.status === "done");
            return (
              <div key={group} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-3 border-b border-neutral-100" style={{ borderLeft: `4px solid ${groupColors[group]}` }}>
                  <span className="text-[13px] font-semibold text-neutral-900">{group}</span>
                  <span className="text-[10px] font-medium bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5">{groupItems.length}</span>
                  {allDone && (
                    <div className="flex items-center gap-1 ml-auto">
                      <CheckmarkOutline size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-medium text-emerald-600">Complete</span>
                    </div>
                  )}
                  {!allDone && (isLive || isSuspended) && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[10px] font-normal text-neutral-400">
                        {groupItems.filter(i => i.status === "done").length}/{groupItems.length} concluded
                        {groupItems.some(i => i.status === "paused") && <span className="text-yellow-600 ml-1">· {groupItems.filter(i => i.status === "paused").length} paused</span>}
                      </span>
                      {/* Batch Conclude — show for groups with concludable items */}
                      {isLive && groupItems.filter(i => i.status !== "done" && i.status !== "deferred").length >= 2 && (
                        <button
                          onClick={() => setBatchConcludeGroup(group)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors"
                        >
                          <ListChecked size={12} /> Batch Conclude
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  {groupItems.map((item) => {
                    const currentGlobal = globalIdx++;
                    return (
                      <DraggableAgendaRow
                        key={item.id}
                        item={item}
                        globalIndex={currentGlobal}
                        moveItem={moveItem}
                        isLive={isLive}
                        sessionState={sessionState}
                        isBroadcasting={item.status === "broadcasting"}
                        isPaused={item.status === "paused"}
                        isDone={item.status === "done"}
                        isDeferred={item.status === "deferred"}
                        onBroadcast={() => handleBroadcast(item.id)}
                        onConclude={() => handleConclude(item.id)}
                        onUpdateTitle={(t) => handleUpdateTitle(item.id, t)}
                        itemElapsed={formatTime(item.id)}
                        draggedIdx={draggedIdx}
                        setDraggedIdx={setDraggedIdx}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Broadcast Audit Trail */}
        <BroadcastTimeline
          events={broadcastHistory}
          isCollapsed={timelineCollapsed}
          onToggle={() => setTimelineCollapsed(prev => !prev)}
        />

        {/* BPA Automation notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-5">
          <div className="flex items-start gap-3">
            <Renew size={16} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <span className="text-[12px] font-semibold text-blue-800">BPA Engine — Decoupled Broadcast + Triple Fail-Safe</span>
              <p className="text-[11px] font-normal text-blue-700 mt-0.5">
                <strong>📡 Broadcast</strong> is a projector switch only — it never finalizes items. Use <strong>[✓ Conclude Item]</strong> to legally close an item.{" "}
                Switching broadcast shows an <strong>interruption warning</strong> and pauses the current item.{" "}
                <strong>⏸ Suspend/Recess</strong> freezes the board.{" "}
                <strong>🛑 Adjourn</strong> requires typing "ADJOURN" + 5-min grace period.
              </p>
            </div>
          </div>
        </div>

        {/* Interruption Warning Modal — Broadcast Switch Fail-Safe */}
        {interruptTarget !== null && (() => {
          const currentBroadcasting = items.find(i => i.status === "broadcasting");
          const targetItem = items.find(i => i.id === interruptTarget);
          if (!currentBroadcasting || !targetItem) return null;
          return (
            <InterruptionWarningModal
              currentItem={currentBroadcasting}
              targetItem={targetItem}
              currentElapsed={formatTime(currentBroadcasting.id)}
              onConfirm={() => executeBroadcastSwitch(interruptTarget)}
              onCancel={() => setInterruptTarget(null)}
            />
          );
        })()}

        {/* End-of-Session Checklist — Pre-Adjournment Review */}
        {showChecklist && (
          <EndOfSessionChecklist
            pausedItems={items.filter(i => i.status === "paused")}
            pendingItems={items.filter(i => i.status === "pending")}
            broadcastingItem={items.find(i => i.status === "broadcasting") ?? null}
            formatTime={formatTime}
            onProceed={() => {
              setShowChecklist(false);
              setShowAdjournModal(true);
            }}
            onCancel={() => setShowChecklist(false)}
          />
        )}

        {/* Batch Conclude Modal */}
        {batchConcludeGroup !== null && (() => {
          const groupItems = items.filter(i => i.group === batchConcludeGroup && i.status !== "done" && i.status !== "deferred");
          if (groupItems.length === 0) return null;
          return (
            <BatchConcludeModal
              items={groupItems}
              groupName={batchConcludeGroup}
              onConfirm={handleBatchConclude}
              onCancel={() => setBatchConcludeGroup(null)}
            />
          );
        })()}

        {/* Friction Modal — Fail-Safe 2 */}
        {showAdjournModal && (
          <AdjournFrictionModal
            pendingCount={pendingCount}
            pendingItems={items.filter(i => i.status === "pending" || i.status === "broadcasting" || i.status === "paused")}
            sessionLabel="142nd Regular Session"
            onConfirm={handleAdjournConfirm}
            onCancel={() => setShowAdjournModal(false)}
          />
        )}
      </div>

      <AgendaItemDrawer
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        drawerType={drawerType}
        setDrawerType={setDrawerType}
        drawerRef={drawerRef}
        setDrawerRef={setDrawerRef}
        drawerTitle={drawerTitle}
        setDrawerTitle={setDrawerTitle}
        drawerSponsor={drawerSponsor}
        setDrawerSponsor={setDrawerSponsor}
        drawerDuration={drawerDuration}
        setDrawerDuration={setDrawerDuration}
        drawerGroup={drawerGroup}
        setDrawerGroup={setDrawerGroup}
        handleAddItem={handleAddItem}
      />
    </>
  );
}

// ==================== NLP TRANSCRIPTION ====================

export const sessionPages: Record<string, Record<string, ComponentType>> = {
  session: {
    "Order of Business": OrderOfBusiness,
    "NLP Transcription": NLPTranscription,
    "Session Summaries": SessionSummaries,
    "Archived Minutes": ArchivedMinutes,
  },
};

export const sessionDefaultPages: Record<string, string> = {
  session: "Order of Business",
};
