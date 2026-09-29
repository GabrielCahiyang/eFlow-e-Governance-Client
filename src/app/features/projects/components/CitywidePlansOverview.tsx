import { useEffect, useState } from "react";
import type { Organization, UserProfile } from "../../../types";
import { DepartmentApprovalMatrix, fetchApprovalPortfolio, subscribeToCollaborationDraftChanges, type CollaborationDraft } from "../../interdepartment-collaboration";
import type { Project } from "../services/types";

export function CitywidePlansOverview({ projects, drafts, organizations, profiles, onOpenProject, onOpenPlan }: {
  projects: Project[]; drafts: CollaborationDraft[]; organizations: Organization[]; profiles: UserProfile[];
  onOpenProject: (id: string) => void; onOpenPlan: (id: string) => void;
}) {
  const [portfolio, setPortfolio] = useState<Awaited<ReturnType<typeof fetchApprovalPortfolio>>>({ participants: [], approvals: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let version = 0;
    const refresh = async () => {
      const requestVersion = ++version;
      try { const next = await fetchApprovalPortfolio(drafts); if (active && requestVersion === version) { setPortfolio(next); setError(""); } }
      catch (failure) { if (active && requestVersion === version) setError(failure instanceof Error ? failure.message : "Approvals could not be loaded."); }
      finally { if (active && requestVersion === version) setLoading(false); }
    };
    setLoading(true); void refresh();
    const unsubscribe = subscribeToCollaborationDraftChanges(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [drafts]);
  const currentDrafts = drafts.filter((draft) => !["committed", "archived", "deleted"].includes(draft.status));
  const pending = portfolio.participants.filter((participant) => {
    const draft = currentDrafts.find((item) => item.id === participant.draftId);
    return draft && ["participant", "governance"].includes(participant.participationRole)
      && !portfolio.approvals.some((approval) => approval.revisionId === draft.currentRevisionId && approval.organizationId === participant.orgId && approval.decision === "approved");
  }).length;
  return <div className="space-y-5 p-4 sm:p-6">
    <header><h1 className="text-xl font-semibold">Citywide plans and projects</h1><p className="mt-1 text-sm text-neutral-500">Choose a department using the sidebar filter, open a project, or check the departments still reviewing a plan.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Active projects", projects.filter((project) => !["archived", "completed"].includes(project.status)).length],
      ["Draft plans", currentDrafts.length], ["Approvals still needed", loading ? "…" : error ? "Unavailable" : pending],
      ["Plans needing updates", currentDrafts.filter((draft) => draft.status === "changes_requested").length],
    ].map(([label, count]) => <div key={label} className="rounded-xl border bg-white p-4"><div className="text-2xl font-semibold">{count}</div><div className="mt-1 text-xs text-neutral-500">{label}</div></div>)}</div>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Projects</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{projects.filter((project) => project.status !== "archived").map((project) => <button type="button" key={project.id} onClick={() => onOpenProject(project.id)} className="rounded-lg border p-3 text-left hover:bg-neutral-50"><strong className="text-sm">{project.title}</strong><span className="block text-xs text-neutral-500">{organizations.find((org) => org.id === project.orgId)?.name || "Department not set"}</span></button>)}</div>{!projects.some((project) => project.status !== "archived") && <p className="mt-3 text-sm text-neutral-500">No projects match the selected department.</p>}</section>
    <h2 className="text-lg font-semibold">Department approval tracking</h2>
    {loading ? <p role="status">Loading department approvals…</p> : error ? <p role="alert" className="text-sm text-red-700">{error}</p> : drafts.map((draft) => <div key={draft.id} className="space-y-2"><button type="button" onClick={() => onOpenPlan(draft.id)} className="text-left text-sm font-semibold text-primary hover:underline">{draft.title}</button><DepartmentApprovalMatrix currentRevisionId={draft.currentRevisionId} participants={portfolio.participants.filter((participant) => participant.draftId === draft.id)} approvals={portfolio.approvals} organizations={organizations} profiles={profiles} /></div>)}
    {!loading && !error && !drafts.length && <p className="text-sm text-neutral-500">No work plans match the selected department.</p>}
  </div>;
}
