import { createContext, type Context } from 'react';
import type { ThemePreference, UserPreferences } from '../types';

export interface UserPreferencesContextValue {
  preferences: UserPreferences | null;
  theme: ThemePreference;
  loading: boolean;
  error: string | null;
  setTheme: (theme: ThemePreference) => Promise<void>;
}

const GLOBAL_KEY = '__eflow_UserPreferencesContext__';
const globalStore = globalThis as unknown as Record<
  string,
  Context<UserPreferencesContextValue | undefined> | undefined
>;

// Keep context identity independent of provider/hook HMR reloads and cached lazy views.
export const UserPreferencesContext =
  globalStore[GLOBAL_KEY] ??
  (globalStore[GLOBAL_KEY] = createContext<UserPreferencesContextValue | undefined>(undefined));
