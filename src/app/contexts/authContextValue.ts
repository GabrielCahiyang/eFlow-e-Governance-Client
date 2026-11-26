import { createContext, type Context } from 'react';
import type { User } from '@supabase/supabase-js';
import type { LogoutReason } from '../features/session-security/services/logoutNotice';
import type { UserProfile } from '../types';

export interface LogoutOptions {
  reason?: LogoutReason;
  preserveNotice?: boolean;
  silent?: boolean;
}

export interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  permissionsLoading: boolean;
  passwordRecovery?: boolean;
  accessRevision?: number;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearPasswordRecovery?: () => void;
  logout: (options?: LogoutOptions) => Promise<void>;
  updateUserProfile: (changes: Partial<Pick<UserProfile, 'full_name' | 'avatar_path' | 'email_notifications_enabled'>>) => void;
  clearError: () => void;
  // Capability check. UI convenience only — RLS remains the enforcement boundary.
  can: (permission: string) => boolean;
  permissions: Set<string>;
}

const GLOBAL_KEY = '__eflow_AuthContext__';
const globalStore = globalThis as unknown as Record<
  string,
  Context<AuthContextValue | undefined> | undefined
>;

// Keep context identity independent of provider/hook reloads and cached lazy views.
export const AuthContext =
  globalStore[GLOBAL_KEY] ??
  (globalStore[GLOBAL_KEY] = createContext<AuthContextValue | undefined>(undefined));
