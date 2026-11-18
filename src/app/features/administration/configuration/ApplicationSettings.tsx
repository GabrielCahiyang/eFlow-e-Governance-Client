import { Building2, CalendarClock, Globe, Info, MailCheck, RotateCcw } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import { useApplicationSettingsForm } from "./useApplicationSettingsForm";
import { requestNavigation } from "../../../shared/navigationGuard";

function ApplicationSettingsFormSkeleton() {
  return (
    <div
      className="eflow-admin-settings-form"
      role="status"
      aria-label="Loading application settings"
    >
      <span className="sr-only">Loading application settings</span>
      <div aria-hidden="true" className="eflow-admin-card space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-36 animate-pulse rounded bg-neutral-200/80" />
          <div className="h-10 w-full max-w-md animate-pulse rounded-lg border border-neutral-200 bg-neutral-100" />
          <div className="h-3 w-72 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="eflow-admin-actions">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-neutral-200/80" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}

export function ApplicationSettings({ embedded = false }: { embedded?: boolean }) {
  const { user, can } = useAuth();
  return (
    <SettingsForm
      key={user?.id || "unassigned"}
      canManage={can("settings.manage")}
      embedded={embedded}
    />
  );
}

function SettingsForm({ canManage, embedded }: { canManage: boolean; embedded: boolean }) {
  const {
    saved,
    form,
    setForm,
    loginBranding,
    setLoginBranding,
    loading,
    pending,
    error,
    receipt,
    uncertain,
    dirty,
    load,
    save,
    resetDraft,
  } = useApplicationSettingsForm(canManage);

  const locked = !canManage || pending || uncertain;

  return (
    <div className="eflow-admin-configuration">
      {!embedded && (
        <WorkspaceHeader
          title="General settings"
          description="Manage organization branding, invitation defaults, deadline rules, and maintenance notices."
        />
      )}
      {loading ? (
        <ApplicationSettingsFormSkeleton />
      ) : (
        <>
          {error && (
            <FeedbackState tone="error" title="Could not update settings">
              {error}
            </FeedbackState>
          )}
          {receipt && (
            <FeedbackState tone="success" title="Settings updated">
              {receipt}
            </FeedbackState>
          )}
          {!saved ? (
            <div className="eflow-admin-card space-y-3">
              <p className="text-sm text-[var(--eflow-text-muted)]">
                Organization settings could not be loaded.
              </p>
              <Button variant="outline" onClick={() => void load()}>
                Retry settings
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="space-y-4"
            >
              <div className="eflow-admin-card eflow-admin-settings-form">
                <div className="eflow-admin-card__title-row">
                  <span className="eflow-admin-icon-chip" aria-hidden="true">
                    <Building2 size={16} />
                  </span>
                  <div>
                    <h2>System branding &amp; export header</h2>
                    <p className="eflow-admin-copy">
                      Shown in the top navigation bar, exported CSV/PDF report headers, and invitation emails.
                    </p>
                  </div>
                </div>

                <label>
                  Organization Name
                  <input
                    maxLength={120}
                    required
                    disabled={locked}
                    value={form.organization_name}
                    onChange={(e) =>
                      setForm({ ...form, organization_name: e.target.value })
                    }
                  />
                  <small>
                    Shown in the top navigation bar, exported CSV/PDF report headers, and invitation emails.
                  </small>
                </label>

                <label>
                  Header Subtitle
                  <input
                    maxLength={160}
                    disabled={locked}
                    placeholder="e.g., Investment Promotion & Economic Development Office"
                    value={form.organization_subtitle}
                    onChange={(e) =>
                      setForm({ ...form, organization_subtitle: e.target.value })
                    }
                  />
                  <small>
                    Optional subtitle shown in exported report headers and emails.
                  </small>
                </label>
              </div>

              <div className="eflow-admin-card eflow-admin-settings-form">
                <div className="eflow-admin-card__title-row">
                  <span className="eflow-admin-icon-chip" aria-hidden="true">
                    <Globe size={16} />
                  </span>
                  <div>
                    <h2>Sign-in screen branding</h2>
                    <p className="eflow-admin-copy">
                      Customize the organization title beside the eFlow logo and the prompt text displayed on the public sign-in page.
                    </p>
                  </div>
                </div>

                <label>
                  Sign-in Organization Label
                  <input
                    maxLength={120}
                    required
                    disabled={locked}
                    placeholder="LGU Ormoc City"
                    value={loginBranding.login_portal_title}
                    onChange={(e) =>
                      setLoginBranding({
                        ...loginBranding,
                        login_portal_title: e.target.value,
                      })
                    }
                  />
                  <small>
                    Displayed next to the eFlow logo on the sign-in screen (default: “LGU Ormoc City”).
                  </small>
                </label>

                <label>
                  Sign-in Prompt Text
                  <input
                    maxLength={160}
                    required
                    disabled={locked}
                    placeholder="Use your official LGU account."
                    value={loginBranding.login_portal_subtitle}
                    onChange={(e) =>
                      setLoginBranding({
                        ...loginBranding,
                        login_portal_subtitle: e.target.value,
                      })
                    }
                  />
                  <small>
                    Displayed below “Sign in to eFlow” on the sign-in screen (default: “Use your official LGU account.”).
                  </small>
                </label>
              </div>

              <div className="eflow-admin-card eflow-admin-settings-form">
                <div className="eflow-admin-card__title-row">
                  <span className="eflow-admin-icon-chip" aria-hidden="true">
                    <MailCheck size={16} />
                  </span>
                  <div>
                    <h2>Account &amp; invitation defaults</h2>
                    <p className="eflow-admin-copy">
                      Configure activation link lifetime and starting notification preferences for new accounts.
                    </p>
                  </div>
                </div>

                <label>
                  Activation Link Expiry
                  <select
                    disabled={locked}
                    value={form.activation_expiry_hours}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        activation_expiry_hours: e.target.value as "24" | "72" | "168",
                      })
                    }
                  >
                    <option value="24">24 hours</option>
                    <option value="72">3 days (72 hours)</option>
                    <option value="168">7 days (168 hours)</option>
                  </select>
                  <small>
                    Controls how long new email activation links stay valid before needing a resend.
                  </small>
                </label>

                <label className="eflow-admin-checkbox-row">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={form.default_email_notifications_enabled === "true"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        default_email_notifications_enabled: e.target.checked
                          ? "true"
                          : "false",
                      })
                    }
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-[var(--eflow-text)]">
                      Enable email notifications for newly activated accounts
                    </span>
                    <small>
                      Users can still change their own notification preferences in Account settings afterward.
                    </small>
                  </span>
                </label>
              </div>

              <div className="eflow-admin-card eflow-admin-settings-form">
                <div className="eflow-admin-card__title-row">
                  <span className="eflow-admin-icon-chip" aria-hidden="true">
                    <CalendarClock size={16} />
                  </span>
                  <div>
                    <h2>Work &amp; deadline rules</h2>
                    <p className="eflow-admin-copy">
                      Controls when upcoming project, task, and subtask deadlines switch to “Due soon”.
                    </p>
                  </div>
                </div>

                <label>
                  “Due soon” Warning Window
                  <select
                    disabled={locked}
                    value={form.due_soon_days}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        due_soon_days: e.target.value as "1" | "2" | "3" | "5" | "7",
                      })
                    }
                  >
                    <option value="1">1 day before due date</option>
                    <option value="2">2 days before due date</option>
                    <option value="3">3 days before due date</option>
                    <option value="5">5 days before due date</option>
                    <option value="7">7 days before due date</option>
                  </select>
                </label>
              </div>

              <div className="eflow-admin-card eflow-admin-settings-form">
                <div className="eflow-admin-actions pt-1">
                  <Button
                    type="submit"
                    disabled={!canManage || pending || (!dirty && !uncertain)}
                  >
                    {pending
                      ? "Saving…"
                      : uncertain
                        ? "Verify settings save"
                        : "Save Settings"}
                  </Button>
                  {!pending && (dirty || uncertain) && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uncertain}
                      onClick={resetDraft}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Reset draft
                    </Button>
                  )}
                  {!pending && !uncertain && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void requestNavigation(() => void load())}
                    >
                      Reload settings
                    </Button>
                  )}
                </div>
                {uncertain && (
                  <FeedbackState tone="warning" title="Confirming save">
                    Connection was interrupted while saving. Use Verify settings save to confirm whether the change succeeded.
                  </FeedbackState>
                )}
                {!canManage && (
                  <p className="eflow-admin-note">
                    <Info size={14} aria-hidden="true" />
                    <span>Read-only view. Your account needs settings management permission to save changes.</span>
                  </p>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
