import { normalizeUserRole } from "../shared/roles";
import { clearNavigationPreferences } from '../shared/navigationPreferences';
import { resetAuthCaches } from '../shared/authCacheReset';
import React, {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  fetchEffectivePermissions,
  resolvePermissions,
} from '../services/permissionService';
import {
  PERMISSIONS_CHANGED_EVENT,
  PERMISSIONS_CHANGED_STORAGE_KEY,
} from '../features/permissions/constants';
import { signInWithAccountProtection } from '../features/authentication';
import type { UserProfile, UserRole } from '../types';
import { AuthContext, type AuthContextValue } from './authContextValue';

// ─── Error message mapper ────────────────────────────────────────


// ─── Fetch auth key from LLM server ─────────────────────────────
// ─── Spread legacy compatibility aliases ─────────────────────────
function addCompatAliases(data: Record<string, unknown>): UserProfile {
  return {
    ...data,
    role: normalizeUserRole(data.role as UserRole),
    uid: data.id,
    fullName: data.full_name,
    avatarPath: typeof data.avatar_path === 'string' ? data.avatar_path : null,
    emailNotificationsEnabled: data.email_notifications_enabled !== false,
    employeeId: data.employee_id,
    departmentId: data.org_id,
    burnoutLevel: data.burnout_level,
    status: data.is_active ? 'active' : 'inactive',
    createdAt: typeof data.created_at === 'string' ? new Date(data.created_at).getTime() : 0,
    lastLogin: typeof data.updated_at === 'string' ? new Date(data.updated_at).getTime() : 0,
  } as unknown as UserProfile;
}

// ─── Provider ────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [permissionsLoadedFor, setPermissionsLoadedFor] = useState<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  // Load effective permissions whenever the signed-in profile changes, then
  // keep role defaults and this user's overrides live across open clients.
  useEffect(() => {
    let active = true;
    if (!userProfile?.id) {
      setPermissions(new Set());
      setPermissionsLoadedFor(null);
      return;
    }
    const userId = userProfile.id;
    const role = userProfile.role;
    setPermissions(resolvePermissions(role, [], []));
    const refreshPermissions = () => {
      void fetchEffectivePermissions(userId, role)
        .then((perms) => { if (active) { setPermissions(perms); setPermissionsLoadedFor(`${userId}:${role}`); } })
        .catch(() => { if (active) { setPermissions(resolvePermissions(role, [], [])); setPermissionsLoadedFor(`${userId}:${role}`); } });
    };
    refreshPermissions();

    const channel = supabase
      .channel(`effective-access:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions', filter: `role=eq.${role}` }, refreshPermissions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_permission_overrides', filter: `user_id=eq.${userId}` }, refreshPermissions)
      .subscribe();

    const refreshFromAppEvent = () => refreshPermissions();
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === PERMISSIONS_CHANGED_STORAGE_KEY) refreshPermissions();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshPermissions();
    };
    window.addEventListener(PERMISSIONS_CHANGED_EVENT, refreshFromAppEvent);
    window.addEventListener('storage', refreshFromStorage);
    window.addEventListener('focus', refreshFromAppEvent);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.removeEventListener(PERMISSIONS_CHANGED_EVENT, refreshFromAppEvent);
      window.removeEventListener('storage', refreshFromStorage);
      window.removeEventListener('focus', refreshFromAppEvent);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [userProfile?.id, userProfile?.role]);

  const can = useCallback(
    (permission: string) => {
      if (!userProfile || userProfile.is_active === false) return false;
        return permissions.has(permission);
    },
    [permissions, userProfile],
  );

  // Keep this listener synchronous. Supabase auth callbacks run while the
  // client holds its auth lock; awaiting another Supabase operation here can
  // deadlock startup and leave the application loading forever.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        const nextUserId = nextUser?.id ?? null;

        if (activeUserIdRef.current !== nextUserId) {
          resetAuthCaches();
          activeUserIdRef.current = nextUserId;
          setUserProfile(null);
        }

        setUser(nextUser);
        if (!nextUser) setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Profile loading deliberately happens after the auth callback has returned,
  // so all database work runs outside Supabase's auth lock.
  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    setLoading(true);
    setError(null);

    const refreshProfile = async () => {
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        if (active) setUserProfile(data ? addCompatAliases(data) : null);
      } catch (profileError) {
        if (!active) return;
        console.error('Failed to load the signed-in eFlow profile:', profileError);
        setUserProfile(null);
        setError(profileError instanceof Error && profileError.message.includes('Unsupported account role') ? profileError.message : 'We could not load your eFlow profile. Check your connection and refresh the page.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void refreshProfile();
    const refreshOnFocus = () => { void refreshProfile(); };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshOnFocus();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    const profileChannel = supabase
      .channel(`signed-in-profile:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (active && payload.new) {
            try { setUserProfile(addCompatAliases(payload.new as Record<string, unknown>)); }
            catch (profileError) {
              setUserProfile(null);
              setError(profileError instanceof Error ? profileError.message : 'Your account role could not be verified.');
            }
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);

  // ─── login ─────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {


      await signInWithAccountProtection(email, password);

      // Verify profile exists and is active
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData.user?.id;
      if (!userId) throw new Error('Login failed. Please try again.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .single();

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error('No eFlow profile found. Contact your IT administrator.');
      }
      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('Your account has been deactivated. Contact your IT administrator.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Login failed.';
      setError(msg);
      throw err;
    }
  }, []);

  // ─── resetPassword ─────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email.');
      throw err;
    }
  }, []);

  // ─── logout ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const navigationUserId = userProfile?.id || activeUserIdRef.current;
    try {
      if (userProfile?.id === 'SuperAdmin') {
        setUser(null);
        setUserProfile(null);
        return;
      }
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err: any) {
      setError('Failed to sign out. Please try again.');
    } finally {
      resetAuthCaches();
      if (navigationUserId) clearNavigationPreferences(navigationUserId);
      activeUserIdRef.current = null;
      setUser(null);
      setUserProfile(null);
      setPermissions(new Set());
    }
  }, [userProfile]);

  const clearError = useCallback(() => setError(null), []);

  // Settings saves use this to keep every signed-in-user surface (including
  // the sidebar avatar) in sync without waiting for a realtime round trip.
  const updateUserProfile = useCallback(
    (changes: Partial<Pick<UserProfile, 'full_name' | 'avatar_path' | 'email_notifications_enabled'>>) => {
      setUserProfile((current) =>
        current
          ? addCompatAliases({ ...current, ...changes } as unknown as Record<string, unknown>)
          : current,
      );
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        permissionsLoading: !!userProfile && permissionsLoadedFor !== `${userProfile.id}:${userProfile.role}`,
        error,
        login,
        resetPassword,
        logout,
        updateUserProfile,
        clearError,
        can,
        permissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// Re-export types for convenience
export type { UserProfile, UserRole };
