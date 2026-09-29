import { useMemo } from "react";
import { useEmployees, useTasks } from "../../../hooks/useFirebaseData";
import { calculateDeadlineWorkload, isActive } from "../../tasks";
import { getNavigationUrl } from "../../navigation";
import { PageHeader, Stat } from "./primitives";

export function WorkloadVelocityOverview() {
  const { employees, loading: employeesLoading } = useEmployees();
  const { tasks, loading: tasksLoading } = useTasks();
  const rows = useMemo(() => employees.map((employee) => {
    const assigned = tasks.filter((task) => task.assigneeId === employee.id || task.teamMemberIds?.includes(employee.id));
    return { employee, active: assigned.filter(isActive).length, workload: calculateDeadlineWorkload(assigned, Date.now(), employee.id) };
  }).sort((a, b) => b.workload.signal - a.workload.signal), [employees, tasks]);
  const loading = employeesLoading || tasksLoading;
  return <div>
    <PageHeader title="Workload and completion" subtitle="Live task estimates and deadline pressure. Working days are Monday–Friday, eight hours per day." />
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Stat label="Staff with high workload" value={loading ? "—" : String(rows.filter((row) => ["high", "very_high"].includes(row.workload.level)).length)} tone="warn" />
      <Stat label="Staff needing task details" value={loading ? "—" : String(rows.filter((row) => row.workload.missingEstimates || row.workload.missingDeadlines).length)} />
      <Stat label="Completed tasks" value={loading ? "—" : String(tasks.filter((task) => task.status === "completed").length)} trend="From the current task records" tone="good" />
    </div>
    <div className="mb-5 flex flex-wrap gap-3"><a className="rounded-lg border bg-white px-4 py-3 text-sm text-primary" href={getNavigationUrl("workforce", "Equitable Distribution")}>Equitable Distribution</a><a className="rounded-lg border bg-white px-4 py-3 text-sm text-primary" href={getNavigationUrl("workforce", "GA Allocation Review")}>Allocation Review</a></div>
    <section className="overflow-x-auto rounded-xl border bg-white p-4"><h2 className="font-semibold">Staff workload</h2><p className="mt-1 text-xs text-neutral-500">Pressure compares remaining estimated hours with working hours before the busiest deadline. A shared task divides the estimate equally among its assigned members. Add missing estimates or deadlines to improve the rating.</p>
      {loading ? <p className="mt-4" role="status">Loading workload…</p> : <table className="mt-4 w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">Staff member</th><th className="p-2">Department</th><th className="p-2">Open tasks</th><th className="p-2">Workload</th><th className="p-2">Why</th></tr></thead><tbody>{rows.map(({ employee, active, workload }) => <tr key={employee.id} className="border-b last:border-0"><td className="p-2 font-medium">{employee.name}</td><td className="p-2">{employee.departmentName || "Department not set"}</td><td className="p-2">{active}</td><td className="p-2 font-semibold">{workload.label}</td><td className="p-2 text-neutral-500">{workload.explanation}</td></tr>)}</tbody></table>}
      {!loading && !rows.length && <p className="mt-4 text-sm text-neutral-500">No staff records are available in your account’s scope.</p>}
    </section>
  </div>;
}
