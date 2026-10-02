import { isAdminRole, normalizeUserRole } from "../shared/roles";
import React, {
  createContext,
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
import { controlPanelFetch } from '../shared/controlPanelClient';
import type { UserProfile, UserRole } from '../types';

// ─── Error message mapper ────────────────────────────────────────
function mapSupabaseAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Invalid email or password.';
  if (msg.includes('Email not confirmed')) return 'Email not confirmed. Contact your administrator.';
  if (msg.includes('Too many requests')) return 'Too many attempts. Please try again later.';
  if (msg.includes('User already registered')) return 'An account with this email already exists.';
  if (msg.includes('Password should be')) return 'Password must be at least 6 characters.';
  return msg;
}

// ─── Context Value ───────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
    orgId?: string,
  ) => Promise<void>;
  createManagedUser: (
    newEmail: string,
    newPassword: string,
    profile: { full_name: string; role: UserRole; org_id?: string; employee_id?: string | null; skills?: Record<string, boolean> },
  ) => Promise<string>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (changes: Partial<Pick<UserProfile, 'full_name' | 'avatar_path' | 'email_notifications_enabled'>>) => void;
  clearError: () => void;
  // Capability check. UI convenience only — RLS remains the enforcement boundary.
  can: (permission: string) => boolean;
  permissions: Set<string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
  const activeUserIdRef = useRef<string | null>(null);

  // Load effective permissions whenever the signed-in profile changes, then
  // keep role defaults and this user's overrides live across open clients.
  useEffect(() => {
    let active = true;
    if (!userProfile?.id) {
      setPermissions(new Set());
      return;
    }
    const userId = userProfile.id;
    const role = userProfile.role;
    setPermissions(resolvePermissions(role, [], []));
    const refreshPermissions = () => {
      void fetchEffectivePermissions(userId, role)
        .then((perms) => { if (active) setPermissions(perms); })
        .catch(() => { if (active) setPermissions(resolvePermissions(role, [], [])); });
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
      // Admin implicitly holds every capability.
      if (isAdminRole(userProfile?.role)) return true;
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
        setError('We could not load your eFlow profile. Check your connection and refresh the page.');
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
            setUserProfile(addCompatAliases(payload.new as Record<string, unknown>));
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


      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw new Error(mapSupabaseAuthError(authError.message));

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

  // ─── register (first-time setup only) ──────────────────────────
  const register = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: UserRole,
      orgId = '',
    ) => {
      setError(null);
      try {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw new Error(mapSupabaseAuthError(authError.message));
        if (!data.user) throw new Error('Registration failed.');

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            full_name: fullName,
            email,
            role,
            org_id: orgId || null,
            employee_id: data.user.id,
            skills: {},
            workload: 0,
            burnout_level: 'low',
            is_active: true,
          });

        if (profileError) throw profileError;
      } catch (err: any) {
        setError(err?.message || 'Registration failed.');
        throw err;
      }
    },
    [],
  );

  // ─── createManagedUser (calls FastAPI server) ──────────────────
  const createManagedUser = useCallback(
    async (
      newEmail: string,
      newPassword: string,
      profileData: { full_name: string; role: UserRole; org_id?: string; employee_id?: string | null; skills?: Record<string, boolean> },
    ): Promise<string> => {
      setError(null);
      try {
        const res = await controlPanelFetch('admin/users/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: newEmail,
            password: newPassword,
            full_name: profileData.full_name,
            role: profileData.role,
            org_id: profileData.org_id || null,
            skills: profileData.skills || {},
          }),
        }, { retryOnEndpointChange: true });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to create user.');
        }

        const { uid } = await res.json();
        return uid;
      } catch (err: any) {
        const msg = err?.message || 'Failed to create user.';
        setError(msg);
        throw err;
      }
    },
    [],
  );

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
        error,
        login,
        register,
        createManagedUser,
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
