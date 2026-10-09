import { useEffect, useState } from "react";
import { controlPanelFetch } from "../../../shared/controlPanelClient";
import { Button } from "../../../components/ui/button";
import {
  WorkspaceHeader,
  WorkspaceSkeleton,
  StatusPill,
} from "../../../components/ui/workspace";
type HealthEntry = {
  state: string;
  hint: string;
  senderDomain?: string | null;
  restrictedTestSender?: boolean;
  providerVerification?: string;
  origin?: string | null;
  ttlHours?: number;
};
type Health = {
  invitations: HealthEntry;
  notificationSmtp: HealthEntry;
  authSmtp: HealthEntry;
  redirect: HealthEntry;
  scope: string;
};
export function EmailIntegrations() {
  const [state, setState] = useState<{
      loading: boolean;
      data?: Health;
      error?: string;
    }>({ loading: true }),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ loading: true });
    void controlPanelFetch(
      "admin/configuration-health",
      {},
      { retryOnEndpointChange: false },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Configuration health is unavailable. Admin access and the R12 gateway endpoint are required.",
          );
        const data = await response.json();
        if (
          !data?.invitations?.state ||
          !data?.notificationSmtp?.state ||
          !data?.authSmtp?.state ||
          !data?.redirect?.state
        )
          throw new Error(
            "Configuration health response could not be verified.",
          );
        if (live) setState({ loading: false, data });
      })
      .catch((reason) => {
        if (live)
          setState({
            loading: false,
            error:
              `Configuration health is unavailable. ${reason instanceof Error ? reason.message : "Retry the gateway diagnostic."}`,
          });
      });
    return () => {
      live = false;
    };
  }, [revision]);
  return (
    <section className="eflow-admin-configuration">
      <WorkspaceHeader
        title="Email & integrations"
        description="Separate delivery channels, configuration presence and operator actions. Refresh never sends email."
        actions={
          <Button
            variant="outline"
            disabled={state.loading}
            onClick={() => setRevision((x) => x + 1)}
          >
            Refresh delivery health
          </Button>
        }
      />
      {state.loading ? (
        <WorkspaceSkeleton label="Loading delivery configuration" />
      ) : state.error ? (
        <div role="alert" className="eflow-analytics-error">
          {state.error}
        </div>
      ) : (
        state.data && (
          <>
            <p>{state.data.scope}</p>
            <div className="eflow-admin-health-grid">
              {(
                [
                  ["invitations", "Application invitations (Resend)"],
                  ["notificationSmtp", "Notification SMTP"],
                  ["authSmtp", "Supabase Auth SMTP"],
                  ["redirect", "Invitation app redirect"],
                ] as const
              ).map(([key, title]) => {
                const item = state.data![key];
                return (
                  <article className="eflow-admin-card" key={key}>
                    <h2>{title}</h2>
                    <StatusPill
                      label={item.state}
                      tone={
                        item.state === "configured" ? "positive" : "neutral"
                      }
                    />
                    {item.senderDomain && (
                      <p>Sender domain: {item.senderDomain}</p>
                    )}
                    {item.restrictedTestSender && (
                      <p role="status">
                        Restricted rehearsal sender. Production recipients
                        require a verified domain.
                      </p>
                    )}
                    {item.origin && <p>Application origin: {item.origin}</p>}
                    {item.ttlHours && (
                      <p>New invitation expiry: {item.ttlHours} hours</p>
                    )}
                    {item.providerVerification && (
                      <p>Provider verification: {item.providerVerification}</p>
                    )}
                    <p>{item.hint}</p>
                  </article>
                );
              })}
            </div>
            <p>
              For a failed R8 delivery, retain the invitation request ID and
              safe error, then ask the operator to check the gateway and Resend
              logs. Retry from Members only after resolving the reported cause;
              an accepted offer is not sent again.
            </p>
          </>
        )
      )}
    </section>
  );
}
