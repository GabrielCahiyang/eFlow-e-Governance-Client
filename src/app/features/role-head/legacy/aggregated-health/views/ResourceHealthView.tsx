import * as LegacyUI from "../../primitives";
import { useAggregatedHealth } from "../AggregatedHealthContext";

export function ResourceHealthView() {
  const { view, PROJECTS } = useAggregatedHealth();
  return <>
{view === "resource" && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-[12.5px] font-medium text-neutral-900 mb-3">
            Resource Load per Project Manager
          </div>
          <div className="space-y-2.5">
            {Array.from(new Set(PROJECTS.map((p) => p.lead))).map((lead) => {
              const projs = PROJECTS.filter((p) => p.lead === lead);
              const total = projs.reduce((s, p) => s + p.totalBudget, 0);
              const load = Math.min(
                100,
                projs.length * 18 +
                  projs.filter((p) => p.health === "red").length * 12,
              );
              return (
                <div
                  key={lead}
                  className="grid grid-cols-[180px_1fr_80px] gap-3 items-center"
                >
                  <div className="text-[11.5px] font-medium text-neutral-900 truncate">
                    {lead}
                  </div>
                  <div className="relative h-5 bg-neutral-100 rounded">
                    <div
                      className={`absolute top-0 bottom-0 rounded ${load > 80 ? "bg-red-500" : load > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${load}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white">
                      {projs.length} projects · {LegacyUI.pesoShort(total)}
                    </div>
                  </div>
                  <div className="text-[11px] font-medium text-neutral-700 tabular-nums text-right">
                    {load}% load
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
  </>;
}
