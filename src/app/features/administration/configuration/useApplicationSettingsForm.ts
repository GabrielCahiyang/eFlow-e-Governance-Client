import { useEffect, useRef, useState } from "react";
import { useNavigationBlocker } from "../../../shared/navigationGuard";
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_LOGIN_BRANDING,
  fetchGeneralSystemSettings,
  fetchLoginBrandingSettings,
  saveGeneralSystemSettings,
  saveLoginBrandingSettings,
  SettingsWriteError,
  validateGeneralSystemSettings,
  validateLoginBrandingSettings,
  type GeneralSystemSettings,
  type LoginBrandingSettings,
} from "./settingsService";

function normalizeGeneralForm(
  values?: Partial<GeneralSystemSettings> | null,
): GeneralSystemSettings {
  return {
    organization_name:
      values?.organization_name || DEFAULT_GENERAL_SETTINGS.organization_name,
    organization_subtitle: values?.organization_subtitle ?? "",
    support_email: values?.support_email ?? "",
    activation_expiry_hours:
      values?.activation_expiry_hours || DEFAULT_GENERAL_SETTINGS.activation_expiry_hours,
    default_email_notifications_enabled:
      values?.default_email_notifications_enabled ||
      DEFAULT_GENERAL_SETTINGS.default_email_notifications_enabled,
    maintenance_banner_enabled:
      values?.maintenance_banner_enabled ||
      DEFAULT_GENERAL_SETTINGS.maintenance_banner_enabled,
    maintenance_banner_message: values?.maintenance_banner_message ?? "",
    due_soon_days: values?.due_soon_days || DEFAULT_GENERAL_SETTINGS.due_soon_days,
    session_idle_timeout_minutes:
      values?.session_idle_timeout_minutes !== undefined
        ? values.session_idle_timeout_minutes
        : DEFAULT_GENERAL_SETTINGS.session_idle_timeout_minutes,
    session_warning_lead_minutes:
      values?.session_warning_lead_minutes !== undefined
        ? values.session_warning_lead_minutes
        : DEFAULT_GENERAL_SETTINGS.session_warning_lead_minutes,
  };
}

function normalizeLoginBranding(
  values?: Partial<LoginBrandingSettings> | null,
): LoginBrandingSettings {
  return {
    login_portal_title:
      values?.login_portal_title || DEFAULT_LOGIN_BRANDING.login_portal_title,
    login_portal_subtitle:
      values?.login_portal_subtitle || DEFAULT_LOGIN_BRANDING.login_portal_subtitle,
  };
}

export function useApplicationSettingsForm(canManage: boolean) {
  const [saved, setSaved] = useState<GeneralSystemSettings>();
  const [form, setForm] = useState<GeneralSystemSettings>(DEFAULT_GENERAL_SETTINGS);
  const [savedLoginBranding, setSavedLoginBranding] = useState<LoginBrandingSettings>(
    DEFAULT_LOGIN_BRANDING,
  );
  const [loginBranding, setLoginBranding] = useState<LoginBrandingSettings>(
    DEFAULT_LOGIN_BRANDING,
  );
  const [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const live = useRef(true),
    busy = useRef(false),
    attempt = useRef<
      | {
          id: string;
          expected: GeneralSystemSettings;
          values: GeneralSystemSettings;
        }
      | undefined
    >(undefined);

  const generalDirty =
    !!saved &&
    JSON.stringify(normalizeGeneralForm(form)) !==
      JSON.stringify(normalizeGeneralForm(saved));

  const loginBrandingDirty =
    !!saved &&
    (loginBranding.login_portal_title.trim() !== savedLoginBranding.login_portal_title.trim() ||
      loginBranding.login_portal_subtitle.trim() !==
        savedLoginBranding.login_portal_subtitle.trim());

  const dirty = generalDirty || loginBrandingDirty;

  const resetDraft = () => {
    setForm(normalizeGeneralForm(saved));
    setLoginBranding(normalizeLoginBranding(savedLoginBranding));
    setUncertain(false);
    attempt.current = undefined;
  };

  useNavigationBlocker({
    label: "General settings",
    dirty: dirty || uncertain,
    pending,
    onDiscard: resetDraft,
  });

  const load = async () => {
    if (busy.current) return;
    setLoading(true);
    setError("");
    try {
      const [data, branding] = await Promise.all([
        fetchGeneralSystemSettings(),
        fetchLoginBrandingSettings(),
      ]);
      if (live.current) {
        const normalized = normalizeGeneralForm(data);
        const normalizedBranding = normalizeLoginBranding(branding);
        setSaved(normalized);
        setForm(normalized);
        setSavedLoginBranding(normalizedBranding);
        setLoginBranding(normalizedBranding);
      }
    } catch (reason) {
      if (live.current)
        setError(
          reason instanceof Error ? reason.message : "Settings unavailable",
        );
    } finally {
      if (live.current) setLoading(false);
    }
  };

  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
    };
  }, []);

  const save = async () => {
    if (busy.current || !saved || !canManage) return;
    busy.current = true;
    setPending(true);
    setError("");
    setReceipt("");
    const current = attempt.current || {
      id: crypto.randomUUID(),
      expected: saved,
      values: {
        organization_name: form.organization_name.trim(),
        organization_subtitle: form.organization_subtitle.trim(),
        support_email: form.support_email.trim(),
        activation_expiry_hours: form.activation_expiry_hours,
        default_email_notifications_enabled: form.default_email_notifications_enabled,
        maintenance_banner_enabled: form.maintenance_banner_enabled,
        maintenance_banner_message: form.maintenance_banner_message.trim(),
        due_soon_days: form.due_soon_days,
        session_idle_timeout_minutes: /^\d+$/.test(form.session_idle_timeout_minutes.trim())
          ? String(Number(form.session_idle_timeout_minutes.trim()))
          : form.session_idle_timeout_minutes.trim(),
        session_warning_lead_minutes: /^\d+$/.test(form.session_warning_lead_minutes.trim())
          ? String(Number(form.session_warning_lead_minutes.trim()))
          : form.session_warning_lead_minutes.trim(),
      },
    };
    const nextBranding: LoginBrandingSettings = {
      login_portal_title: loginBranding.login_portal_title.trim(),
      login_portal_subtitle: loginBranding.login_portal_subtitle.trim(),
    };
    const shouldSaveGeneral = generalDirty || Boolean(attempt.current);
    try {
      if (shouldSaveGeneral) {
        validateGeneralSystemSettings(current.values);
      }
      if (loginBrandingDirty) {
        validateLoginBrandingSettings(nextBranding);
      }
      if (shouldSaveGeneral) {
        attempt.current = current;
        const data = await saveGeneralSystemSettings(
          current.id,
          current.expected,
          current.values,
        );
        if (live.current) {
          const normalized = normalizeGeneralForm(data);
          setSaved(normalized);
          setForm(normalized);
          setUncertain(false);
          attempt.current = undefined;
        }
      }
      if (loginBrandingDirty) {
        const savedBranding = await saveLoginBrandingSettings(nextBranding);
        if (live.current) {
          const normalizedBranding = normalizeLoginBranding(savedBranding);
          setSavedLoginBranding(normalizedBranding);
          setLoginBranding(normalizedBranding);
        }
      }
      if (live.current && (shouldSaveGeneral || loginBrandingDirty)) {
        setReceipt(
          "General settings saved and audited. Updates apply across open sessions automatically.",
        );
      }
    } catch (reason) {
      if (live.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Settings save unavailable",
        );
        const unknown =
          !!attempt.current &&
          !(reason instanceof SettingsWriteError && !reason.uncertain);
        setUncertain(unknown);
        if (!unknown) attempt.current = undefined;
      }
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  };

  return {
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
  };
}
