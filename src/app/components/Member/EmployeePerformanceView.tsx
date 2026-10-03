import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useEmployeeNotes } from "../../hooks/useFirebaseData";
import { useCurrentUserTasks } from "../../hooks/useCurrentUserTasks";
import { PageHeader } from "../workflow/primitives";
import { MyMonthlyContributionCard } from "../../features/productivity";
import { subscribeToTeamWorkflowFacts, type TeamWorkflowFacts } from "../../features/team-management";

import { calculateDeadlineWorkload } from "../../features/tasks";

const EMPTY_FACTS: TeamWorkflowFacts = { subtasks: [], progress: [], submissions: [], statusHistory: [], evidence: [] };

export function EmployeePerformanceView() {
  const { userProfile } = useAuth();
  const { notes, loading: notesLoading } = useEmployeeNotes();
  const { tasks, loading: tasksLoading } = useCurrentUserTasks();
  const [contributionFacts, setContributionFacts] = useState<TeamWorkflowFacts>(EMPTY_FACTS);
  const taskKey = useMemo(() => tasks.map((task) => task.id).sort().join(","), [tasks]);
  useEffect(() => subscribeToTeamWorkflowFacts(taskKey ? taskKey.split(",") : [], setContributionFacts, () => setContributionFacts(EMPTY_FACTS)), [taskKey]);

  const totals = useMemo(
    () => ({
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "completed").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      inReview: tasks.filter((task) => task.status === "for_review").length,
    }),
    [tasks],
  );

  const deadlineWorkload = calculateDeadlineWorkload(tasks, Date.now(), userProfile?.id);
  const workload = deadlineWorkload.signal;
  const risk = deadlineWorkload.level === "very_high" || deadlineWorkload.level === "high" ? "high" : deadlineWorkload.level === "moderate" || deadlineWorkload.level === "unknown" ? "medium" : "low";
  const health = {
    low: {
      label: "Sustainable workload",
      description: "Your current active work is within a healthy range.",
      card: "border-emerald-200 bg-emerald-50",
      text: "text-emerald-800",
      bar: "bg-emerald-500",
    },
    medium: {
      label: "Watch your workload",
      description: "Flag blockers early and discuss priorities with your lead.",
      card: "border-amber-200 bg-amber-50",
      text: "text-amber-800",
      bar: "bg-amber-500",
    },
    high: {
      label: "Workload needs attention",
      description: "Ask your Head to rebalance active assignments.",
      card: "border-red-200 bg-red-50",
      text: "text-red-800",
      bar: "bg-red-500",
    },
  }[risk];
  const profileNote = userProfile?.id
    ? notes[userProfile.id]
    : undefined;

  return (
    <div className="min-h-full p-2">
      <PageHeader
        eyebrow="My Workspace · Insights"
        title="Performance"
        subtitle="Your workload and delivery status, calculated from the same live tasks as the board."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total tasks", totals.total, "All assignments"],
          ["In progress", totals.inProgress, "Currently underway"],
          ["In review", totals.inReview, "Awaiting a decision"],
          ["Completed", totals.completed, "Approved work"],
        ].map(([label, value, description]) => (
          <div
            key={label as string}
            className="rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">
              {label as string}
            </div>
            <div className="mt-1 text-[25px] font-semibold text-neutral-900">
              {tasksLoading ? "—" : (value as number)}
            </div>
            <div className="mt-0.5 text-[11px] text-neutral-500">
              {description as string}
            </div>
          </div>
        ))}
      </div>

      <section className={`mt-5 rounded-xl border p-5 ${health.card}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={`text-[11px] font-medium uppercase tracking-wider ${health.text}`}>
              Workload health
            </div>
            <h2 className={`mt-1 text-[16px] font-semibold ${health.text}`}>
              {health.label}
            </h2>
            <p className={`mt-1 text-[12px] ${health.text}`}>
              {deadlineWorkload.explanation}
            </p>
          </div>
          <div className={`rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium ${health.text}`}>
            {deadlineWorkload.label} workload
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80">
          <div
            className={`h-full ${health.bar}`}
            style={{ width: `${Math.min(workload, 100)}%` }}
          />
        </div>
      </section>

      {userProfile?.id && (
        <MyMonthlyContributionCard
          employee={{
            id: userProfile.id,
            name: userProfile.full_name || userProfile.fullName || userProfile.email || "Member",
            jobTitle: String(userProfile.role || "Member").replace(/_/g, " "),
            jobDescription: "",
            currentWorkload: workload,
            department: userProfile.org_id || userProfile.departmentId,
            departmentName: userProfile.departmentId || "",
            email: userProfile.email,
          }}
          tasks={tasks}
          facts={contributionFacts}
        />
      )}

      <section className="mt-5 rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-600" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-400">
              Head profile
            </div>
            <h2 className="text-[15px] font-semibold text-neutral-900">
              Strengths and coaching context
            </h2>
          </div>
        </div>

        {notesLoading ? (
          <p className="mt-5 text-[12px] text-neutral-400">
            Loading your profile…
          </p>
        ) : profileNote ? (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <InsightCard
              label="Strengths"
              value={
                profileNote.strengths ||
                "No strengths have been recorded yet."
              }
              tone="emerald"
            />
            <InsightCard
              label="Growth areas"
              value={
                profileNote.weaknesses ||
                "No growth areas have been recorded yet."
              }
              tone="amber"
            />
            <div className="rounded-lg bg-neutral-50 p-4 md:col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">
                Notes
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-700">
                {profileNote.notes ||
                  "No additional coaching notes have been shared."}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-lg bg-neutral-50 px-4 py-5 text-[12px] text-neutral-500">
            Your Head has not added a performance profile yet.
          </p>
        )}
      </section>
    </div>
  );
}

function InsightCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber";
}) {
  const styles =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-900"
      : "bg-amber-50 text-amber-900";
  return (
    <div className={`rounded-lg p-4 ${styles}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">
        {label}
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed">{value}</p>
    </div>
  );
}
