import { useMemo, useState } from "react";
import { useEmployees, useTasks } from "../../../../hooks/useFirebaseData";
import { useAuth } from "../../../../contexts/AuthContext";
import { useOrgs } from "../../../../hooks/useSupabaseData";
import { getDescendantOrgIds } from "../../../../../lib/supabaseService";
import { deriveProjectsFromTasks, type BoardView, type Project } from "../aggregatedHealthModel";

export function useAggregatedHealthController() {
  // Fetch realtime data
  const { tasks } = useTasks();
  const { employees: allEmployees } = useEmployees();
  const { userProfile } = useAuth();
  const { orgs } = useOrgs();

  // Filter to entire org subtree (own node + all descendants), not just
  // an exact match — this is the fix for Dept Head not seeing sub-section
  // tasks.
  const scopedOrgIds = useMemo(
    () => getDescendantOrgIds(orgs, userProfile?.departmentId),
    [orgs, userProfile?.departmentId],
  );
  const deptTasks = useMemo(() => {
    if (scopedOrgIds.length === 0) return tasks;
    return tasks.filter(
      (t) => !t.orgId || scopedOrgIds.includes(t.orgId),
    );
  }, [tasks, scopedOrgIds]);

  const PROJECTS = useMemo(
    () => deriveProjectsFromTasks(deptTasks, allEmployees || []),
    [deptTasks, allEmployees],
  );
  const [view, setView] = useState<BoardView>("table");
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [sortBy, setSortBy] = useState<"health" | "budget" | "deadline">(
    "health",
  );
  const [selectedId, setSelectedId] = useState<string | null>("p4");
  const [query, setQuery] = useState("");
  const [addViewOpen, setAddViewOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pmFilter, setPmFilter] = useState<string>("");
  const [brgyFilter, setBrgyFilter] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  const allPMs = Array.from(new Set(PROJECTS.map((p) => p.lead)));
  const allBrgy = Array.from(new Set(PROJECTS.map((p) => p.barangay)));

  const sorted = useMemo(() => {
    let rows = [...PROJECTS];
    if (sortBy === "health") {
      const ord = { red: 0, yellow: 1, green: 2 };
      rows.sort((a, b) => ord[a.health] - ord[b.health]);
    } else if (sortBy === "budget") {
      rows.sort((a, b) => b.totalBudget - a.totalBudget);
    } else {
      rows.sort(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
      );
    }
    if (onlyCritical) rows = rows.filter((p) => p.health === "red");
    if (pmFilter) rows = rows.filter((p) => p.lead === pmFilter);
    if (brgyFilter) rows = rows.filter((p) => p.barangay === brgyFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.lead.toLowerCase().includes(q) ||
          p.barangay.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [onlyCritical, sortBy, query, pmFilter, brgyFilter]);

  const doExport = (kind: "PDF" | "CSV") => {
    setToast(
      `Exporting ${sorted.length} projects to ${kind}… queued for download`,
    );
    setTimeout(() => setToast(null), 2400);
  };
  const activeFilterCount = (pmFilter ? 1 : 0) + (brgyFilter ? 1 : 0);

  const selected = PROJECTS.find((p) => p.id === selectedId) || null;

  const healthColor: Record<Project["health"], string> = {
    green: "#10b981",
    yellow: "#f59e0b",
    red: "#dc2626",
  };
  const statusTone: Record<Project["status"], string> = {
    "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
    Blocked: "bg-red-50 text-red-700 border-red-200",
    Planning: "bg-neutral-100 text-neutral-700 border-neutral-200",
    Closing: "bg-purple-50 text-purple-700 border-purple-200",
  };


  return {
    PROJECTS,
    view,
    setView,
    onlyCritical,
    setOnlyCritical,
    sortBy,
    setSortBy,
    selectedId,
    setSelectedId,
    query,
    setQuery,
    addViewOpen,
    setAddViewOpen,
    filterOpen,
    setFilterOpen,
    pmFilter,
    setPmFilter,
    brgyFilter,
    setBrgyFilter,
    toast,
    allPMs,
    allBrgy,
    sorted,
    doExport,
    activeFilterCount,
    selected,
    healthColor,
    statusTone,
  };
}
