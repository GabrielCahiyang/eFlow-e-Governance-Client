import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PRESENTATION,
  GENERAL_SETTINGS_KEYS,
  fetchGeneralSystemSettings,
  type GeneralSystemSettings,
} from "./settingsService";

export type BrandingSnapshot = GeneralSystemSettings & {
  app_version: string;
};

const BRANDING_CONFIG_KEYS = new Set<string>([
  ...GENERAL_SETTINGS_KEYS,
  "app_version",
]);

const INITIAL_SNAPSHOT: BrandingSnapshot = {
  ...DEFAULT_GENERAL_SETTINGS,
  organization_name: DEFAULT_PRESENTATION.organization_name,
  app_version: DEFAULT_PRESENTATION.app_version,
};

const brandingListeners = new Set<() => void>();
let sharedBrandingChannel: any = null;

function subscribeBrandingChannel(listener: () => void): () => void {
  brandingListeners.add(listener);
  if (brandingListeners.size === 1 && typeof (supabase as any)?.channel === "function") {
    sharedBrandingChannel = (supabase as any)
      .channel(`system-config:branding:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_config" },
        (payload?: { new?: { key?: string }; old?: { key?: string } }) => {
          const changedKey = payload?.new?.key ?? payload?.old?.key;
          if (changedKey && !BRANDING_CONFIG_KEYS.has(changedKey)) return;
          for (const notify of brandingListeners) notify();
        },
      )
      .subscribe();
  }
  return () => {
    brandingListeners.delete(listener);
    if (brandingListeners.size === 0 && sharedBrandingChannel) {
      const channelToRemove = sharedBrandingChannel;
      sharedBrandingChannel = null;
      if (typeof (supabase as any)?.removeChannel === "function") {
        void (supabase as any).removeChannel(channelToRemove);
      }
    }
  };
}

export function usePresentationBranding(actor?: string): BrandingSnapshot {
  const [state, setState] = useState<{ actor?: string; values: BrandingSnapshot }>({
    actor,
    values: INITIAL_SNAPSHOT,
  });

  useEffect(() => {
    let live = true;
    let revision = 0;
    let lastRefreshAt = 0;

    const refresh = async () => {
      lastRefreshAt = Date.now();
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

    const refreshOnFocus = () => {
      if (Date.now() - lastRefreshAt < 30_000) return;
      void refresh();
    };

    if (actor) void refresh();
    window.addEventListener("eflow-presentation-settings-changed", refresh);
    window.addEventListener("focus", refreshOnFocus);
    const unsubscribeChannel = actor
      ? subscribeBrandingChannel(() => void refresh())
      : null;
    const timer = window.setInterval(() => {
      if (actor) void refresh();
    }, 60_000);

    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener(
        "eflow-presentation-settings-changed",
        refresh,
      );
      unsubscribeChannel?.();
    };
  }, [actor]);

  return state.actor === actor ? state.values : INITIAL_SNAPSHOT;
}
