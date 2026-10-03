import { useAggregatedHealth } from "../AggregatedHealthContext";

export function GanttHealthView() {
  const { view, sorted, healthColor } = useAggregatedHealth();
  return <>
{view === "gantt" && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-[12.5px] font-medium text-neutral-900 mb-3">
            Portfolio Gantt · Apr–Dec 2026
          </div>
          <div className="space-y-2">
            {sorted.map((p) => {
              const start = 5 + ((parseInt(p.id.replace(/\D/g, "")) * 3) % 30);
              const width = 35 + p.totalBudget / 2_000_000;
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[240px_1fr] gap-3 items-center"
                >
                  <div className="text-[11.5px] font-medium text-neutral-900 truncate">
                    {p.name}
                  </div>
                  <div className="relative h-6 bg-neutral-50 rounded">
                    <div
                      className="absolute top-1 bottom-1 rounded flex items-center px-2"
                      style={{
                        left: `${start}%`,
                        width: `${Math.min(width, 95 - start)}%`,
                        backgroundColor: healthColor[p.health],
                        opacity: 0.85,
                      }}
                    >
                      <span className="text-[9px] font-medium text-white truncate">
                        {p.tasksPct}% complete
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
  </>;
}
