import { useEffect, useState } from "react";
import {
  DEFAULT_PRESENTATION,
  fetchPresentationSettings,
} from "./settingsService";
export function usePresentationBranding(actor?: string) {
  const [state, setState] = useState({ actor, values: DEFAULT_PRESENTATION });
  useEffect(() => {
    let live = true,
      revision = 0;
    const refresh = async () => {
      const version = ++revision;
      try {
        const data = await fetchPresentationSettings();
        if (live && version === revision)
          setState({
            actor,
            values: {
              organization_name:
                data.organization_name ||
                DEFAULT_PRESENTATION.organization_name,
              app_version: data.app_version || DEFAULT_PRESENTATION.app_version,
            },
          });
      } catch {
        if (live && version === revision)
          setState({ actor, values: DEFAULT_PRESENTATION });
      }
    };
    if (actor) void refresh();
    window.addEventListener("eflow-presentation-settings-changed", refresh);
    window.addEventListener("focus", refresh);
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
    };
  }, [actor]);
  return state.actor === actor ? state.values : DEFAULT_PRESENTATION;
}
