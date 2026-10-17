import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import { Button } from "../../../components/ui/button";
import { RefreshCw } from "lucide-react";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { requestNavigation } from "../../../shared/navigationGuard";
import {
  NAVIGATION_LOCATION_EVENT,
  pushNavigationHistory,
} from "../../../shared/navigationHistory";
import { writeNavigationLocation, buildShellNavigation, getSidebarContent, PersonalWorkTools } from "../../navigation";
import { useWorkFeed } from "../hooks/useWorkFeed";
import { workDestinations, type WorkDestination } from "../types";
import { selectWorkRows } from "../workSelectors";
import { WorkList } from "./WorkList";
import { WorkInspector, useWorkInspector } from "./WorkInspector";
import { WorkFilters } from "./WorkFilters";
import "../personalWork.css";
import { readWorkFilters as readFilters } from "../workLocation";
export function PersonalWorkWorkspace({
  page = "Assigned work",
  onNavigate,
  hasLeadingWork,
}: {
  page?: string;
  onNavigate?: (section: string, page: string) => void;
  hasLeadingWork?: boolean;
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
      hasLeadingWork={hasLeadingWork}
    />
  );
}
function PersonalWorkContent({
  userId,
  role,
  page,
  can,
  onNavigate,
  hasLeadingWork,
}: {
  userId: string;
  role: string;
  page: string;
  can: (permission: string) => boolean;
  onNavigate?: (section: string, page: string) => void;
  hasLeadingWork?: boolean;
}) {
  const feed = useWorkFeed(userId);
  const inspector = useWorkInspector(page);
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
  const navigate = (section: string, page: string) => {
    if (onNavigate) onNavigate(section, page);
    else void requestNavigation(() => writeNavigationLocation(section, page));
  };
  const rows = selectWorkRows(
    feed.data?.rows || [],
    destination,
    filters.date,
    filters.query,
    filters.workspace,
    filters.recent,
  );
  const partial = !!feed.data?.issues.length;
  const navigationItems = buildShellNavigation({ role, can, hasLeadingWork: hasLeadingWork ?? !!feed.data?.rows.some(row => row.leading && row.actionable) });
  const destinations = getSidebarContent(role, 'personal_work').sections.flatMap(section => section.items);
  const taskPageOpen=inspector.selection?.row.kind==='office-task';
  return (
    <section className="r10-workspace" aria-label="My Work">
      <div className="r10-work-list-view" hidden={taskPageOpen}>
      <WorkspaceHeader
        title="My Work"
        description="Tasks and subitems across your accessible workspaces."
        actions={
            <Button
              type="button"
              variant="outline"
              disabled={feed.loading}
              onClick={() => void feed.refresh()}
            >
              <RefreshCw size={16} aria-hidden="true" />Refresh work
            </Button>
        }
      />
      <div className="r10-destination-host">
      <nav className="r10-destinations" aria-label="My Work destinations">
        {destinations.map(({ label: value }) => (
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
      <PersonalWorkTools items={navigationItems} destination={destination} onSelect={navigate} />
      </div>
      <WorkFilters filters={filters} destination={destination} workspaces={feed.data?.workspaces || []} onChange={update} />
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
          <p role="status" className="r10-result-count">
            {rows.length} {partial ? "loaded " : ""}items · {destination}
            {feed.loading ? " · Refreshing access…" : ""}
          </p>
          {rows.length ? (
            <WorkList rows={rows} onOpen={inspector.open} />
          ) : (
            <FeedbackState
              title={
                filters.query || filters.date !== 'All my work' || filters.workspace || destination === 'History' && filters.recent ? "No matching work" : "No work in this view"
              }
            >
              {filters.query || filters.date !== 'All my work' || filters.workspace || destination === 'History' && filters.recent ? <><p>Try a different search or filter.</p><Button type="button" variant="outline" onClick={() => update({ query: '', date: 'All my work', workspace: '', recent: false })}>Clear search and filters</Button></> : 'Assigned tasks and subitems will appear here when they are available to you.'}
            </FeedbackState>
          )}
        </>
      )}
      </div>
      <WorkInspector
        presentation={taskPageOpen?'page':'drawer'}
        selected={inspector.selection}
        current={feed.data?.rows || []}
        onClose={inspector.close}
      />
    </section>
  );
}
