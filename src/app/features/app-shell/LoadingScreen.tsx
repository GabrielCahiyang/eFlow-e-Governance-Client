import { EFlowMark } from "../../../components/EFlowMark";

export function LoadingScreen() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading eFlow"
      className="eflow-loading"
    >
      <div className="eflow-loading-content" role="status" aria-live="polite">
        <div className="eflow-loading-logo"><EFlowMark height={58} state="submitting" /></div>
        <h1>Getting things ready</h1>
        <div className="eflow-loading-track" aria-hidden="true"><span /></div>
      </div>
    </main>
  );
}
