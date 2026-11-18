import { ProjectViewLoading } from "../../../../components/workflow/ProjectWorkspaceSkeleton";

export interface ProjectFlowGateNoticeProps {
  activeTabId: string;
  setupReady: boolean;
  flowLoading: boolean;
  flowDenied: boolean;
  hasFlowData: boolean;
  flowError: string;
  onRetry: () => Promise<void>;
  onOpenSettings: () => void;
}

/**
 * Displays setup, access-verification, or non-blocking refresh notices for a project workspace
 * without unmounting active work on transient project-flow errors.
 */
export function ProjectFlowGateNotice({
  activeTabId,
  setupReady,
  flowLoading,
  flowDenied,
  hasFlowData,
  flowError,
  onRetry,
  onOpenSettings,
}: ProjectFlowGateNoticeProps) {
  if (activeTabId === 'settings' || activeTabId === 'activity') return null;

  if (setupReady) {
    if (!flowError) return null;
    return (
      <div role="alert" className="pf-error items-center justify-between gap-3">
        <span>{flowError}</span>
        <button
          type="button"
          className="shrink-0 rounded-md border border-current px-2.5 py-1 text-xs font-medium"
          onClick={() => { void onRetry(); }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (flowDenied) {
    return (
      <section className="pf-panel" aria-live="polite">
        <h2>Project details unavailable</h2>
        <p>We could not verify access to this project right now.</p>
        {flowError && <div role="alert" className="pf-error">{flowError}</div>}
        <div className="pf-actions">
          <button type="button" className="pf-primary" onClick={() => { void onRetry(); }}>Retry</button>
        </div>
      </section>
    );
  }

  if (flowLoading) {
    return <ProjectViewLoading view={activeTabId} />;
  }

  if (flowError && !hasFlowData) {
    return (
      <section className="pf-panel" aria-live="polite">
        <h2>Couldn't load project setup</h2>
        <p>Project details could not be loaded right now. Retry before opening project tasks or people.</p>
        <div role="alert" className="pf-error">{flowError}</div>
        <div className="pf-actions">
          <button type="button" className="pf-primary" onClick={() => { void onRetry(); }}>Retry</button>
          <button type="button" onClick={onOpenSettings}>Open project details and funding</button>
        </div>
      </section>
    );
  }

  return (
    <section className="pf-panel">
      <h2>Finish project setup first</h2>
      <p>Define the project details, project lead, dates and funding before adding tasks, subtasks or people.</p>
      {flowError && <div role="alert" className="pf-error">{flowError}</div>}
      <button className="pf-primary" onClick={onOpenSettings}>Open project details and funding</button>
    </section>
  );
}
