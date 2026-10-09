import { useAiRuntimeStatus } from "../../ai";
import { StatusPill, WorkspaceHeader } from "../../../components/ui/workspace";
import { ConfigurationMatrix } from "./ConfigurationMatrix";
export function RuntimeHealth() {
  const runtime = useAiRuntimeStatus();
  let origin = "No verified endpoint origin";
  try {
    const url = new URL(runtime.endpoint);
    if (url.protocol === "https:" && !url.username && !url.password)
      origin = url.origin;
  } catch {
    /* Keep unavailable state. */
  }
  return (
    <section className="eflow-admin-configuration">
      <WorkspaceHeader
        title="Runtime / AI health"
        description="Read-only runtime publication. Gateway requests confirm actual availability."
      />
      <article className="eflow-admin-card">
        <h2>Automatically managed AI connection</h2>
        <StatusPill
          label={runtime.status}
          tone={runtime.status === "online" ? "positive" : "neutral"}
        />
        <p>{origin}</p>
        <p>
          The local runtime publisher owns endpoint, model and heartbeat. No
          endpoint or secret is editable here. For offline or restarting states,
          the operator checks the gateway and tunnel publisher before retrying
          work.
        </p>
      </article>
      <ConfigurationMatrix
        area="runtime"
        title="Runtime, audit and backup configuration"
      />
    </section>
  );
}
