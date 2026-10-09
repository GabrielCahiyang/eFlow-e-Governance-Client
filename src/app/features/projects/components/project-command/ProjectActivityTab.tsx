import { useEffect, useRef, useState } from "react";
import { Button } from "../../../../components/ui/button";
import {
  EmptyWorkspaceState,
  StatusPill,
  WorkspaceHeader,
  WorkspaceSkeleton,
} from "../../../../components/ui/workspace";
import { useAuth } from "../../../../contexts/AuthContext";
import { useWorkspaceScope } from "../../../workspaces";
import {
  DEFAULT_ACTIVITY_FILTERS,
  type ActivityFilters,
} from "../../activity/types";
import { useActivityPage } from "../../activity/useActivityPage";
import { fetchActivityPrint } from "../../activity/activityService";
import {
  buildActivityPrint,
  formatActivityTime,
} from "../../activity/activityPrint";
import { ActivityPrintPreview } from "../../activity/ActivityPrintPreview";
import { ActivityFilterControls } from "../../activity/ActivityFilterControls";
import type { ProjectCommandData } from "./types";
import "../../../../components/ui/workspace/analyticalWorkspace.css";

export function ProjectActivityTab({ data }: { data: ProjectCommandData }) {
  return (
    <ProjectActivityHistory
      projectId={data.project.id}
      title={data.project.title}
    />
  );
}
export function ProjectActivityHistory({
  projectId,
  title,
}: {
  projectId: string;
  title: string;
}) {
  const { user } = useAuth();
  const context = useWorkspaceScope();
  return (
    <Activity
      key={`${user?.id}:${context?.workspace.id}:${projectId}`}
      data={{ project: { id: projectId, title } }}
      workspace={context?.workspace.name || "Office project"}
      timezone={
        context?.workspace.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    />
  );
}
function Activity({
  data,
  workspace,
  timezone,
}: {
  data: { project: { id: string; title: string } };
  workspace: string;
  timezone: string;
}) {
  const [filters, setFilters] = useState<ActivityFilters>({
      ...DEFAULT_ACTIVITY_FILTERS,
      timezone,
    }),
    [size, setSize] = useState(25);
  const history = useActivityPage(data.project.id, filters, size);
  const [scope, setScope] = useState<"all" | "page">("all"),
    [printing, setPrinting] = useState(false),
    [printStatus, setPrintStatus] = useState(""),
    [printError, setPrintError] = useState(""),
    [preview, setPreview] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setPrinting(false);
      setPreview("");
    };
    window.addEventListener("eflow-project-access-changed", clear);
    window.addEventListener("focus", clear);
    return () => {
      clear();
      window.removeEventListener("eflow-project-access-changed", clear);
      window.removeEventListener("focus", clear);
    };
  }, []);
  useEffect(() => {
    if (!history.data) return;
    const timer = window.setTimeout(
      () => {
        generation.current++;
        setPreview("");
        history.refresh();
      },
      Math.max(0, Date.parse(history.data.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [history.data?.snapshot]);
  useEffect(() => {
    if (history.error) {
      generation.current++;
      setPrinting(false);
      setPreview("");
    }
  }, [history.error]);
  const change = (patch: Partial<ActivityFilters>) => {
    generation.current++;
    setPrinting(false);
    setPreview("");
    setPrintError("");
    setFilters((prior) => ({ ...prior, ...patch }));
  };
  const prepare = async () => {
    if (!history.data) return;
    const revision = ++generation.current;
    setPrinting(true);
    setPrintError("");
    setPreview("");
    try {
      const rows = await fetchActivityPrint(
        data.project.id,
        filters,
        history.data,
        scope,
        (loaded, total) => {
          if (revision === generation.current)
            setPrintStatus(`Preparing ${loaded} of ${total} events…`);
        },
      );
      if (revision === generation.current)
        setPreview(
          buildActivityPrint(
            rows,
            data.project.title,
            workspace,
            timezone,
            filters,
            history.data,
            scope,
          ),
        );
    } catch (error) {
      if (revision === generation.current)
        setPrintError(
          `Print preparation failed; no partial document was created. ${error instanceof Error ? error.message : ""}`,
        );
    } finally {
      if (revision === generation.current) {
        setPrinting(false);
        setPrintStatus("");
      }
    }
  };
  return (
    <section
      className="eflow-analytics eflow-activity"
      aria-label="Project activity"
    >
      <WorkspaceHeader
        title="Project activity"
        description="Authorized audit, status, progress, review and delegation history."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              generation.current++;
              setPrinting(false);
              setPreview("");
              history.refresh();
            }}
          >
            Refresh history
          </Button>
        }
      />
      <ActivityFilterControls
        filters={filters}
        size={size}
        onChange={change}
        onSize={(value) => {
          generation.current++;
          setPreview("");
          setPrinting(false);
          setSize(value);
        }}
      />
      <p className="eflow-analytics-caption">
        {workspace} · {timezone}. History is frozen until Refresh history; new
        events appear on refresh.
      </p>
      {history.loading && (
        <WorkspaceSkeleton label="Loading activity history" />
      )}
      {history.error && (
        <div className="eflow-analytics-error" role="alert">
          {history.error}
          <Button variant="outline" onClick={history.retry}>
            Retry history
          </Button>
          <Button variant="ghost" onClick={history.refresh}>
            Start fresh history
          </Button>
        </div>
      )}
      {history.data && (
        <>
          <div
            className="eflow-analytics-table"
            role="region"
            aria-label="Activity events"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Type</th>
                  <th>Occurred ({timezone})</th>
                </tr>
              </thead>
              <tbody>
                {history.data.events.map((item) => (
                  <tr key={item.id} data-event-id={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </td>
                    <td>{item.actorName}</td>
                    <td>
                      <StatusPill
                        label={
                          item.kind === "submission" ? "Review" : item.kind
                        }
                        tone={
                          item.kind === "submission" ? "warning" : "neutral"
                        }
                      />
                    </td>
                    <td>
                      <time dateTime={new Date(item.occurredAt).toISOString()}>
                        {formatActivityTime(item.occurredAt, timezone)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.data.events.length && (
            <EmptyWorkspaceState
              title="No activity matches these filters"
              description="Change the search, type or dates to see other events."
            />
          )}
          <footer className="eflow-analytics-pagination">
            <p role="status">
              {history.data.total
                ? `${history.data.page * size + 1}–${history.data.page * size + history.data.events.length} of ${history.data.total} events`
                : "0 matching events"}{" "}
              · Page {history.data.page + 1}
            </p>
            <Button
              variant="outline"
              disabled={history.data.page === 0}
              onClick={() => {
                generation.current++;
                setPrinting(false);
                setPreview("");
                history.go(history.data!.page - 1);
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!history.data.more}
              onClick={() => {
                generation.current++;
                setPrinting(false);
                setPreview("");
                history.go(history.data!.page + 1);
              }}
            >
              Next
            </Button>
          </footer>
          <div className="eflow-analytics-filters">
            <label>
              Print scope
              <select
                className="eflow-control"
                value={scope}
                onChange={(e) => {
                  generation.current++;
                  setPrinting(false);
                  setPreview("");
                  setScope(e.target.value as "all" | "page");
                }}
              >
                <option value="all">All matching events</option>
                <option value="page">Current page only</option>
              </select>
            </label>
            <Button disabled={printing} onClick={() => void prepare()}>
              Prepare print
            </Button>
            {printing && (
              <p role="status">{printStatus || "Preparing history…"}</p>
            )}
          </div>
        </>
      )}
      {printError && (
        <p role="alert" className="eflow-analytics-error">
          {printError}
        </p>
      )}
      {preview && (
        <ActivityPrintPreview html={preview} onClose={() => setPreview("")} />
      )}
    </section>
  );
}
