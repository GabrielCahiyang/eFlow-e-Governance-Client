import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchUserPreferences, upsertUserPreferences } from '../services/userSettingsService';
import type { ThemePreference, UserPreferences } from '../types';
import {
  UserPreferencesContext,
  type UserPreferencesContextValue,
} from './userPreferencesContextValue';

function resolvedDarkMode(_theme: ThemePreference): boolean {
  // Light mode is enforced system-wide for now; never activate dark mode.
  return false;
}

function applyTheme(_theme: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolvedDarkMode('light'));
  document.documentElement.dataset.theme = 'light';
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [theme, setThemeState] = useState<ThemePreference>('light');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeRef = useRef<ThemePreference>('light');

  const applyAndRemember = useCallback((nextTheme: ThemePreference) => {
    themeRef.current = nextTheme;
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setPreferences(null);
      setThemeState('light');
      setError(null);
      applyAndRemember('light');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchUserPreferences(user.id)
      .then(async (stored) => {
        const preference = stored ?? await upsertUserPreferences(user.id, { theme: 'light' });
        if (cancelled) return;
        const effectiveTheme: ThemePreference =
          preference.theme === 'dark' || preference.theme === 'system' ? 'light' : preference.theme;
        setPreferences({ ...preference, theme: effectiveTheme });
        setThemeState(effectiveTheme);
        applyAndRemember(effectiveTheme);
      })
      .catch(() => {
        if (!cancelled) {
          setPreferences(null);
          setThemeState('light');
          setError('We could not load your saved appearance preference. Light appearance is being used for now.');
          applyAndRemember('light');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyAndRemember, user?.id]);

  const setTheme = useCallback(async (nextTheme: ThemePreference) => {
    if (!user?.id) throw new Error('Your session has expired. Please sign in again.');
    const previousTheme = themeRef.current;
    const normalizedTheme: ThemePreference = nextTheme === 'dark' || nextTheme === 'system' ? 'light' : nextTheme;
    setError(null);
    applyTheme(normalizedTheme);

    try {
      const saved = await upsertUserPreferences(user.id, { theme: normalizedTheme });
      setPreferences(saved);
      setThemeState(saved.theme);
      themeRef.current = saved.theme;
    } catch (error) {
      applyAndRemember(previousTheme);
      setError('We could not save your appearance. Your previous theme has been restored.');
      throw error;
    }
  }, [applyAndRemember, user?.id]);

  return (
    <UserPreferencesContext.Provider value={{ preferences, theme, loading, error, setTheme }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const context = useContext(UserPreferencesContext);
  if (!context) throw new Error('useUserPreferences must be used within UserPreferencesProvider');
  return context;
}
