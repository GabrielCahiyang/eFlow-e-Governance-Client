import * as Icons from "lucide-react";
import type { Project } from "../../aggregatedHealthModel";
import { useAggregatedHealth } from "../AggregatedHealthContext";

export function CalendarHealthView() {
  const { view, sorted, setSelectedId } = useAggregatedHealth();
  return <>
{view === "calendar" &&
        (() => {
          const days = Array.from({ length: 35 }, (_, i) => i - 2); // offset grid
          const deadlines: Record<number, Project[]> = {};
          sorted.forEach((p) => {
            const d = new Date(p.deadline);
            const day = d.getDate();
            (deadlines[day] ||= []).push(p);
          });
          return (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <Icons.CalendarDays size={13} className="text-neutral-700" />
                  <span className="text-[12px] font-medium text-neutral-900">
                    Master Deadline Calendar · Sample Month
                  </span>
                </div>
                <span className="text-[10.5px] text-neutral-500">
                  Watch for collision days — multiple red pins on the same
                  Friday.
                </span>
              </div>
              <div className="grid grid-cols-7 text-[10px] font-medium uppercase tracking-wider text-neutral-400 border-b border-neutral-200">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="px-2 py-1.5">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d, i) => {
                  const valid = d >= 1 && d <= 30;
                  const items = valid ? deadlines[d] || [] : [];
                  const isFri = i % 7 === 5;
                  return (
                    <div
                      key={i}
                      className={`min-h-[92px] border-b border-r border-neutral-100 p-1.5 ${valid ? "" : "bg-neutral-50/60"} ${isFri && items.length >= 2 ? "bg-red-50/40" : ""}`}
                    >
                      <div
                        className={`text-[10.5px] font-medium tabular-nums ${valid ? "text-neutral-700" : "text-neutral-300"}`}
                      >
                        {valid ? d : ""}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {items.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className="w-full text-left flex items-center gap-1 truncate"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.health === "red" ? "bg-red-500" : p.health === "yellow" ? "bg-amber-500" : "bg-emerald-500"}`}
                            />
                            <span className="text-[9.5px] font-normal text-neutral-700 truncate">
                              {p.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
  </>;
}
