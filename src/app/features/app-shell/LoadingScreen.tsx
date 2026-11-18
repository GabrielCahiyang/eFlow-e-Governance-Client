import { EFlowMark } from "../../../components/EFlowMark";
import { SignalBarsIcon } from "../../components/ui/SignalBarsIcon";
import { useNetworkConnectivity } from "../../shared/networkConnectivity";
import "./loadingScreen.css";

export function LoadingScreen() {
  const { status: effectiveStatus, checking, retry } = useNetworkConnectivity();

  const offline = effectiveStatus === "offline";
  const slow = effectiveStatus === "slow";
  const heading = offline
    ? "No internet connection"
    : slow
      ? "Slow internet connection"
      : "Getting things done";

  const rootClass =
    effectiveStatus === "online"
      ? "eflow-loading"
      : `eflow-loading eflow-loading--${effectiveStatus}`;

  return (
    <main
      aria-busy={!offline}
      aria-label={offline ? "No internet connection" : slow ? "Slow internet connection" : "Loading eFlow"}
      className={rootClass}
    >
      <div className="eflow-loading-content" role="status" aria-live="polite">
        <div className="eflow-loading-logo">
          <EFlowMark height={58} state={offline ? "idle" : "submitting"} />
        </div>
        {effectiveStatus !== "online" && (
          <div className={`eflow-loading__signal eflow-loading__signal--${effectiveStatus}`}>
            <SignalBarsIcon status={effectiveStatus} />
            <span>{offline ? "No internet" : "Slow internet"}</span>
          </div>
        )}
        <h1>{heading}</h1>
        {offline && (
          <p className="eflow-loading__detail">
            Check your internet connection. eFlow will resume automatically once you are back online.
          </p>
        )}
        {slow && (
          <p className="eflow-loading__detail">
            Still getting things done — your connection is taking longer than usual.
          </p>
        )}
        <div className="eflow-loading-track" aria-hidden="true"><span /></div>
        {offline && (
          <button
            type="button"
            className="eflow-loading__retry"
            disabled={checking}
            onClick={() => {
              void retry();
            }}
          >
            {checking ? "Checking connection…" : "Retry"}
          </button>
        )}
      </div>
    </main>
  );
}
