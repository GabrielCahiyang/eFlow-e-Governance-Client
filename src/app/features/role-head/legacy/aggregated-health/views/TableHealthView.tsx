import * as Icons from "lucide-react";
import * as LegacyUI from "../../primitives";
import * as Model from "../../aggregatedHealthModel";
import { useAggregatedHealth } from "../AggregatedHealthContext";

export function TableHealthView() {
  const { view, sorted, selectedId, setSelectedId, healthColor, statusTone, PROJECTS } = useAggregatedHealth();
  return <>
{view === "table" && (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[3px_minmax(220px,1.5fr)_minmax(150px,1fr)_110px_minmax(200px,1.4fr)_minmax(160px,1.2fr)_minmax(200px,1.4fr)_100px] gap-0 bg-neutral-50 border-b border-neutral-200">
            <div />
            <div className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Project
            </div>
            <div className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Project Manager
            </div>
            <div className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              AI Health
            </div>
            <div className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Timeline Health
            </div>
            <div className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Budget Burn
            </div>
            <div className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Current Bottleneck
            </div>
            <div className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500 text-right">
              Deadline
            </div>
          </div>
          {sorted.map((p) => {
            const isSel = selectedId === p.id;
            const deltaPp = p.timePct - p.tasksPct;
            const barTone =
              p.health === "red"
                ? "bg-red-500"
                : p.health === "yellow"
                  ? "bg-amber-500"
                  : "bg-emerald-500";
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(isSel ? null : p.id)}
                className={`w-full text-left grid grid-cols-[3px_minmax(220px,1.5fr)_minmax(150px,1fr)_110px_minmax(200px,1.4fr)_minmax(160px,1.2fr)_minmax(200px,1.4fr)_100px] gap-0 border-b border-neutral-100 hover:bg-neutral-50 transition ${isSel ? "bg-indigo-50/40" : ""}`}
              >
                <div
                  style={{ backgroundColor: healthColor[p.health] }}
                  className={p.health === "red" ? "animate-pulse" : ""}
                />
                <div className="px-3 py-3">
                  <div className="text-[12.5px] font-medium text-neutral-900">
                    {p.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-neutral-400">
                      {p.code}
                    </span>
                    <span
                      className={`text-[9.5px] font-medium border rounded px-1.5 py-0.5 ${statusTone[p.status]}`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
                <div className="px-3 py-3 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center text-[9px] font-semibold text-neutral-700 shrink-0">
                    {p.lead.split(" ").slice(-1)[0].slice(0, 2)}
                  </div>
                  <div className="text-[11.5px] font-normal text-neutral-700 truncate">
                    {p.lead}
                  </div>
                </div>
                <div className="px-3 py-3 flex items-center">
                  <Model.HealthChip health={p.health} />
                </div>
                <div className="px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-medium text-neutral-500 tabular-nums">
                      T {p.timePct}%
                    </span>
                    <span className="text-[10px] text-neutral-300">·</span>
                    <span className="text-[10px] font-medium text-neutral-700 tabular-nums">
                      W {p.tasksPct}%
                    </span>
                    {deltaPp > 15 && (
                      <span className="ml-auto text-[9.5px] font-medium text-red-700 bg-red-50 border border-red-200 rounded px-1 tabular-nums">
                        −{deltaPp}pp
                      </span>
                    )}
                  </div>
                  <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-neutral-300"
                      style={{ width: `${p.timePct}%` }}
                    />
                    <div
                      className={`absolute top-0 left-0 h-full ${barTone}`}
                      style={{ width: `${p.tasksPct}%` }}
                    />
                  </div>
                </div>
                <div className="px-3 py-3 flex items-center gap-2">
                  <Model.Sparkline
                    values={p.burnSpark}
                    color={healthColor[p.health]}
                  />
                  <div>
                    <div className="text-[11px] font-medium text-neutral-900 tabular-nums">
                      {p.budgetPct}%
                    </div>
                    <div className="text-[9.5px] font-normal text-neutral-500 tabular-nums">
                      of {LegacyUI.pesoShort(p.totalBudget)}
                    </div>
                  </div>
                </div>
                <div className="px-3 py-3 text-[11.5px] font-normal text-neutral-700">
                  {p.bottleneck ? (
                    <div className="flex items-start gap-1.5">
                      <Icons.AlertTriangle
                        size={11}
                        className={
                          p.health === "red" ? "text-red-600" : "text-amber-600"
                        }
                      />
                      <div className="min-w-0">
                        <div className="truncate">{p.bottleneck}</div>
                        <div className="text-[9.5px] text-neutral-400 tabular-nums">
                          {p.bottleneckAge}d old
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-700">
                      <Icons.CheckCircle2 size={11} /> <span>No blockers</span>
                    </div>
                  )}
                </div>
                <div className="px-3 py-3 text-right">
                  <div className="text-[11px] font-medium text-neutral-900 tabular-nums">
                    {p.deadline.split(",")[0]}
                  </div>
                  <div className="text-[9.5px] font-normal text-neutral-500">
                    {p.deadline.split(",")[1]}
                  </div>
                </div>
              </button>
            );
          })}
          <div className="px-4 py-2.5 text-[11px] font-normal text-neutral-500 bg-neutral-50">
            {sorted.length} of {PROJECTS.length} projects · Portfolio budget{" "}
            {LegacyUI.pesoShort(PROJECTS.reduce((s, p) => s + p.totalBudget, 0))}
          </div>
        </div>
      )}
  </>;
}
