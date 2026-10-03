import * as Icons from "lucide-react";
import * as LegacyUI from "../../primitives";
import * as Model from "../../aggregatedHealthModel";
import { useAggregatedHealth } from "../AggregatedHealthContext";

export function DiagnosticPanel() {
  const { selected, healthColor, setSelectedId } = useAggregatedHealth();
  return <>
{/* Diagnostic Panel (right slide-out) */}
      {selected && (
        <div className="fixed right-6 top-6 bottom-6 w-[384px] bg-white border border-neutral-200 rounded-xl shadow-2xl overflow-y-auto z-40">
          <div className="sticky top-0 bg-white border-b border-neutral-100 p-4 flex items-start justify-between z-10">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: healthColor[selected.health] }}
                />
                Diagnostic Drill-Down
              </div>
              <div className="text-[14px] font-semibold text-neutral-900 mt-0.5">
                {selected.name}
              </div>
              <div className="text-[10.5px] font-normal text-neutral-500">
                {selected.code} · {selected.lead}
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-neutral-400 hover:text-neutral-800 p-1"
            >
              <Icons.X size={14} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <Model.HealthChip health={selected.health} />

            {selected.bpaNode && selected.bottleneck ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-wider text-red-700 mb-2">
                  <Icons.GitBranch size={11} /> BPA Node · Stuck
                </div>
                <div className="text-[13px] font-semibold text-neutral-900">
                  {selected.bpaNode}
                </div>
                <div className="text-[11.5px] font-normal text-red-900 mt-1">
                  "{selected.bottleneck}" · blocked {selected.bottleneckAge}{" "}
                  days
                </div>

                <div className="mt-3 flex flex-col gap-1.5">
                  <button className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-medium bg-red-600 text-white hover:bg-red-700">
                    <Icons.Zap size={12} /> Escalate to Mayor
                  </button>
                  <button className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11.5px] font-medium bg-white border border-red-200 text-red-700 hover:bg-red-50">
                    <Icons.Bell size={12} /> Send Priority Nudge to City Accountant
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-2">
                <Icons.CheckCircle2 size={14} className="text-emerald-700 mt-0.5" />
                <div className="text-[11.5px] font-normal text-emerald-900 leading-relaxed">
                  All BPA nodes flowing. No intervention required.
                </div>
              </div>
            )}

            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 mb-2">
                Metrics
              </div>
              <div className="space-y-2 text-[11.5px] font-normal">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Status</span>
                  <span className="text-neutral-900">{selected.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Time Elapsed</span>
                  <span className="text-neutral-900 tabular-nums">
                    {selected.timePct}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Work Completed</span>
                  <span className="text-neutral-900 tabular-nums">
                    {selected.tasksPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Budget Burn</span>
                  <span className="text-neutral-900 tabular-nums">
                    {selected.budgetPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Total Budget</span>
                  <span className="text-neutral-900 tabular-nums">
                    {LegacyUI.peso(selected.totalBudget)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Next Milestone</span>
                  <span className="text-neutral-900">
                    {selected.nextMilestone}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500">Deadline</span>
                  <span className="text-neutral-900">{selected.deadline}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 mb-2">
                Budget Burn Trend
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                <Model.Sparkline
                  values={selected.burnSpark}
                  color={healthColor[selected.health]}
                />
                <div className="text-[10.5px] font-normal text-neutral-500 mt-1">
                  8-week sparkline · last reading {selected.budgetPct}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
              <LegacyUI.Btn
                icon={<Icons.ClipboardList size={12} />}
                label="Open Board"
                variant="primary"
              />
              <LegacyUI.Btn icon={<Icons.MessageSquare size={12} />} label="Message PM" />
            </div>
          </div>
        </div>
      )}
  </>;
}
