import * as Model from "../../aggregatedHealthModel";
import { useAggregatedHealth } from "../AggregatedHealthContext";

export function KanbanHealthView() {
  const { view, sorted, selectedId, setSelectedId } = useAggregatedHealth();
  return <>
{view === "kanban" && (
        <div className="grid grid-cols-4 gap-3">
          {(["Planning", "In Progress", "Blocked", "Closing"] as const).map(
            (col) => {
              const items = sorted.filter((p) => p.status === col);
              const colTone: Record<string, string> = {
                Planning: "border-t-neutral-400",
                "In Progress": "border-t-blue-500",
                Blocked: "border-t-red-500",
                Closing: "border-t-purple-500",
              };
              return (
                <div
                  key={col}
                  className={`bg-neutral-50 border-t-[3px] ${colTone[col]} border border-neutral-200 rounded-lg p-2 min-h-[400px]`}
                >
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="text-[11px] font-semibold text-neutral-800 uppercase tracking-wider">
                      {col}
                    </div>
                    <div className="text-[10px] font-medium text-neutral-500 bg-white border border-neutral-200 rounded-full px-1.5 tabular-nums">
                      {items.length}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={`w-full text-left bg-white border rounded-lg p-2.5 hover:shadow-sm transition ${selectedId === p.id ? "border-indigo-300 ring-1 ring-indigo-200" : "border-neutral-200"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-mono text-neutral-400">
                            {p.code}
                          </span>
                          <Model.HealthChip health={p.health} />
                        </div>
                        <div className="text-[12px] font-medium text-neutral-900 leading-snug">
                          {p.name}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center text-[8px] font-semibold text-neutral-700">
                            {p.lead.split(" ").slice(-1)[0].slice(0, 2)}
                          </div>
                          <span className="text-[10px] text-neutral-500 truncate">
                            {p.lead}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${p.health === "red" ? "bg-red-500" : p.health === "yellow" ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${p.tasksPct}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[9.5px] text-neutral-500 tabular-nums">
                          <span>{p.tasksPct}% done</span>
                          <span>{p.deadline.split(",")[0]}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
  </>;
}
