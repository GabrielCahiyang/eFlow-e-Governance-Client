import * as Icons from "lucide-react";
import { useAggregatedHealth } from "../AggregatedHealthContext";

export function MapHealthView() {
  const { view, PROJECTS, sorted, selectedId, setSelectedId } = useAggregatedHealth();
  return <>
{view === "map" && (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200 bg-neutral-50">
            <div className="flex items-center gap-2">
              <Icons.Map size={13} className="text-neutral-700" />
              <span className="text-[12px] font-medium text-neutral-900">
                Ormoc City · GIS Project Map
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10.5px] font-normal text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Optimal
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Warning
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Critical
              </span>
            </div>
          </div>
          <div className="relative h-[520px] bg-gradient-to-br from-emerald-50 via-sky-50 to-blue-100 overflow-hidden">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                <pattern
                  id="grid"
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 8 0 L 0 0 0 8"
                    fill="none"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth="0.15"
                  />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
              <path
                d="M 0 75 Q 40 65 60 78 T 100 80 L 100 100 L 0 100 Z"
                fill="#60a5fa"
                fillOpacity="0.35"
              />
              <path
                d="M 10 20 Q 35 18 50 30 T 85 25 L 85 55 L 10 60 Z"
                fill="#86efac"
                fillOpacity="0.4"
              />
              <path
                d="M 0 50 L 100 52"
                stroke="#fff"
                strokeWidth="0.6"
                strokeDasharray="1 1"
              />
              <path
                d="M 50 0 L 52 100"
                stroke="#fff"
                strokeWidth="0.6"
                strokeDasharray="1 1"
              />
            </svg>
            {[
              "Brgy. Cogon",
              "Brgy. Linao",
              "Brgy. Dolores",
              "Brgy. Alegria",
              "Brgy. San Isidro",
            ].map((b) => {
              const ref = PROJECTS.find((p) => p.barangay === b)!;
              return (
                <div
                  key={b}
                  className="absolute text-[9.5px] font-medium text-neutral-700 bg-white/80 rounded px-1.5 py-0.5 border border-white shadow-sm"
                  style={{ left: `${ref.mapX - 4}%`, top: `${ref.mapY - 10}%` }}
                >
                  {b}
                </div>
              );
            })}
            {sorted.map((p) => {
              const color =
                p.health === "red"
                  ? "#dc2626"
                  : p.health === "yellow"
                    ? "#f59e0b"
                    : "#10b981";
              const isSel = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="absolute -translate-x-1/2 -translate-y-full group"
                  style={{ left: `${p.mapX}%`, top: `${p.mapY}%` }}
                >
                  <div className="relative">
                    <div
                      className={`w-8 h-8 rounded-full rounded-bl-none rotate-45 border-2 border-white shadow-lg ${p.health === "red" ? "animate-pulse" : ""} ${isSel ? "scale-125" : "group-hover:scale-110"} transition`}
                      style={{ backgroundColor: color }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[9px] font-semibold text-white">
                        {p.code.slice(-3)}
                      </span>
                    </div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 bg-neutral-900 text-white text-[10px] font-medium rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    {p.name}
                  </div>
                </button>
              );
            })}
            <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur border border-neutral-200 rounded-lg p-2 text-[10px] font-normal text-neutral-700">
              <div className="flex items-center gap-1 mb-0.5">
                <Icons.Flame size={10} className="text-red-600" />{" "}
                <strong className="font-medium">
                  3 Critical
                </strong>{" "}
                clustered in Brgy. Cogon
              </div>
              <div className="text-neutral-500">
                Possible localized cause — investigate.
              </div>
            </div>
          </div>
        </div>
      )}
  </>;
}
