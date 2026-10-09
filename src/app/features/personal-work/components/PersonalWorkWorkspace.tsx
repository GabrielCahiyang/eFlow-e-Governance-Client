import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { WorkspaceHeader, ActionMenu } from "../../../components/ui/workspace";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { requestNavigation } from "../../../shared/navigationGuard";
import {
  NAVIGATION_LOCATION_EVENT,
  pushNavigationHistory,
} from "../../../shared/navigationHistory";
import { writeNavigationLocation } from "../../navigation";
import { useWorkFeed } from "../hooks/useWorkFeed";
import { workDestinations, dateFilters, type WorkDestination } from "../types";
import { selectWorkRows } from "../workSelectors";
import { WorkList } from "./WorkList";
import { WorkInspector, useWorkInspector } from "./WorkInspector";
import "../personalWork.css";
import { readWorkFilters as readFilters } from "../workLocation";
export function PersonalWorkWorkspace({
  page = "Assigned work",
  onNavigate,
}: {
  page?: string;
  onNavigate?: (section: string, page: string) => void;
}) {
  const { user, userProfile, can } = useAuth();
  const userId = user?.id || "";
  return (
    <PersonalWorkContent
      key={userId}
      userId={userId}
      role={userProfile?.role || "member"}
      page={page}
      can={can}
      onNavigate={onNavigate}
    />
  );
}
function PersonalWorkContent({
  userId,
  role,
  page,
  can,
  onNavigate,
}: {
  userId: string;
  role: string;
  page: string;
  can: (permission: string) => boolean;
  onNavigate?: (section: string, page: string) => void;
}) {
  const feed = useWorkFeed(userId);
  const inspector = useWorkInspector();
  const [filters, setFilters] = useState(readFilters);
  useEffect(() => {
    const sync = () => setFilters(readFilters());
    window.addEventListener("popstate", sync);
    window.addEventListener(NAVIGATION_LOCATION_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(NAVIGATION_LOCATION_EVENT, sync);
    };
  }, []);
  const destination = workDestinations.includes(page as WorkDestination)
    ? (page as WorkDestination)
    : "Assigned work";
  const update = (next: Partial<ReturnType<typeof readFilters>>) =>
    void requestNavigation(() => {
      const values = { ...filters, ...next };
      const url = new URL(window.location.href);
      url.searchParams.set("page", destination);
      for (const [key, value] of Object.entries({
        date: values.date === "All my work" ? "" : values.date,
        q: values.query,
        workScope: values.workspace,
        recent: values.recent ? "1" : "",
      })) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
      pushNavigationHistory(`${url.pathname}${url.search}`);
    });
  const navigate = (section: string, page: string) =>
    void requestNavigation(() =>
      onNavigate
        ? onNavigate(section, page)
        : writeNavigationLocation(section, page),
    );
  const rows = selectWorkRows(
    feed.data?.rows || [],
    destination,
    filters.date,
    filters.query,
    filters.workspace,
    filters.recent,
  );
  const partial = !!feed.data?.issues.length;
  const reportPage = role === "head" ? "Reports" : "Work Report";
  return (
    <section className="r10-workspace" aria-label="My Work">
      <WorkspaceHeader
        title="My Work"
        description="Your work across accessible Office and personal workspaces. Workspace selection does not limit this feed."
        actions={
          <>
            <button
              type="button"
              disabled={feed.loading}
              onClick={() => void feed.refresh()}
            >
              Refresh work
            </button>
            <ActionMenu
              tooltip="Retained personal tools"
              trigger={<button type="button">Work tools</button>}
              actions={[
                {
                  id: "inbox",
                  label: "Open Inbox",
                  onSelect: () => navigate("inbox", "Inbox"),
                },
                ...(can("navigation.tasks")
                  ? [
                      {
                        id: "tasks",
                        label:
                          role === "head"
                            ? "Office task board"
                            : "Task workspace",
                        onSelect: () =>
                          navigate(
                            "tasks",
                            role === "head" ? "Task Board" : "My Tasks",
                          ),
                      },
                    ]
                  : []),
                ...(role !== "head" && can("navigation.tasks")
                  ? [
                      {
                        id: "deadlines",
                        label: "Deadline calendar",
                        onSelect: () => navigate("deadlines", "Deadlines"),
                      },
                    ]
                  : []),
                ...(can("navigation.reports")
                  ? [
                      {
                        id: "reports",
                        label: reportPage,
                        onSelect: () => navigate("reports", reportPage),
                      },
                    ]
                  : []),
                ...(role !== "head" && can("navigation.reports")
                  ? [
                      {
                        id: "performance",
                        label: "Performance",
                        onSelect: () => navigate("performance", "Performance"),
                      },
                    ]
                  : []),
                ...(role !== "head" && can("navigation.tasks")
                  ? [
                      {
                        id: "history",
                        label: "Task history details",
                        onSelect: () => navigate("history", "Task History"),
                      },
                    ]
                  : []),
              ]}
            />
          </>
        }
      />
      <nav className="r10-destinations" aria-label="My Work destinations">
        {workDestinations.map((value) => (
          <button
            type="button"
            key={value}
            aria-current={destination === value ? "page" : undefined}
            onClick={() => navigate("personal_work", value)}
          >
            {value}
          </button>
        ))}
      </nav>
      <div className="r10-toolbar">
        <label>
          Search work
          <input
            id="personal-work-search"
            aria-label="Search personal work"
            type="search"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
          />
        </label>
        <label>
          Workspace scope
          <select
            value={filters.workspace}
            onChange={(e) => update({ workspace: e.target.value })}
          >
            <option value="">All accessible workspaces</option>
            {feed.data?.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {filters.query && (
          <button type="button" onClick={() => update({ query: "" })}>
            Clear search
          </button>
        )}
      </div>
      <div
        className="r10-date-filters"
        role="group"
        aria-label="Work date filters"
      >
        {dateFilters.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={filters.date === value}
            onClick={() => update({ date: value })}
          >
            {value}
          </button>
        ))}
        {destination === "History" && (
          <label>
            <input
              type="checkbox"
              checked={filters.recent}
              onChange={(e) => update({ recent: e.target.checked })}
            />
            Recently completed · last 7 days by last update
          </label>
        )}
      </div>
      <p className="r10-help">
        Dates use each work item's workspace timezone. History includes
        authorized completed, cancelled and archived work; personal completion
        dates are unavailable.
      </p>
      {feed.error && (
        <FeedbackState
          tone="error"
          title="My Work could not be loaded"
          onRetry={() => void feed.refresh()}
        >
          {feed.error}
        </FeedbackState>
      )}
      {partial && (
        <div role="alert">
          <strong>
            Some work sources are unavailable. Counts cover loaded sources.
          </strong>
          <ul>
            {feed.data?.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
          <button type="button" onClick={() => void feed.refresh()}>
            Retry work sources
          </button>
        </div>
      )}
      {feed.data?.unavailable.map((notice, i) => (
        <p role="status" key={i}>
          {notice}
        </p>
      ))}
      {feed.loading && !feed.data ? (
        <p role="status">Loading your work…</p>
      ) : (
        <>
          <p role="status">
            {rows.length} {partial ? "loaded " : ""}items · {destination} ·{" "}
            {filters.date}
            {feed.loading ? " · Refreshing access…" : ""}
          </p>
          {rows.length ? (
            <WorkList rows={rows} onOpen={inspector.open} />
          ) : (
            <FeedbackState
              title={
                filters.query ? "No matching work" : "No work in this view"
              }
            >
              Choose another destination, date filter or workspace. Review and
              invitation actions are in Inbox and Members.
            </FeedbackState>
          )}
        </>
      )}
      <WorkInspector
        selected={inspector.selection}
        current={feed.data?.rows || []}
        onClose={inspector.close}
      />
    </section>
  );
}
