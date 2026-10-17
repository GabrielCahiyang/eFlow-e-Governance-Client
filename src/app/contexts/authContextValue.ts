import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

export interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  permissionsLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (changes: Partial<Pick<UserProfile, 'full_name' | 'avatar_path' | 'email_notifications_enabled'>>) => void;
  clearError: () => void;
  // Capability check. UI convenience only — RLS remains the enforcement boundary.
  can: (permission: string) => boolean;
  permissions: Set<string>;
}

// Keep context identity independent of provider/hook reloads and cached lazy views.
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
