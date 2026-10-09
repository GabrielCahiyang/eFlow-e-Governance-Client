import { useAuth } from "../../../contexts/AuthContext";
import { Button } from "../../../components/ui/button";
import {
  WorkspaceHeader,
  WorkspaceSkeleton,
} from "../../../components/ui/workspace";
import { ConfigurationMatrix } from "./ConfigurationMatrix";
import { useApplicationSettingsForm } from "./useApplicationSettingsForm";
import { requestNavigation } from "../../../shared/navigationGuard";
export function ApplicationSettings() {
  const { user, can } = useAuth();
  return (
    <SettingsForm
      key={user?.id || "unassigned"}
      canManage={can("settings.manage")}
    />
  );
}
function SettingsForm({ canManage }: { canManage: boolean }) {
  const {
    saved,
    form,
    setForm,
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
  return (
    <div className="eflow-admin-configuration">
      <WorkspaceHeader
        title="System Settings"
        description="Application presentation settings. Sessions, workspace calendars and provider policies have separate authorities."
      />
      {loading ? (
        <WorkspaceSkeleton label="Loading application settings" />
      ) : (
        <>
          {error && (
            <div className="eflow-analytics-error" role="alert">
              {error}
            </div>
          )}
          {receipt && <p role="status">{receipt}</p>}
          {!saved ? (
            <Button onClick={() => void load()}>Retry settings</Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="eflow-admin-settings-form"
            >
              <label>
                Organization Name
                <input
                  maxLength={120}
                  required
                  disabled={!canManage || pending || uncertain}
                  value={form.organization_name || ""}
                  onChange={(e) =>
                    setForm({ ...form, organization_name: e.target.value })
                  }
                />
                <small>
                  Workspace utility-bar branding; Office names and appointments
                  are unchanged.
                </small>
              </label>
              <label>
                Version String
                <input
                  maxLength={40}
                  required
                  disabled={!canManage || pending || uncertain}
                  value={form.app_version || ""}
                  onChange={(e) =>
                    setForm({ ...form, app_version: e.target.value })
                  }
                />
                <small>
                  Displayed with the organization in the utility bar; does not
                  change deployed code.
                </small>
              </label>
              <div className="eflow-admin-actions">
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
                <p>
                  Saving was not confirmed. Verify with the same request before
                  editing or repeating a change. Navigation offers an explicit
                  discard.
                </p>
              )}
              {!canManage && (
                <p>
                  Read only. The settings.manage capability is required to save.
                </p>
              )}
            </form>
          )}
        </>
      )}
      <ConfigurationMatrix
        area="application"
        title="Application configuration status"
      />
    </div>
  );
}
