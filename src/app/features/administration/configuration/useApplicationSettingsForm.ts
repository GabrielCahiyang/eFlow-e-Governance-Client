import { useEffect, useRef, useState } from "react";
import { useNavigationBlocker } from "../../../shared/navigationGuard";
import {
  DEFAULT_PRESENTATION,
  fetchPresentationSettings,
  savePresentationSettings,
  validatePresentationSettings,
  SettingsWriteError,
  type PresentationSettings,
} from "./settingsService";
export function useApplicationSettingsForm(canManage: boolean) {
  const [saved, setSaved] = useState<PresentationSettings>();
  const [form, setForm] = useState<PresentationSettings>(DEFAULT_PRESENTATION);
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
          expected: PresentationSettings;
          values: PresentationSettings;
        }
      | undefined
    >(undefined);
  const dirty =
    !!saved &&
    JSON.stringify(form) !==
      JSON.stringify({
        organization_name:
          saved.organization_name || DEFAULT_PRESENTATION.organization_name,
        app_version: saved.app_version || DEFAULT_PRESENTATION.app_version,
      });
  const resetDraft = () => {
    setForm({
      organization_name:
        saved?.organization_name || DEFAULT_PRESENTATION.organization_name,
      app_version: saved?.app_version || DEFAULT_PRESENTATION.app_version,
    });
    setUncertain(false);
    attempt.current = undefined;
  };
  useNavigationBlocker({
    label: "Application settings",
    dirty: dirty || uncertain,
    pending,
    onDiscard: resetDraft,
  });
  const load = async () => {
    if (busy.current) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchPresentationSettings();
      if (live.current) {
        setSaved(data);
        setForm({
          organization_name:
            data.organization_name || DEFAULT_PRESENTATION.organization_name,
          app_version: data.app_version || DEFAULT_PRESENTATION.app_version,
        });
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
        organization_name: form.organization_name?.trim() || "",
        app_version: form.app_version?.trim() || "",
      },
    };
    try {
      validatePresentationSettings(current.values);
      attempt.current = current;
      const data = await savePresentationSettings(
        current.id,
        current.expected,
        current.values,
      );
      if (live.current) {
        setSaved(data);
        setForm(data);
        setUncertain(false);
        attempt.current = undefined;
        setReceipt(
          "Presentation settings saved and audited. Branding updates now; other sessions refresh on focus or within 60 seconds.",
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
