import * as Icons from "lucide-react";
import type { BoardView } from "./aggregatedHealthModel";
import { AggregatedHealthProvider, useAggregatedHealth } from "./aggregated-health/AggregatedHealthContext";
import { TableHealthView } from "./aggregated-health/views/TableHealthView";
import { GanttHealthView } from "./aggregated-health/views/GanttHealthView";
import { ResourceHealthView } from "./aggregated-health/views/ResourceHealthView";
import { KanbanHealthView } from "./aggregated-health/views/KanbanHealthView";
import { MapHealthView } from "./aggregated-health/views/MapHealthView";
import { CalendarHealthView } from "./aggregated-health/views/CalendarHealthView";
import { DiagnosticPanel } from "./aggregated-health/views/DiagnosticPanel";

function AggregatedHealthLayout() {
  const {
    PROJECTS, view, setView, onlyCritical, setOnlyCritical, sortBy, setSortBy,
    selected, query, setQuery, addViewOpen, setAddViewOpen, filterOpen,
    setFilterOpen, pmFilter, setPmFilter, brgyFilter, setBrgyFilter,
    toast, allPMs, allBrgy, activeFilterCount, doExport,
  } = useAggregatedHealth();

  return (
    <div
      className={`p-8 min-h-full ${selected && "pr-[408px]"} transition-all`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
            <Icons.Briefcase size={12} /> Dept. Head · Portfolio Overview
          </div>
          <h1 className="text-[22px] font-semibold text-neutral-900">
            Departmental Project Health — Q3 2026
          </h1>
          <p className="text-[13px] font-normal text-neutral-500 mt-0.5">
            Manage by exception · AI bubbles failing projects to the top
          </p>
        </div>
        <div className="relative flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-1">
          {(
            [
              {
                id: "table",
                label: "Main Table",
                icon: <Icons.ClipboardList size={13} />,
              },
              {
                id: "gantt",
                label: "Gantt Chart",
                icon: <Icons.Calendar size={13} />,
              },
              {
                id: "resource",
                label: "Resource Chart",
                icon: <Icons.Users size={13} />,
              },
              { id: "kanban", label: "Kanban", icon: <Icons.Layers size={13} /> },
              { id: "map", label: "GIS Map", icon: <Icons.Map size={13} /> },
              {
                id: "calendar",
                label: "Calendar",
                icon: <Icons.CalendarDays size={13} />,
              },
            ] as const
          )
            .filter(
              (v) =>
                view === v.id ||
                ["table", "gantt", "resource"].includes(v.id) ||
                view === v.id,
            )
            .map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11.5px] font-medium ${view === v.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          <div className="w-px h-5 bg-neutral-200 mx-1" />
          <button
            onClick={() => setAddViewOpen(!addViewOpen)}
            className="flex items-center gap-1 px-2 py-1.5 rounded text-[11.5px] font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50"
          >
            <Icons.Plus size={12} /> Add View
          </button>
          {addViewOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setAddViewOpen(false)}
              />
              <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-[300px] bg-white border border-neutral-200 rounded-xl shadow-2xl p-2">
                <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                  Add a View
                </div>
                {[
                  {
                    id: "kanban",
                    icon: <Icons.Layers size={14} className="text-blue-600" />,
                    title: "Kanban Board",
                    desc: "Cards grouped by status — Planning → In Progress → Blocked → Completed",
                  },
                  {
                    id: "map",
                    icon: <Icons.Map size={14} className="text-emerald-600" />,
                    title: "GIS Map View",
                    desc: "City map with project pins color-coded by AI Health",
                  },
                  {
                    id: "calendar",
                    icon: (
                      <Icons.CalendarDays size={14} className="text-violet-600" />
                    ),
                    title: "Master Calendar",
                    desc: "All deadlines plotted on a monthly grid",
                  },
                ].map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setView(o.id as BoardView);
                      setAddViewOpen(false);
                    }}
                    className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-neutral-50 text-left"
                  >
                    <div className="w-7 h-7 rounded-md bg-neutral-50 border border-neutral-200 flex items-center justify-center shrink-0">
                      {o.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-neutral-900">
                        {o.title}
                      </div>
                      <div className="text-[10.5px] font-normal text-neutral-500 leading-snug">
                        {o.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex items-center bg-white border border-neutral-200 rounded-lg h-[32px] w-[260px] focus-within:border-neutral-400 focus-within:ring-1 focus-within:ring-neutral-200">
          <Icons.Search size={13} className="text-neutral-400 ml-2.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search "Eco-Park" or "PRJ-2026-014"…'
            className="flex-1 bg-transparent px-2 text-[11.5px] font-normal text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="pr-2 text-neutral-400 hover:text-neutral-700"
            >
              <Icons.X size={12} />
            </button>
          )}
        </div>

        <button
          onClick={() => setOnlyCritical(!onlyCritical)}
          className={`flex items-center gap-1.5 px-3 h-[32px] rounded-lg text-[11.5px] font-medium border ${onlyCritical ? "bg-red-600 text-white border-red-600" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"}`}
        >
          <Icons.Flame size={12} /> Show Only Critical
        </button>

        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 px-3 h-[32px] rounded-lg text-[11.5px] font-medium border ${activeFilterCount > 0 ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"}`}
          >
            <Icons.Filter size={12} /> Filter{" "}
            {activeFilterCount > 0 && (
              <span className="ml-0.5 bg-indigo-600 text-white rounded-full text-[9px] px-1.5 font-semibold tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>
          {filterOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setFilterOpen(false)}
              />
              <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-[280px] bg-white border border-neutral-200 rounded-xl shadow-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Advanced Filters
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setPmFilter("");
                        setBrgyFilter("");
                      }}
                      className="text-[10.5px] text-neutral-500 hover:text-neutral-900 underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <label className="block mb-3">
                  <div className="text-[10.5px] font-medium text-neutral-600 mb-1">
                    Project Manager
                  </div>
                  <select
                    value={pmFilter}
                    onChange={(e) => setPmFilter(e.target.value)}
                    className="w-full h-[30px] px-2 border border-neutral-200 rounded-md text-[11.5px] font-normal text-neutral-800 bg-white"
                  >
                    <option value="">All PMs</option>
                    {allPMs.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-[10.5px] font-medium text-neutral-600 mb-1">
                    Location (Barangay)
                  </div>
                  <select
                    value={brgyFilter}
                    onChange={(e) => setBrgyFilter(e.target.value)}
                    className="w-full h-[30px] px-2 border border-neutral-200 rounded-md text-[11.5px] font-normal text-neutral-800 bg-white"
                  >
                    <option value="">All Barangays</option>
                    {allBrgy.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center bg-white border border-neutral-200 rounded-lg p-0.5 h-[32px]">
          {(
            [
              { id: "health", label: "AI Health" },
              { id: "budget", label: "Highest Budget" },
              { id: "deadline", label: "Nearest Deadline" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={`px-2.5 h-[26px] rounded text-[11px] font-medium ${sortBy === s.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-3 text-[11px] font-normal text-neutral-500 pr-2 border-r border-neutral-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Optimal ·{" "}
              {PROJECTS.filter((p) => p.health === "green").length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Warning ·{" "}
              {PROJECTS.filter((p) => p.health === "yellow").length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />{" "}
              Critical · {PROJECTS.filter((p) => p.health === "red").length}
            </span>
          </div>
          <div className="flex items-center bg-white border border-neutral-200 rounded-lg overflow-hidden h-[32px]">
            <button
              onClick={() => doExport("PDF")}
              className="flex items-center gap-1.5 px-3 text-[11.5px] font-medium text-neutral-700 hover:bg-neutral-50 h-full"
            >
              <Icons.FileDown size={12} /> PDF
            </button>
            <div className="w-px h-4 bg-neutral-200" />
            <button
              onClick={() => doExport("CSV")}
              className="flex items-center gap-1.5 px-3 text-[11.5px] font-medium text-neutral-700 hover:bg-neutral-50 h-full"
            >
              <Icons.Download size={12} /> CSV
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="mb-3 bg-neutral-900 text-white rounded-lg px-3 py-2 text-[11.5px] font-medium flex items-center gap-2 w-fit">
          <Icons.FileDown size={12} /> {toast}
        </div>
      )}


      <TableHealthView />
      <GanttHealthView />
      <ResourceHealthView />
      <KanbanHealthView />
      <MapHealthView />
      <CalendarHealthView />
      <DiagnosticPanel />
    </div>
  );
}

export function AggregatedHealth() {
  return (
    <AggregatedHealthProvider>
      <AggregatedHealthLayout />
    </AggregatedHealthProvider>
  );
}
