import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PRESENTATION,
  fetchGeneralSystemSettings,
  type GeneralSystemSettings,
} from "./settingsService";

export type BrandingSnapshot = GeneralSystemSettings & {
  app_version: string;
};

const INITIAL_SNAPSHOT: BrandingSnapshot = {
  ...DEFAULT_GENERAL_SETTINGS,
  organization_name: DEFAULT_PRESENTATION.organization_name,
  app_version: DEFAULT_PRESENTATION.app_version,
};

export function usePresentationBranding(actor?: string): BrandingSnapshot {
  const [state, setState] = useState<{ actor?: string; values: BrandingSnapshot }>({
    actor,
    values: INITIAL_SNAPSHOT,
  });

  useEffect(() => {
    let live = true;
    let revision = 0;

    const refresh = async () => {
      const version = ++revision;
      try {
        const data = await fetchGeneralSystemSettings();
        if (live && version === revision) {
          setState({
            actor,
            values: {
              ...data,
              organization_name:
                data.organization_name || DEFAULT_PRESENTATION.organization_name,
              app_version: DEFAULT_PRESENTATION.app_version,
            },
          });
        }
      } catch {
        if (live && version === revision) {
          setState({ actor, values: INITIAL_SNAPSHOT });
        }
      }
    };

    if (actor) void refresh();
    window.addEventListener("eflow-presentation-settings-changed", refresh);
    window.addEventListener("focus", refresh);
    const channel =
      actor && typeof (supabase as any)?.channel === "function"
        ? (supabase as any)
            .channel(`system-config:${actor}:${crypto.randomUUID()}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "system_config" },
              () => void refresh(),
            )
            .subscribe()
        : null;
    const timer = window.setInterval(() => {
      if (actor) void refresh();
    }, 60_000);

    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "eflow-presentation-settings-changed",
        refresh,
      );
      if (channel && typeof (supabase as any)?.removeChannel === "function") {
        void (supabase as any).removeChannel(channel);
      }
    };
  }, [actor]);

  return state.actor === actor ? state.values : INITIAL_SNAPSHOT;
}
