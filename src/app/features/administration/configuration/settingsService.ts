import { supabase } from "../../../../lib/supabase";
export type PresentationSettings = {
  organization_name: string | null;
  app_version: string | null;
};
export const DEFAULT_PRESENTATION = {
  organization_name: "LGU Ormoc City",
  app_version: "2.0.0",
};
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
