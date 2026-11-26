import { useRef, useState } from "react";
import { Building2, CalendarClock, Clock3, Globe, Info, MailCheck, RotateCcw } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import {
  formatMinutesDuration,
  SESSION_IDLE_TIMEOUT_MAX_MINUTES,
  SESSION_IDLE_TIMEOUT_MIN_MINUTES,
  SESSION_WARNING_LEAD_MAX_MINUTES,
  SESSION_WARNING_LEAD_MIN_MINUTES,
} from "../../../shared/systemRuntimeConfig";
import {
  validateSessionIdleTimeoutInput,
  validateSessionWarningLeadInput,
} from "./settingsService";
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

type ValidatedFieldKey =
  | "organization_name"
  | "organization_subtitle"
  | "login_portal_title"
  | "login_portal_subtitle"
  | "session_idle_timeout_minutes"
  | "session_warning_lead_minutes";

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

  const [focusedField, setFocusedField] = useState<ValidatedFieldKey | null>(null);
  const [touched, setTouched] = useState<Partial<Record<ValidatedFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const orgNameRef = useRef<HTMLInputElement | null>(null);
  const orgSubRef = useRef<HTMLInputElement | null>(null);
  const portalTitleRef = useRef<HTMLInputElement | null>(null);
  const portalSubRef = useRef<HTMLInputElement | null>(null);
  const sessionTimeoutRef = useRef<HTMLInputElement | null>(null);
  const sessionWarningRef = useRef<HTMLInputElement | null>(null);

  const locked = !canManage || pending || uncertain;

  const markTouched = (field: ValidatedFieldKey) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  // Live field validations
  const orgNameError = !form.organization_name.trim()
    ? "Organization name is required."
    : form.organization_name.length > 120
      ? "Organization name must be 120 characters or fewer."
      : /[\x00-\x1f\x7f]/.test(form.organization_name)
        ? "Organization name contains unsupported control characters."
        : undefined;

  const orgSubError =
    form.organization_subtitle.length > 160
      ? "Header subtitle must be 160 characters or fewer."
      : /[\x00-\x1f\x7f]/.test(form.organization_subtitle)
        ? "Header subtitle contains unsupported control characters."
        : undefined;

  const portalTitleError = !loginBranding.login_portal_title.trim()
    ? "Sign-in organization label is required."
    : loginBranding.login_portal_title.length > 120
      ? "Sign-in organization label must be 120 characters or fewer."
      : /[\x00-\x1f\x7f]/.test(loginBranding.login_portal_title)
        ? "Sign-in organization label contains unsupported control characters."
        : undefined;

  const portalSubError = !loginBranding.login_portal_subtitle.trim()
    ? "Sign-in prompt text is required."
    : loginBranding.login_portal_subtitle.length > 160
      ? "Sign-in prompt text must be 160 characters or fewer."
      : /[\x00-\x1f\x7f]/.test(loginBranding.login_portal_subtitle)
        ? "Sign-in prompt text contains unsupported control characters."
        : undefined;

  const sessionTimeoutError = validateSessionIdleTimeoutInput(form.session_idle_timeout_minutes);
  const sessionWarningError = validateSessionWarningLeadInput(
    form.session_warning_lead_minutes,
    form.session_idle_timeout_minutes,
  );

  const fieldErrors: Record<ValidatedFieldKey, string | undefined> = {
    organization_name: orgNameError,
    organization_subtitle: orgSubError,
    login_portal_title: portalTitleError,
    login_portal_subtitle: portalSubError,
    session_idle_timeout_minutes: sessionTimeoutError,
    session_warning_lead_minutes: sessionWarningError,
  };

  const hasValidationErrors = Object.values(fieldErrors).some(Boolean);
  const shouldShowError = (field: ValidatedFieldKey) =>
    Boolean(fieldErrors[field] && (submitAttempted || touched[field] || focusedField === field));

  const parsedTimeoutMinutes =
    !sessionTimeoutError && /^\d+$/.test(form.session_idle_timeout_minutes.trim())
      ? Number(form.session_idle_timeout_minutes.trim())
      : null;
  const parsedWarningMinutes =
    !sessionWarningError && /^\d+$/.test(form.session_warning_lead_minutes.trim())
      ? Number(form.session_warning_lead_minutes.trim())
      : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (hasValidationErrors) {
      const order: [ValidatedFieldKey, React.RefObject<HTMLInputElement | null>][] = [
        ["organization_name", orgNameRef],
        ["organization_subtitle", orgSubRef],
        ["login_portal_title", portalTitleRef],
        ["login_portal_subtitle", portalSubRef],
        ["session_idle_timeout_minutes", sessionTimeoutRef],
        ["session_warning_lead_minutes", sessionWarningRef],
      ];
      for (const [key, ref] of order) {
        if (fieldErrors[key]) {
          markTouched(key);
          setFocusedField(key);
          ref.current?.focus();
          break;
        }
      }
      return;
    }
    void save();
  };

  return (
    <div className="eflow-admin-configuration">
      {!embedded && (
        <WorkspaceHeader
          title="General settings"
          description="Manage organization branding, invitation defaults, deadline rules, and session inactivity timeouts."
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
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                    ref={orgNameRef}
                    maxLength={120}
                    required
                    disabled={locked}
                    aria-invalid={shouldShowError("organization_name") || undefined}
                    className={shouldShowError("organization_name") ? "eflow-field-invalid" : undefined}
                    value={form.organization_name}
                    onFocus={() => setFocusedField("organization_name")}
                    onBlur={() => {
                      markTouched("organization_name");
                      setFocusedField((cur) => (cur === "organization_name" ? null : cur));
                    }}
                    onChange={(e) => {
                      markTouched("organization_name");
                      setForm({ ...form, organization_name: e.target.value });
                    }}
                  />
                  <FieldValidationTooltip
                    anchorRef={orgNameRef}
                    message={fieldErrors.organization_name}
                    open={focusedField === "organization_name" && Boolean(fieldErrors.organization_name)}
                  />
                  <div className="eflow-bounded-meta">
                    <span
                      className="eflow-bounded-meta__hint"
                      data-tone={shouldShowError("organization_name") ? "error" : undefined}
                    >
                      {shouldShowError("organization_name")
                        ? fieldErrors.organization_name
                        : "Shown in the top navigation bar, exported CSV/PDF report headers, and invitation emails."}
                    </span>
                    <span
                      className="eflow-bounded-counter"
                      data-level={
                        form.organization_name.length >= 120
                          ? "max"
                          : form.organization_name.length >= 100
                            ? "warn"
                            : undefined
                      }
                    >
                      {form.organization_name.length} / 120
                    </span>
                  </div>
                </label>

                <label>
                  Header Subtitle
                  <input
                    ref={orgSubRef}
                    maxLength={160}
                    disabled={locked}
                    aria-invalid={shouldShowError("organization_subtitle") || undefined}
                    className={shouldShowError("organization_subtitle") ? "eflow-field-invalid" : undefined}
                    placeholder="e.g., Investment Promotion & Economic Development Office"
                    value={form.organization_subtitle}
                    onFocus={() => setFocusedField("organization_subtitle")}
                    onBlur={() => {
                      markTouched("organization_subtitle");
                      setFocusedField((cur) => (cur === "organization_subtitle" ? null : cur));
                    }}
                    onChange={(e) => {
                      markTouched("organization_subtitle");
                      setForm({ ...form, organization_subtitle: e.target.value });
                    }}
                  />
                  <FieldValidationTooltip
                    anchorRef={orgSubRef}
                    message={fieldErrors.organization_subtitle}
                    open={focusedField === "organization_subtitle" && Boolean(fieldErrors.organization_subtitle)}
                  />
                  <div className="eflow-bounded-meta">
                    <span
                      className="eflow-bounded-meta__hint"
                      data-tone={shouldShowError("organization_subtitle") ? "error" : undefined}
                    >
                      {shouldShowError("organization_subtitle")
                        ? fieldErrors.organization_subtitle
                        : "Optional subtitle shown in exported report headers and emails."}
                    </span>
                    <span
                      className="eflow-bounded-counter"
                      data-level={
                        form.organization_subtitle.length >= 160
                          ? "max"
                          : form.organization_subtitle.length >= 136
                            ? "warn"
                            : undefined
                      }
                    >
                      {form.organization_subtitle.length} / 160
                    </span>
                  </div>
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
                    ref={portalTitleRef}
                    maxLength={120}
                    required
                    disabled={locked}
                    aria-invalid={shouldShowError("login_portal_title") || undefined}
                    className={shouldShowError("login_portal_title") ? "eflow-field-invalid" : undefined}
                    placeholder="LEDIPO"
                    value={loginBranding.login_portal_title}
                    onFocus={() => setFocusedField("login_portal_title")}
                    onBlur={() => {
                      markTouched("login_portal_title");
                      setFocusedField((cur) => (cur === "login_portal_title" ? null : cur));
                    }}
                    onChange={(e) => {
                      markTouched("login_portal_title");
                      setLoginBranding({
                        ...loginBranding,
                        login_portal_title: e.target.value,
                      });
                    }}
                  />
                  <FieldValidationTooltip
                    anchorRef={portalTitleRef}
                    message={fieldErrors.login_portal_title}
                    open={focusedField === "login_portal_title" && Boolean(fieldErrors.login_portal_title)}
                  />
                  <div className="eflow-bounded-meta">
                    <span
                      className="eflow-bounded-meta__hint"
                      data-tone={shouldShowError("login_portal_title") ? "error" : undefined}
                    >
                      {shouldShowError("login_portal_title")
                        ? fieldErrors.login_portal_title
                        : "Displayed next to the eFlow logo on the sign-in screen."}
                    </span>
                    <span className="eflow-bounded-counter">
                      {loginBranding.login_portal_title.length} / 120
                    </span>
                  </div>
                </label>

                <label>
                  Sign-in Prompt Text
                  <input
                    ref={portalSubRef}
                    maxLength={160}
                    required
                    disabled={locked}
                    aria-invalid={shouldShowError("login_portal_subtitle") || undefined}
                    className={shouldShowError("login_portal_subtitle") ? "eflow-field-invalid" : undefined}
                    placeholder="Use your official LEDIPO account."
                    value={loginBranding.login_portal_subtitle}
                    onFocus={() => setFocusedField("login_portal_subtitle")}
                    onBlur={() => {
                      markTouched("login_portal_subtitle");
                      setFocusedField((cur) => (cur === "login_portal_subtitle" ? null : cur));
                    }}
                    onChange={(e) => {
                      markTouched("login_portal_subtitle");
                      setLoginBranding({
                        ...loginBranding,
                        login_portal_subtitle: e.target.value,
                      });
                    }}
                  />
                  <FieldValidationTooltip
                    anchorRef={portalSubRef}
                    message={fieldErrors.login_portal_subtitle}
                    open={focusedField === "login_portal_subtitle" && Boolean(fieldErrors.login_portal_subtitle)}
                  />
                  <div className="eflow-bounded-meta">
                    <span
                      className="eflow-bounded-meta__hint"
                      data-tone={shouldShowError("login_portal_subtitle") ? "error" : undefined}
                    >
                      {shouldShowError("login_portal_subtitle")
                        ? fieldErrors.login_portal_subtitle
                        : "Displayed below “Sign in to eFlow” on the sign-in screen."}
                    </span>
                    <span className="eflow-bounded-counter">
                      {loginBranding.login_portal_subtitle.length} / 160
                    </span>
                  </div>
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

              {/* Session Inactivity Timeout Maintenance */}
              <div className="eflow-admin-card eflow-admin-settings-form">
                <div className="eflow-admin-card__title-row">
                  <span className="eflow-admin-icon-chip" aria-hidden="true">
                    <Clock3 size={16} />
                  </span>
                  <div>
                    <h2>Session inactivity timeout</h2>
                    <p className="eflow-admin-copy">
                      Automatically sign out inactive accounts to protect LGU data. Changes apply across active sessions automatically.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label>
                    Auto Sign-out After (minutes)
                    <input
                      ref={sessionTimeoutRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={3}
                      required
                      disabled={locked}
                      placeholder="60"
                      aria-invalid={shouldShowError("session_idle_timeout_minutes") || undefined}
                      className={`eflow-tabular ${
                        shouldShowError("session_idle_timeout_minutes") ? "eflow-field-invalid" : ""
                      }`.trim()}
                      value={form.session_idle_timeout_minutes}
                      onFocus={() => setFocusedField("session_idle_timeout_minutes")}
                      onBlur={() => {
                        markTouched("session_idle_timeout_minutes");
                        setFocusedField((cur) =>
                          cur === "session_idle_timeout_minutes" ? null : cur,
                        );
                      }}
                      onChange={(e) => {
                        markTouched("session_idle_timeout_minutes");
                        const digitsOnly = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                        setForm({ ...form, session_idle_timeout_minutes: digitsOnly });
                      }}
                    />
                    <FieldValidationTooltip
                      anchorRef={sessionTimeoutRef}
                      message={fieldErrors.session_idle_timeout_minutes}
                      open={
                        focusedField === "session_idle_timeout_minutes" &&
                        Boolean(fieldErrors.session_idle_timeout_minutes)
                      }
                    />
                    <div className="eflow-bounded-meta">
                      <span
                        className="eflow-bounded-meta__hint"
                        data-tone={
                          shouldShowError("session_idle_timeout_minutes") ? "error" : undefined
                        }
                      >
                        {shouldShowError("session_idle_timeout_minutes")
                          ? fieldErrors.session_idle_timeout_minutes
                          : parsedTimeoutMinutes !== null
                            ? `Signs out after ${formatMinutesDuration(parsedTimeoutMinutes)} (${SESSION_IDLE_TIMEOUT_MIN_MINUTES}–${SESSION_IDLE_TIMEOUT_MAX_MINUTES} min).`
                            : `Allowed range: ${SESSION_IDLE_TIMEOUT_MIN_MINUTES}–${SESSION_IDLE_TIMEOUT_MAX_MINUTES} minutes.`}
                      </span>
                    </div>
                  </label>

                  <label>
                    Warning Countdown (minutes)
                    <input
                      ref={sessionWarningRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={2}
                      required
                      disabled={locked}
                      placeholder="5"
                      aria-invalid={shouldShowError("session_warning_lead_minutes") || undefined}
                      className={`eflow-tabular ${
                        shouldShowError("session_warning_lead_minutes") ? "eflow-field-invalid" : ""
                      }`.trim()}
                      value={form.session_warning_lead_minutes}
                      onFocus={() => setFocusedField("session_warning_lead_minutes")}
                      onBlur={() => {
                        markTouched("session_warning_lead_minutes");
                        setFocusedField((cur) =>
                          cur === "session_warning_lead_minutes" ? null : cur,
                        );
                      }}
                      onChange={(e) => {
                        markTouched("session_warning_lead_minutes");
                        const digitsOnly = e.target.value.replace(/[^\d]/g, "").slice(0, 2);
                        setForm({ ...form, session_warning_lead_minutes: digitsOnly });
                      }}
                    />
                    <FieldValidationTooltip
                      anchorRef={sessionWarningRef}
                      message={fieldErrors.session_warning_lead_minutes}
                      open={
                        focusedField === "session_warning_lead_minutes" &&
                        Boolean(fieldErrors.session_warning_lead_minutes)
                      }
                    />
                    <div className="eflow-bounded-meta">
                      <span
                        className="eflow-bounded-meta__hint"
                        data-tone={
                          shouldShowError("session_warning_lead_minutes") ? "error" : undefined
                        }
                      >
                        {shouldShowError("session_warning_lead_minutes")
                          ? fieldErrors.session_warning_lead_minutes
                          : parsedWarningMinutes !== null
                            ? `Warns ${formatMinutesDuration(parsedWarningMinutes)} before sign-out (${SESSION_WARNING_LEAD_MIN_MINUTES}–${SESSION_WARNING_LEAD_MAX_MINUTES} min).`
                            : `Allowed range: ${SESSION_WARNING_LEAD_MIN_MINUTES}–${SESSION_WARNING_LEAD_MAX_MINUTES} minutes.`}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="eflow-admin-card eflow-admin-settings-form">
                <div className="eflow-admin-actions pt-1">
                  <Button
                    type="submit"
                    disabled={
                      !canManage ||
                      pending ||
                      hasValidationErrors ||
                      (!dirty && !uncertain)
                    }
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
                      onClick={() => {
                        setSubmitAttempted(false);
                        setTouched({});
                        resetDraft();
                      }}
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
