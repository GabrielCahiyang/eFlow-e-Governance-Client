import { Tooltip } from "@vibe/core";
import { SignalBarsIcon } from "../../../components/ui/SignalBarsIcon";
import type { ConnectivityStatus } from "../../../shared/networkConnectivity";

interface ConnectivitySignalProps {
  status: ConnectivityStatus;
  checking: boolean;
  onRetry: () => void;
}

/**
 * Top-bar connectivity indicator aligned with Vibe's flat 5px-radius status tags.
 * Renders beside Help only when connectivity is degraded or lost.
 */
export function ConnectivitySignal({
  status,
  checking,
  onRetry,
}: ConnectivitySignalProps) {
  if (status === "online") return null;

  const isOffline = status === "offline";
  const isServerDown = status === "server_down";
  const label = checking
    ? "Checking…"
    : isOffline
      ? "No internet"
      : isServerDown
        ? "Server down or lagging"
        : "Slow internet";
  const tooltip = isOffline
    ? "No internet connection. Click to retry."
    : isServerDown
      ? "Server is down or lagging. Click to retry."
      : "Slow internet connection detected. Click to re-check.";

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        role="status"
        aria-live="polite"
        aria-label={tooltip}
        disabled={checking}
        onClick={onRetry}
        className={`eflow-topbar__connectivity eflow-topbar__connectivity--${status}`}
      >
        <SignalBarsIcon status={status} />
        <span className="eflow-topbar__connectivity-label">{label}</span>
      </button>
    </Tooltip>
  );
}
