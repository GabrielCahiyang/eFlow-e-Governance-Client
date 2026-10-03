import type { Employee } from "../../../services/employeeService";
import type { Task } from "../../../services/taskService";

export type Project = {
  id: string;
  name: string;
  code: string;
  lead: string;
  timePct: number;
  tasksPct: number;
  budgetPct: number;
  totalBudget: number;
  health: "green" | "yellow" | "red";
  bottleneck?: string;
  bottleneckAge?: number;
  bpaNode?: string;
  nextMilestone: string;
  deadline: string;
  burnSpark: number[];
  status: "In Progress" | "Blocked" | "Planning" | "Closing";
  barangay: string;
  mapX: number;
  mapY: number;
};

// Derive projects from live task data instead of hardcoding
export function deriveProjectsFromTasks(
  tasks: Task[],
  employees: Employee[],
): Project[] {
  // Group tasks by department
  const deptGroups = new Map<string, Task[]>();
  tasks.forEach((t) => {
    const dept = t.department || "UNASSIGNED";
    if (!deptGroups.has(dept)) deptGroups.set(dept, []);
    deptGroups.get(dept)!.push(t);
  });

  const DEPT_NAMES: Record<string, string> = {
    EPW: "Engineering & Public Works",
    CPD: "City Planning & Development",
    FIN: "Finance & Budget",
    HSW: "Health & Social Welfare",
    ITS: "IT & Digital Services",
    BPLO: "Business Permit & Licensing",
  };

  return Array.from(deptGroups.entries()).map(([dept, deptTasks], idx) => {
    const total = deptTasks.length;
    const completed = deptTasks.filter((t) => t.status === "completed").length;
    const inProgress = deptTasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const blocked = deptTasks.filter((t) => t.status === "for_review").length;
    const tasksPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Find lead employee for this department
    const deptEmp = employees.filter((e) => e.department === dept);
    const lead =
      deptEmp.find((e) => e.jobTitle?.includes("Head"))?.name ||
      deptEmp[0]?.name ||
      "Unassigned";

    // Nearest deadline
    const deadlines = deptTasks
      .filter((t) => t.deadline || t.dueDate)
      .map((t) => new Date(t.deadline || t.dueDate!))
      .sort((a, b) => a.getTime() - b.getTime());
    const nearestDl = deadlines[0];
    const now = new Date();
    const daysLeft = nearestDl
      ? Math.ceil((nearestDl.getTime() - now.getTime()) / 86400000)
      : 999;
    const timePct = nearestDl
      ? Math.min(95, Math.max(10, 100 - daysLeft * 2))
      : 20;

    // Health calc
    const overdue = deptTasks.filter((t) => {
      const dl = t.deadline || t.dueDate;
      if (!dl || t.status === "completed") return false;
      return new Date(dl).getTime() < Date.now();
    }).length;
    const health: "green" | "yellow" | "red" =
      overdue > 0
        ? "red"
        : inProgress + blocked > total / 2
          ? "yellow"
          : "green";

    // Status
    const status: Project["status"] =
      overdue > 0
        ? "Blocked"
        : completed === total && total > 0
          ? "Closing"
          : inProgress > 0
            ? "In Progress"
            : "Planning";

    // Build sparkline from progress
    const spark = Array.from({ length: 8 }, (_, i) =>
      Math.round((tasksPct / 8) * (i + 1)),
    );

    const barangays = deptTasks.map((t) => t.barangay).filter(Boolean);

    return {
      id: dept,
      name: DEPT_NAMES[dept] || dept,
      code: `DEPT-${dept}`,
      lead,
      timePct,
      tasksPct,
      budgetPct: Math.round(tasksPct * 0.9), // estimate
      totalBudget: 0,
      health,
      bottleneck: overdue > 0 ? `${overdue} overdue task(s)` : undefined,
      bottleneckAge:
        overdue > 0 ? (daysLeft < 0 ? Math.abs(daysLeft) : 0) : undefined,
      bpaNode: overdue > 0 ? `${dept} · Overdue Review` : undefined,
      nextMilestone: nearestDl
        ? `Next deadline · ${nearestDl.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`
        : "No deadlines",
      deadline: nearestDl
        ? nearestDl.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "-",
      burnSpark: spark,
      status,
      barangay: barangays[0] || "-",
      mapX: 30 + idx * 10,
      mapY: 40 + idx * 5,
    };
  });
}

export type BoardView = "table" | "gantt" | "resource" | "kanban" | "map" | "calendar";

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 90,
    H = 24;
  const max = 100;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - (v / max) * H + 2}`)
    .join(" ");
  const area = `M0,${H} L${pts.replace(/ /g, " L ")} L${W},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H + 4}`} className="w-[90px] h-[26px]">
      <path d={area} fill={color} fillOpacity="0.12" />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map(
        (v, i) =>
          i === values.length - 1 && (
            <circle
              key={i}
              cx={(i / (values.length - 1)) * W}
              cy={H - (v / max) * H + 2}
              r="2"
              fill={color}
            />
          ),
      )}
    </svg>
  );
}

export function HealthChip({ health }: { health: Project["health"] }) {
  const map = {
    green: { bg: "bg-emerald-500", label: "Optimal" },
    yellow: { bg: "bg-amber-500", label: "Warning" },
    red: { bg: "bg-red-500 animate-pulse", label: "Critical" },
  } as const;
  const s = map[health];
  return (
    <div
      className={`flex items-center gap-1.5 ${s.bg} text-white rounded-full pl-1.5 pr-2 py-0.5 w-fit`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      <span className="text-[10px] font-medium uppercase tracking-wider">
        {s.label}
      </span>
    </div>
  );
}
