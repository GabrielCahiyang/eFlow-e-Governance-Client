import { ThemeProvider } from "@vibe/core";
import { useEffect, useState, type ReactElement } from "react";
import { useUserPreferences } from "../../contexts/UserPreferencesContext";
import type { ThemePreference } from "../../types";
import { eflowVibeTheme } from "./eflowVibeTheme";

type VibeSystemTheme = "light" | "dark";

function resolveSystemTheme(_preference: ThemePreference): VibeSystemTheme {
  // Light mode is enforced system-wide for now.
  return "light";
}

function useResolvedVibeTheme(preference: ThemePreference): VibeSystemTheme {
  const [systemTheme, setSystemTheme] = useState<VibeSystemTheme>(() =>
    resolveSystemTheme(preference),
  );

  useEffect(() => {
    setSystemTheme(resolveSystemTheme(preference));
  }, [preference]);

  return systemTheme;
}

function useVibeSystemThemeClass(systemTheme: VibeSystemTheme) {
  useEffect(() => {
    // ThemeProvider initializes this documented system-theme class only when
    // one is absent. Keep it synchronized with eFlow's existing preference
    // changes without styling against Vibe internals.
    const classes = document.body.classList;
    classes.remove("light-app-theme", "dark-app-theme", "black-app-theme");
    classes.add(`${systemTheme}-app-theme`);
    // Vibe's scoped provider class is outside body-portaled modal content.
    // Carry the same supported aliases to that documented system-theme boundary.
    const style = document.body.style;
    const previous = Object.entries(eflowVibeTheme.colors[systemTheme]).map(([name, value]) => {
      const key = `--${name}`;
      const original = style.getPropertyValue(key), priority = style.getPropertyPriority(key);
      style.setProperty(key, value);
      return { key, original, priority };
    });
    return () => previous.forEach(({key, original, priority}) => {
      if (original) style.setProperty(key, original, priority);
      else style.removeProperty(key);
    });
  }, [systemTheme]);
}

export function EflowVibeThemeProvider({
  children,
  preference,
}: {
  children: ReactElement;
  preference: ThemePreference;
}) {
  const systemTheme = useResolvedVibeTheme(preference);
  useVibeSystemThemeClass(systemTheme);
  return (
    <ThemeProvider themeConfig={eflowVibeTheme} systemTheme={systemTheme}>
      {children}
    </ThemeProvider>
  );
}

export function EflowVibeProvider({ children }: { children: ReactElement }) {
  const { theme } = useUserPreferences();
  const isActivationRoute =
    typeof window !== "undefined" && window.location.pathname === "/activate-account";
  return (
    <EflowVibeThemeProvider preference={isActivationRoute ? "light" : theme}>
      {children}
    </EflowVibeThemeProvider>
  );
}
