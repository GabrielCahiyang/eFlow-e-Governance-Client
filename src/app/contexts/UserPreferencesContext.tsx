import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchUserPreferences, upsertUserPreferences } from '../services/userSettingsService';
import type { ThemePreference, UserPreferences } from '../types';
import {
  UserPreferencesContext,
  type UserPreferencesContextValue,
} from './userPreferencesContextValue';

function resolvedDarkMode(theme: ThemePreference): boolean {
  return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function applyTheme(theme: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolvedDarkMode(theme));
  document.documentElement.dataset.theme = theme;
}

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const themeRef = useRef<ThemePreference>('system');

  const applyAndRemember = useCallback((nextTheme: ThemePreference) => {
    themeRef.current = nextTheme;
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setPreferences(null);
      setThemeState('system');
      setError(null);
      applyAndRemember('system');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchUserPreferences(user.id)
      .then(async (stored) => {
        const preference = stored ?? await upsertUserPreferences(user.id, { theme: 'system' });
        if (cancelled) return;
        setPreferences(preference);
        setThemeState(preference.theme);
        applyAndRemember(preference.theme);
      })
      .catch(() => {
        // The app remains usable with the system palette; a later explicit save
        // gives the user a clear, inline error instead of silently claiming success.
        if (!cancelled) {
          setPreferences(null);
          setThemeState('system');
          setError('We could not load your saved appearance preference. System appearance is being used for now.');
          applyAndRemember('system');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyAndRemember, user?.id]);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback(async (nextTheme: ThemePreference) => {
    if (!user?.id) throw new Error('Your session has expired. Please sign in again.');
    const previousTheme = themeRef.current;
    setError(null);
    applyTheme(nextTheme);

    try {
      const saved = await upsertUserPreferences(user.id, { theme: nextTheme });
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
