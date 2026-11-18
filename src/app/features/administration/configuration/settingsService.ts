import { supabase } from "../../../../lib/supabase";
import { setRuntimeSystemSettings } from "../../../shared/systemRuntimeConfig";

export type PresentationSettings = {
  organization_name: string | null;
  app_version: string | null;
};

export type GeneralSystemSettings = {
  organization_name: string;
  organization_subtitle: string;
  support_email: string;
  activation_expiry_hours: "24" | "72" | "168";
  default_email_notifications_enabled: "true" | "false";
  maintenance_banner_enabled: "true" | "false";
  maintenance_banner_message: string;
  due_soon_days: "1" | "2" | "3" | "5" | "7";
};

export const DEFAULT_PRESENTATION = {
  organization_name: "LGU Ormoc City",
  app_version: "2.0.0",
};

export const DEFAULT_GENERAL_SETTINGS: GeneralSystemSettings = {
  organization_name: "LEDIPO",
  organization_subtitle: "",
  support_email: "",
  activation_expiry_hours: "24",
  default_email_notifications_enabled: "true",
  maintenance_banner_enabled: "false",
  maintenance_banner_message: "",
  due_soon_days: "3",
};

export const GENERAL_SETTINGS_KEYS = [
  "organization_name",
  "organization_subtitle",
  "support_email",
  "activation_expiry_hours",
  "default_email_notifications_enabled",
  "maintenance_banner_enabled",
  "maintenance_banner_message",
  "due_soon_days",
] as const;

export class SettingsWriteError extends Error {
  constructor(
    message: string,
    public uncertain: boolean,
  ) {
    super(message);
  }
}

export async function fetchPresentationSettings(): Promise<PresentationSettings> {
  const { data, error } = await supabase
    .from("system_config")
    .select("key,value")
    .in("key", ["organization_name", "app_version"]);
  if (error)
    throw new Error(
      "Application settings could not be loaded. Retry before editing.",
    );
  if (!Array.isArray(data))
    throw new Error("Application settings response could not be verified.");
  const result: PresentationSettings = {
    organization_name: null,
    app_version: null,
  };
  for (const row of data)
    if (["organization_name", "app_version"].includes(row.key)) {
      if (row.value !== null && typeof row.value !== "string")
        throw new Error("Application settings response could not be verified.");
      result[row.key as keyof PresentationSettings] = row.value;
    }
  return result;
}

export function validatePresentationSettings(values: PresentationSettings) {
  if (
    !values.organization_name ||
    values.organization_name.length > 120 ||
    /[\x00-\x1f\x7f]/.test(values.organization_name)
  )
    throw new Error(
      "Organization name must contain 1–120 printable characters.",
    );
  if (
    !values.app_version ||
    !/^[A-Za-z0-9][A-Za-z0-9._+ -]{0,39}$/.test(values.app_version)
  )
    throw new Error(
      "Version must contain 1–40 letters, numbers, spaces, dots, hyphens, underscores or plus signs.",
    );
}

export async function savePresentationSettings(
  request: string,
  expected: PresentationSettings,
  values: PresentationSettings,
): Promise<PresentationSettings> {
  validatePresentationSettings(values);
  const { data, error } = await supabase.rpc("r12_save_presentation_settings", {
    p_request: request,
    p_expected: expected,
    p_values: values,
  });
  if (error)
    throw new SettingsWriteError(
      error.code === "PGRST202"
        ? "Validated settings saving is not installed. Apply the reviewed R12 migration before acceptance."
        : error.message,
      !["22023", "42501", "40001", "PGRST202", "PGRST301"].includes(
        error.code || "",
      ),
    );
  if (
    !data ||
    data.organization_name !== values.organization_name ||
    data.app_version !== values.app_version
  )
    throw new Error(
      "Save result is uncertain. Retry the same request to verify it.",
    );
  window.dispatchEvent(new CustomEvent("eflow-presentation-settings-changed"));
  return data;
}

function syncRuntimeFromGeneral(values: GeneralSystemSettings) {
  setRuntimeSystemSettings({
    organizationName: values.organization_name || DEFAULT_GENERAL_SETTINGS.organization_name,
    organizationSubtitle: values.organization_subtitle,
    supportEmail: values.support_email,
    dueSoonDays: Number(values.due_soon_days) || 3,
    maintenanceBannerEnabled: values.maintenance_banner_enabled === "true",
    maintenanceBannerMessage: values.maintenance_banner_message,
  });
}

let inFlightGeneralSettings: Promise<GeneralSystemSettings> | null = null;

export function fetchGeneralSystemSettings(): Promise<GeneralSystemSettings> {
  if (inFlightGeneralSettings) return inFlightGeneralSettings;
  const current = (async (): Promise<GeneralSystemSettings> => {
    const { data, error } = await supabase
      .from("system_config")
      .select("key,value")
      .in("key", [...GENERAL_SETTINGS_KEYS]);
    if (error)
      throw new Error(
        "System settings could not be loaded. Retry before editing.",
      );
    if (!Array.isArray(data))
      throw new Error("System settings response could not be verified.");

    const result: GeneralSystemSettings = { ...DEFAULT_GENERAL_SETTINGS };
    for (const row of data) {
      const key = typeof row.key === "string" ? (row.key as keyof GeneralSystemSettings) : null;
      if (!key || !GENERAL_SETTINGS_KEYS.includes(key)) continue;
      if (row.value !== null && typeof row.value !== "string")
        throw new Error("System settings response could not be verified.");
      const val = row.value ?? "";
      if (key === "activation_expiry_hours") {
        if (val === "24" || val === "72" || val === "168") result.activation_expiry_hours = val;
      } else if (key === "default_email_notifications_enabled" || key === "maintenance_banner_enabled") {
        if (val === "true" || val === "false") result[key] = val;
      } else if (key === "due_soon_days") {
        if (val === "1" || val === "2" || val === "3" || val === "5" || val === "7") result.due_soon_days = val;
      } else if (key === "organization_name") {
        result.organization_name = val || DEFAULT_GENERAL_SETTINGS.organization_name;
      } else if (key === "organization_subtitle" || key === "support_email" || key === "maintenance_banner_message") {
        result[key] = val;
      }
    }
    syncRuntimeFromGeneral(result);
    return result;
  })().finally(() => {
    if (inFlightGeneralSettings === current) inFlightGeneralSettings = null;
  });
  inFlightGeneralSettings = current;
  return current;
}

export function validateGeneralSystemSettings(values: GeneralSystemSettings) {
  if (
    !values.organization_name.trim() ||
    values.organization_name.length > 120 ||
    /[\x00-\x1f\x7f]/.test(values.organization_name)
  ) {
    throw new Error("Organization name must contain 1–120 printable characters.");
  }
  if (
    values.organization_subtitle.length > 160 ||
    /[\x00-\x1f\x7f]/.test(values.organization_subtitle)
  ) {
    throw new Error("Header subtitle must be at most 160 printable characters.");
  }
  const support = values.support_email.trim();
  if (
    support &&
    (support.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support) ||
      /[\x00-\x1f\x7f]/.test(support))
  ) {
    throw new Error("Enter a valid support email address (or leave blank).");
  }
  if (!["24", "72", "168"].includes(values.activation_expiry_hours)) {
    throw new Error("Select a valid activation link expiry window.");
  }
  if (!["true", "false"].includes(values.default_email_notifications_enabled)) {
    throw new Error("Invalid default email notifications value.");
  }
  if (!["true", "false"].includes(values.maintenance_banner_enabled)) {
    throw new Error("Invalid maintenance banner toggle value.");
  }
  if (
    values.maintenance_banner_message.length > 240 ||
    /[\x00-\x1f\x7f]/.test(values.maintenance_banner_message)
  ) {
    throw new Error("Maintenance notice message must be at most 240 printable characters.");
  }
  if (values.maintenance_banner_enabled === "true" && !values.maintenance_banner_message.trim()) {
    throw new Error("Enter a maintenance notice message or disable the banner.");
  }
  if (!["1", "2", "3", "5", "7"].includes(values.due_soon_days)) {
    throw new Error("Select a valid due-soon warning window.");
  }
}

export async function saveGeneralSystemSettings(
  request: string,
  expected: GeneralSystemSettings,
  values: GeneralSystemSettings,
): Promise<GeneralSystemSettings> {
  validateGeneralSystemSettings(values);
  const { data, error } = await supabase.rpc("save_general_system_settings", {
    p_request: request,
    p_expected: expected,
    p_values: values,
  });
  if (error) {
    throw new SettingsWriteError(
      error.code === "PGRST202"
        ? "General system settings RPC is not installed yet."
        : error.message,
      !["22023", "42501", "40001", "PGRST202", "PGRST301"].includes(
        error.code || "",
      ),
    );
  }
  if (
    !data ||
    GENERAL_SETTINGS_KEYS.some(
      (key) => (data as Record<string, unknown>)[key] !== values[key],
    )
  ) {
    throw new Error(
      "Save result is uncertain. Retry the same request to verify it.",
    );
  }
  syncRuntimeFromGeneral(data as GeneralSystemSettings);
  window.dispatchEvent(new CustomEvent("eflow-presentation-settings-changed"));
  return data as GeneralSystemSettings;
}
