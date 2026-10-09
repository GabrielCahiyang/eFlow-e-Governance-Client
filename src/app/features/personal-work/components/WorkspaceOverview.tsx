import { lazy, Suspense, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useWorkspaceScope } from "../../workspaces";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { requestNavigation } from "../../../shared/navigationGuard";
import { writeNavigationLocation } from "../../navigation";
import { useWorkFeed } from "../hooks/useWorkFeed";
import { workspaceSummary } from "../workSelectors";
import { WorkList } from "./WorkList";
import { WorkInspector, useWorkInspector } from "./WorkInspector";
import "../personalWork.css";
const HeadInsights = lazy(() =>
  import("../../../components/Head/HeadDashboard").then((m) => ({
    default: m.HeadDashboard,
  })),
);
export function WorkspaceOverview({
  onNavigate,
}: {
  onNavigate?: (section: string, page: string, project?: string) => void;
}) {
  const { user, userProfile, can } = useAuth();
  const context = useWorkspaceScope();
  const workspace = context?.workspace || {
    id: userProfile?.org_id || "unassigned",
    name: "Office workspace",
    kind: "office" as const,
    office_id: userProfile?.org_id || null,
    owner_id: null,
    timezone: "Asia/Singapore",
    state: "active" as const,
  };
  const feed = useWorkFeed(user?.id || "", {
    workspace,
    projectIds:
      workspace.kind === "personal"
        ? context?.projectIds
        : context?.officeProjectIds,
  });
  const inspector = useWorkInspector();
  const [focus, setFocus] = useState<
      "today" | "overdue" | "unassigned" | "review"
    >("overdue"),
    [insights, setInsights] = useState(false);
  const data = feed.data;
  const summary = data ? workspaceSummary(data) : undefined;
  const partial = !!data?.issues.length;
  const navigate = (section: string, page: string, project?: string) =>
    void requestNavigation(() =>
      onNavigate
        ? onNavigate(section, page, project)
        : writeNavigationLocation(
            section,
            page,
            "push",
            project ? { project, view: "tasks" } : undefined,
          ),
    );
  const filtered = summary?.[focus] || [];
  return (
    <section className="r10-workspace" aria-label="Workspace Overview">
      <WorkspaceHeader
        title="Workspace Overview"
        description={`${workspace.name} · ${workspace.kind === "personal" ? "Personal" : "Office"} workspace · ${workspace.timezone}`}
        actions={
          <>
            <button
              type="button"
              disabled={feed.loading}
              onClick={() => void feed.refresh()}
            >
              Refresh overview
            </button>
            {can("navigation.tasks") && (
              <button
                type="button"
                onClick={() => navigate("personal_work", "Assigned work")}
              >
                Open My Work
              </button>
            )}
            <button type="button" onClick={() => navigate("inbox", "Inbox")}>
              Open Inbox
            </button>
          </>
        }
      />
      <p className="r10-help">
        Projects and work below belong to this workspace. Project Overview
        remains inside each project. Review and invitation decisions stay in
        Inbox and Members.
      </p>
      {feed.error && (
        <FeedbackState
          tone="error"
          title="Workspace Overview is unavailable"
          onRetry={() => void feed.refresh()}
        >
          {feed.error}
        </FeedbackState>
      )}
      {partial && (
        <div role="alert">
          <strong>
            Workspace totals are unavailable until all sources load.
          </strong>
          <ul>
            {data?.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
          <button type="button" onClick={() => void feed.refresh()}>
            Retry overview sources
          </button>
        </div>
      )}
      {data?.unavailable.map((notice, i) => (
        <p role="status" key={i}>
          {notice}
        </p>
      ))}
      {feed.loading && !data ? (
        <p role="status">Loading workspace sources…</p>
      ) : (
        <>
          <div className="r10-overview-cards" aria-label="Workspace totals">
            <button
              type="button"
              onClick={() => navigate("projects", "Projects")}
            >
              <span>Active projects</span>
              <strong>
                {partial
                  ? "Unavailable"
                  : (summary?.activeProjects.length ?? "Unavailable")}
              </strong>
            </button>
            {(["today", "overdue", "unassigned", "review"] as const).map(
              (key) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={focus === key}
                  onClick={() => void requestNavigation(() => setFocus(key))}
                >
                  <span>
                    {
                      {
                        today: "Due today",
                        overdue: "Overdue work",
                        unassigned: "Needs reassignment",
                        review: "Awaiting review",
                      }[key]
                    }
                  </span>
                  <strong>
                    {partial
                      ? "Unavailable"
                      : (summary?.[key].length ?? "Unavailable")}
                  </strong>
                </button>
              ),
            )}
          </div>
          <section
            className="r10-overview-section"
            aria-label="Workspace projects"
          >
            <h2>Active projects</h2>
            <div className="r10-overview-projects">
              {summary?.activeProjects.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => navigate("projects", "Projects", p.id)}
                >
                  <strong>{p.title}</strong>
                  <small>
                    {p.kind === "personal" ? "Personal" : "Office"} · {p.status}
                  </small>
                </button>
              ))}
            </div>
            {!summary?.activeProjects.length && (
              <p>
                {partial
                  ? "Project coverage is incomplete. Retry the sources above."
                  : "No active projects in this workspace."}
              </p>
            )}
          </section>
          <section
            className="r10-overview-section"
            aria-label="Workspace attention"
          >
            <h2>
              {
                {
                  today: "Due today",
                  overdue: "Overdue work",
                  unassigned: "Needs reassignment",
                  review: "Awaiting review",
                }[focus]
              }
            </h2>
            {filtered.length ? (
              <WorkList
                rows={filtered}
                onOpen={inspector.open}
                label="Workspace attention items"
              />
            ) : (
              <p>
                {partial
                  ? "Attention coverage is incomplete."
                  : "No work in this category."}
              </p>
            )}
          </section>
          {workspace.kind === "office" && can("navigation.tasks") && (
            <p>
              <button
                type="button"
                onClick={() => navigate("personal_work", "Assigned work")}
              >
                Personal work across workspaces
              </button>
            </p>
          )}
        </>
      )}
      {userProfile?.role === "head" &&
        workspace.kind === "office" &&
        workspace.office_id === userProfile.org_id && (
          <section className="r10-overview-section">
            <button
              type="button"
              aria-expanded={insights}
              onClick={() =>
                void requestNavigation(() => setInsights((v) => !v))
              }
            >
              Office insights
            </button>
            {insights && (
              <Suspense
                fallback={<p role="status">Loading Office insights…</p>}
              >
                <HeadInsights />
              </Suspense>
            )}
          </section>
        )}
      <WorkInspector
        selected={inspector.selection}
        current={data?.rows || []}
        onClose={inspector.close}
      />
    </section>
  );
}
