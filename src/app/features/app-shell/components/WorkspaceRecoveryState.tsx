import { useState } from "react";
import { AlertCircle, FolderOpen } from "lucide-react";
import { SignalBarsIcon } from "../../../components/ui/SignalBarsIcon";
import { useNetworkConnectivity } from "../../../shared/networkConnectivity";
import {
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  userFacingError,
} from "../../../shared/userFacingError";

interface WorkspaceRecoveryStateProps {
  error?: string;
  onRetry: () => Promise<void> | void;
}

/**
 * Clean Vibe recovery card shown inside the workspace frame when workspace
 * loading fails (e.g., offline / network failure) or no workspace is selected.
 */
export function WorkspaceRecoveryState({
  error,
  onRetry,
}: WorkspaceRecoveryStateProps) {
  const { isOffline, retry: retryConnectivity } = useNetworkConnectivity();
  const [retrying, setRetrying] = useState(false);

  const networkIssue = isOffline || (Boolean(error) && isNetworkError(error));
  const hasError = Boolean(error) || isOffline;

  const badgeLabel = networkIssue
    ? "No internet"
    : hasError
      ? "Workspace unavailable"
      : "Workspace required";

  const title = networkIssue
    ? "No internet connection"
    : hasError
      ? "Could not load workspace"
      : "Select or create a workspace";

  const message = networkIssue
    ? NETWORK_ERROR_MESSAGE
    : error
      ? userFacingError(error, "Could not load workspaces.")
      : "Create or select a workspace to continue.";

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retryConnectivity();
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <section
      className={`eflow-workspace eflow-workspace-recovery ${
        networkIssue ? "eflow-workspace-recovery--offline" : ""
      }`}
      role={hasError ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="eflow-workspace-recovery__card">
        <span
          className={`eflow-workspace-recovery__tag ${
            hasError
              ? "eflow-workspace-recovery__tag--negative"
              : "eflow-workspace-recovery__tag--neutral"
          }`}
        >
          {networkIssue ? (
            <SignalBarsIcon status="offline" size={14} />
          ) : hasError ? (
            <AlertCircle size={14} aria-hidden="true" />
          ) : (
            <FolderOpen size={14} aria-hidden="true" />
          )}
          <span>{badgeLabel}</span>
        </span>
        <h2 className="eflow-workspace-recovery__title">{title}</h2>
        <p className="eflow-workspace-recovery__message">{message}</p>
        <div className="eflow-workspace-recovery__actions">
          <button
            type="button"
            className="eflow-workspace-recovery__retry"
            disabled={retrying}
            onClick={() => {
              void handleRetry();
            }}
          >
            {retrying ? "Retrying…" : "Retry workspace"}
          </button>
        </div>
      </div>
    </section>
  );
}
