import { useEffect, useState } from "react";
import { Button as VibeButton } from "@vibe/core";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { EmptyState } from '../../../components/ui/EmptyState';
import { requestNavigation } from "../../../shared/navigationGuard";
import {
  NAVIGATION_LOCATION_EVENT,
  pushNavigationHistory,
} from "../../../shared/navigationHistory";
import { matchesWorkDate } from "../../../shared/workCalendar";
import { writeNavigationLocation, buildShellNavigation, getSidebarContent, PersonalWorkTools, pageDisplayLabel } from "../../navigation";
import { workStateLabel } from "../../work-state";
import { useWorkFeed } from "../hooks/useWorkFeed";
import { workDestinations, type WorkDestination } from "../types";
import { selectWorkRows } from "../workSelectors";
import { WorkList, WorkListSkeleton } from "./WorkList";
import { WorkInspector, useWorkInspector } from "./WorkInspector";
import { WorkFilters } from "./WorkFilters";
import { LeadingNotificationTarget } from './LeadingNotificationTarget';
import { AssignedSubtaskReviews } from './AssignedSubtaskReviews';
import "../personalWork.css";
import { readWorkFilters as readFilters } from "../workLocation";

const DESTINATION_META: Record<WorkDestination, { title: string; description: string }> = {
  'Assigned work': {
    title: 'Assigned work',
    description: 'Active tasks and deliverables assigned to you across accessible workspaces.',
  },
  Leading: {
    title: pageDisplayLabel('personal_work', 'Leading'),
    description: 'Tasks and subtasks you lead or supervise across your workspaces.',
  },
  Subtasks: {
    title: 'Subtasks',
    description: 'Assigned subtask steps grouped by project and parent task.',
  },
  Reviews: {
    title: 'Reviews',
    description: 'Subtask completion submissions and check-ins awaiting your decision.',
  },
  History: {
    title: 'History',
    description: 'Completed, cancelled, and archived work records across your workspaces.',
  },
};
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
  const [reviewRefreshTick, setReviewRefreshTick] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
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
        project: values.project,
        status: values.status,
        role: values.relation,
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
  const now = new Date();
  const baseRows =
    destination === "Reviews"
      ? []
      : selectWorkRows(feed.data?.rows || [], destination, "All my work", "", "", false, now);
  const projectOptions = Array.from(
    new Set(baseRows.map((row) => row.projectTitle).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const relationOptions = Array.from(
    new Set(baseRows.map((row) => row.relation).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const statusMap = new Map<string, string>();
  for (const row of baseRows) {
    const value = row.status === "in_progress" && row.blocker ? "stuck" : row.status;
    if (!statusMap.has(value)) {
      statusMap.set(value, workStateLabel(row.status, !!row.blocker));
    }
  }
  const statusOptions = Array.from(statusMap, ([value, label]) => ({ value, label }));
  const rows =
    destination === "Reviews"
      ? []
      : selectWorkRows(
          feed.data?.rows || [],
          destination,
          filters.date,
          filters.query,
          filters.workspace,
          filters.recent,
          now,
          {
            project: filters.project,
            status: filters.status,
            relation: filters.relation,
          },
        );
  const partial = !!feed.data?.issues.length;
  const navigationItems = buildShellNavigation({ role, can, hasLeadingWork: hasLeadingWork ?? !!feed.data?.rows.some(row => row.leading && row.actionable) });
  const destinations = getSidebarContent(role, 'personal_work').sections.flatMap(section => section.items);
  const meta = DESTINATION_META[destination];
  const itemWord = rows.length === 1 ? 'item' : 'items';
  const leadingReviewCount = destination === 'Leading' ? rows.filter(row => ['for_review', 'submitted'].includes(row.status)).length : 0;
  const leadingAttentionCount = destination === 'Leading' ? rows.filter(row => !!row.blocker || matchesWorkDate(row.due, 'Overdue', now, row.timezone)).length : 0;
  const filtered = !!(
    filters.query ||
    filters.date !== "All my work" ||
    filters.workspace ||
    filters.project ||
    filters.status ||
    filters.relation ||
    (destination === "History" && filters.recent)
  );
  return (
    <section className="r10-workspace" aria-label="My Work">
      <div className="r10-work-list-view">
      <WorkspaceHeader
        title={meta.title}
        description={meta.description}
        actions={
          <VibeButton
            kind="tertiary"
            size="small"
            disabled={destination === 'Reviews' ? reviewsLoading : feed.loading}
            onClick={() => {
              if (destination === 'Reviews') setReviewRefreshTick(value => value + 1);
              else void feed.refresh();
            }}
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span className="ml-1.5">{destination === 'Reviews' ? 'Refresh reviews' : 'Refresh work'}</span>
          </VibeButton>
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
            {pageDisplayLabel('personal_work', value)}
          </button>
        ))}
      </nav>
      <PersonalWorkTools role={role} items={navigationItems} destination={destination} onSelect={navigate} />
      </div>
      {destination === 'Reviews' ? <AssignedSubtaskReviews key={userId} actor={userId} refreshSignal={reviewRefreshTick} onLoadingChange={setReviewsLoading}/> : <>
      <WorkFilters
        filters={filters}
        destination={destination}
        workspaces={(feed.data?.workspaces || []).filter(item => item.kind === 'office')}
        projects={projectOptions}
        statuses={statusOptions}
        relations={relationOptions}
        onChange={update}
      />
      {feed.error && (
        <FeedbackState
          tone={feed.data ? "warning" : "error"}
          title={feed.data ? "My Work could not refresh" : "My Work could not be loaded"}
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
        <WorkListSkeleton rows={5} label="Loading your work…" statusText="Loading your work…" />
      ) : (
        <>
          {destination === 'Leading' && rows.length > 0 && (
            <div className="r10-leading-summary" aria-label="Work I lead overview">
              <div className="r10-leading-stat">
                <span>Active work led</span>
                <strong>{rows.length}</strong>
              </div>
              <div className="r10-leading-stat">
                <span>Waiting for review</span>
                <strong>{leadingReviewCount}</strong>
              </div>
              <div className={`r10-leading-stat ${leadingAttentionCount > 0 ? 'is-alert' : ''}`}>
                <span>Overdue or blocked</span>
                <strong>{leadingAttentionCount}</strong>
              </div>
            </div>
          )}
          <p role="status" className="r10-result-count">
            {rows.length} {partial ? `loaded ${itemWord}` : itemWord}
            {feed.loading ? " · Refreshing access…" : ""}
          </p>
          {rows.length ? (
            <WorkList
              rows={rows}
              onOpen={inspector.open}
              groupByParent={destination === 'Subtasks'}
              historyView={destination === 'History'}
            />
          ) : (
            !feed.error && <EmptyState size="page" illustration={filtered ? 'search' : 'tasks'}
              title={filtered ? 'No matching work' : 'No work in this view'}
              description={filtered ? 'Try a different search or filter.' : 'Assigned tasks and subitems will appear here when they are available to you.'}
              action={filtered ? <Button type="button" variant="outline" onClick={() => update({ query: '', date: 'All my work', workspace: '', project: '', status: '', relation: '', recent: false })}>Clear search and filters</Button> : undefined}
            />
          )}
        </>
      )}
      </>}
      </div>
      {(destination === 'Leading' || destination === 'Subtasks') && <LeadingNotificationTarget rows={feed.data?.rows || []}
        loading={feed.loading} onOpen={inspector.open} />}
      <WorkInspector
        presentation="dialog"
        selected={inspector.selection}
        current={feed.data?.rows || []}
        onClose={inspector.close}
      />
    </section>
  );
}
