import { isAdminRole, normalizeUserRole } from "../shared/roles";
import {
  getLoginPortal,
  isAdminLoginPath,
  isRoleAllowedForPortal,
  type LoginPortal,
} from "../shared/loginPortal";
import { clearNavigationPreferences } from '../shared/navigationPreferences';
import { resetAuthCaches } from '../shared/authCacheReset';
import { isQueryAccessDenied, isQueryConnectionFailure } from '../shared/queryAccess';
import { replaceNavigationHistory } from '../shared/navigationHistory';
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
  fetchOrganizationScopeGrants,
} from '../services/permissionService';
import {
  PERMISSIONS_CHANGED_EVENT,
  PERMISSIONS_CHANGED_STORAGE_KEY,
} from '../features/permissions/constants';
import { requestPasswordReset, signInWithAccountProtection } from '../features/authentication';
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
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [accessRevision, setAccessRevision] = useState(0);
  const activeUserIdRef = useRef<string | null>(null);
  const loginPortalRef = useRef<LoginPortal | null>(null);
  const profileScope = useRef<string | null>(null);
  const permissionScope = useRef<{ key: string; signature: string } | null>(null);
  const clearAccess = useCallback(() => {
    resetAuthCaches();
    setAccessRevision(value => value + 1);
  }, []);
  const publishProfile = useCallback((profile: UserProfile | null) => {
    const scope = profile ? JSON.stringify([profile.id, profile.org_id, profile.role, profile.custom_role_key ?? null, profile.is_active]) : null;
    if (profileScope.current !== null && profileScope.current !== scope) clearAccess();
    profileScope.current = scope;
    setUserProfile(profile);
  }, [clearAccess]);

  // Load effective permissions whenever the signed-in profile changes, then
  // keep role defaults and this user's overrides live across open clients.
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let verifyAccess = false;
    if (!userProfile?.id) {
      setPermissions(new Set());
      setPermissionsLoadedFor(null);
      permissionScope.current = null;
      return;
    }
    const userId = userProfile.id;
    const role = userProfile.role;
    const customRoleKey = userProfile.custom_role_key || null;
    const key = `${userId}:${role}:${customRoleKey || ''}`;
    const commitPermissions = (perms: Set<string>, officeScopes: string[] = []) => {
      const signature = JSON.stringify([[...perms].sort(), officeScopes]);
      if (permissionScope.current?.key === key && permissionScope.current.signature !== signature) clearAccess();
      permissionScope.current = { key, signature };
      setPermissions(perms);
      setPermissionsLoadedFor(key);
    };
    const refreshPermissions = (changed = false) => {
      verifyAccess ||= changed;
      const current = ++sequence;
      void Promise.all([fetchEffectivePermissions(userId, role, customRoleKey), fetchOrganizationScopeGrants(userId)])
        .then(([perms, grants]) => {
          if (!active || current !== sequence || activeUserIdRef.current !== userId) return;
          verifyAccess = false;
          const now = Date.now();
          const officeScopes = grants.filter(grant => !grant.expiresAt || Date.parse(grant.expiresAt) > now)
            .map(grant => JSON.stringify([grant.orgId, grant.accessLevel, grant.expiresAt])).sort();
          commitPermissions(perms, officeScopes);
        })
        .catch(error => {
          if (active && current === sequence && activeUserIdRef.current === userId &&
              (isQueryAccessDenied(error) || permissionScope.current?.key !== key || (verifyAccess && !isQueryConnectionFailure(error)))) commitPermissions(new Set());
        });
    };
    refreshPermissions();

    let subscribed = false;
    const baseChannel = supabase
      .channel(`effective-access:${userId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions', filter: `role=eq.${role}` }, () => refreshPermissions(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_permission_overrides', filter: `user_id=eq.${userId}` }, () => refreshPermissions(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_org_scope_grants', filter: `user_id=eq.${userId}` }, () => refreshPermissions(true));
    if (customRoleKey) {
      baseChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions', filter: `role=eq.${customRoleKey}` }, () => refreshPermissions(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_roles', filter: `key=eq.${customRoleKey}` }, () => refreshPermissions(true));
    }
    const channel = baseChannel
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return;
        if (subscribed) refreshPermissions();
        subscribed = true;
      });

    let lastVisibleRefresh = Date.now();
    const refreshFromAppEvent = () => refreshPermissions(true);
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === PERMISSIONS_CHANGED_STORAGE_KEY) refreshPermissions(true);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibleRefresh < 30_000) return;
      lastVisibleRefresh = now;
      refreshPermissions();
    };
    const refreshOnOnline = () => {
      if (document.visibilityState !== 'visible') return;
      lastVisibleRefresh = Date.now();
      refreshPermissions();
    };
    window.addEventListener(PERMISSIONS_CHANGED_EVENT, refreshFromAppEvent);
    window.addEventListener('storage', refreshFromStorage);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshOnOnline);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const fallback = window.setInterval(refreshWhenVisible, 120_000);

    return () => {
      active = false;
      window.removeEventListener(PERMISSIONS_CHANGED_EVENT, refreshFromAppEvent);
      window.removeEventListener('storage', refreshFromStorage);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshOnOnline);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [userProfile?.id, userProfile?.role, userProfile?.custom_role_key, clearAccess]);

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
      (event, session) => {
        const nextUser = session?.user ?? null;
        const nextUserId = nextUser?.id ?? null;

        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT' || !nextUser) {
          setPasswordRecovery(false);
        }

        if (activeUserIdRef.current !== nextUserId) {
          resetAuthCaches();
          activeUserIdRef.current = nextUserId;
          profileScope.current = null;
          permissionScope.current = null;
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
    let profileRequest = 0;
    setLoading(true);
    setError(null);

    const refreshProfile = async () => {
      const request = ++profileRequest;
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        if (!active || request !== profileRequest || activeUserIdRef.current !== user.id) return;
        const requiredPortal = loginPortalRef.current ?? (isAdminLoginPath() ? 'admin' : null);
        if (requiredPortal && !isRoleAllowedForPortal(data?.role as string | undefined, requiredPortal)) {
          publishProfile(null);
          setError('Email or password is incorrect.');
          await supabase.auth.signOut({ scope: 'local' });
        } else if (data?.is_active === false) {
          publishProfile(null);
          setError('This account has been deactivated. Contact an Admin.');
          await supabase.auth.signOut({ scope: 'local' });
        } else publishProfile(data ? addCompatAliases(data) : null);
      } catch (profileError) {
        if (!active || request !== profileRequest || activeUserIdRef.current !== user.id) return;
        console.error('Failed to load the signed-in eFlow profile:', profileError);
        const profileMissing = (profileError as { code?: string } | null)?.code === 'PGRST116';
        const invalidRole = profileError instanceof Error && profileError.message.includes('Unsupported account role');
        if (profileScope.current !== null && !profileMissing && !invalidRole && !isQueryAccessDenied(profileError)) return;
        publishProfile(null);
        setError(invalidRole ? profileError.message : 'We could not load your eFlow profile. Check your connection and refresh the page.');
      } finally {
        if (active && request === profileRequest) setLoading(false);
      }
    };
    void refreshProfile();
    let lastVisibleProfileRefresh = Date.now();
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibleProfileRefresh < 30_000) return;
      lastVisibleProfileRefresh = now;
      void refreshProfile();
    };
    const refreshProfileOnOnline = () => {
      if (document.visibilityState !== 'visible') return;
      lastVisibleProfileRefresh = Date.now();
      void refreshProfile();
    };
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshProfileOnOnline);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const fallback = window.setInterval(refreshWhenVisible, 120_000);

    let subscribed = false;
    const profileChannel = supabase
      .channel(`signed-in-profile:${user.id}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (active && activeUserIdRef.current === user.id && payload.new) {
            profileRequest++;
            setLoading(false);
            if (payload.new.is_active === false) {
              publishProfile(null);
              setError('This account has been deactivated. Contact an Admin.');
              void supabase.auth.signOut({ scope: 'local' });
              return;
            }
            try { publishProfile(addCompatAliases(payload.new as Record<string, unknown>)); }
            catch (profileError) {
              publishProfile(null);
              setError(profileError instanceof Error ? profileError.message : 'Your account role could not be verified.');
            }
          }
        },
      )
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return;
        if (subscribed) refreshWhenVisible();
        subscribed = true;
      });

    return () => {
      active = false;
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshProfileOnOnline);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(fallback);
      void supabase.removeChannel(profileChannel);
    };
  }, [user?.id, publishProfile]);

  // ─── login ─────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const portal = getLoginPortal();
    loginPortalRef.current = portal;
    try {
      await signInWithAccountProtection(email, password, portal);

      // Verify profile exists, matches the login portal, and is active
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData.user?.id;
      if (!userId) throw new Error('Login failed. Please try again.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, role')
        .eq('id', userId)
        .single();

      if (!profile) {
        await supabase.auth.signOut();
        throw new Error('No eFlow profile found. Contact your IT administrator.');
      }
      if (profile.role && !isRoleAllowedForPortal(profile.role as string, portal)) {
        publishProfile(null);
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error('Email or password is incorrect.');
      }
      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('Your account has been deactivated. Contact your IT administrator.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Login failed.';
      setError(msg);
      throw err;
    } finally {
      loginPortalRef.current = null;
    }
  }, [publishProfile]);

  // ─── resetPassword ─────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string) => {
    try {
      await requestPasswordReset(email);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email.');
      throw err;
    }
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  // ─── logout ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const navigationUserId = userProfile?.id || activeUserIdRef.current;
    const logoutRedirectPath = isAdminRole(userProfile?.role) || isAdminLoginPath() ? '/admin' : '/';
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
      if (!['/activate-account','/accept-invite','/accept-project-invite','/project-share','/manage-project-share','/reset-password'].includes(window.location.pathname)) replaceNavigationHistory(logoutRedirectPath);
      activeUserIdRef.current = null;
      profileScope.current = null;
      permissionScope.current = null;
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
        permissionsLoading: !!userProfile && permissionsLoadedFor !== `${userProfile.id}:${userProfile.role}:${userProfile.custom_role_key || ''}`,
        passwordRecovery,
        accessRevision,
        error,
        login,
        resetPassword,
        clearPasswordRecovery,
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
