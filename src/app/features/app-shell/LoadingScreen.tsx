import { EFlowMark } from "../../../components/EFlowMark";

export function LoadingScreen() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading eFlow"
      className="eflow-loading"
    >
      <div className="eflow-loading-content">
        <div className="eflow-loading-logo"><EFlowMark height={58} state="submitting" /></div>
        <span className="eflow-loading-organization">LGU Ormoc City</span>
        <h1>Getting things ready</h1>
        <div className="eflow-loading-track" aria-hidden="true"><span /></div>
        <p role="status" aria-live="polite">Loading eFlow…</p>
      </div>
      <span className="eflow-loading-footer" aria-hidden="true">A little less busywork. A little more flow.</span>
    </main>
  );
}
