import { normalizeUserRole } from "../app/shared/roles";
// ─── eFlow Supabase Service Layer ────────────────────────────────
// All Supabase reads/writes centralized here.
// Components never import supabase directly.

import { supabase } from './supabase';
import type { Organization, UserProfile, SystemConfig, OrgType } from '../app/types';

// ─── Local State Listener System ─────────────────────────────────
// Ensures the client UI updates immediately on local modifications
// even if Postgres Realtime replication is disabled or lagging.
const orgListeners = new Set<(orgs: Organization[]) => void>();
const profileListeners = new Set<(profiles: UserProfile[]) => void>();

async function notifyOrgListeners(forcedOrgs?: Organization[]) {
  try {
    const orgs = forcedOrgs || await fetchAllOrgs();
    orgListeners.forEach(cb => {
      try { cb(orgs); } catch (e) { console.error("Error in org listener:", e); }
    });
  } catch (err) {
    console.error("Error fetching orgs for notification:", err);
  }
}

async function notifyProfileListeners(forcedProfiles?: UserProfile[]) {
  try {
    const profiles = forcedProfiles || await fetchAllProfiles();
    profileListeners.forEach(cb => {
      try { cb(profiles); } catch (e) { console.error("Error in profile listener:", e); }
    });
  } catch (err) {
    console.error("Error fetching profiles for notification:", err);
  }
}

export async function refreshProfiles(): Promise<void> {
  await notifyProfileListeners();
}

// ─── ORGANIZATION OPERATIONS ─────────────────────────────────────

export async function fetchAllOrgs(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('path');

  if (error) throw error;
  return data as Organization[];
}

// ─── getDescendantOrgIds ────────────────────────────────────────────
// Given the full org list and an anchor org id, returns the anchor's id
// plus every descendant's id (using the ltree `path` column). Used to
// scope tasks/employees to "everything under my node," not just an
// exact match on my own node — this is what lets a Dept Head see their
// sub-sections' tasks, and a Team Leader see only their own section.
export function getDescendantOrgIds(
  orgs: Organization[],
  anchorOrgId: string | null | undefined,
): string[] {
  if (!anchorOrgId) return [];
  const anchor = orgs.find((o) => o.id === anchorOrgId);
  if (!anchor) return [anchorOrgId];
  return orgs
    .filter((o) => o.path === anchor.path || o.path.startsWith(`${anchor.path}.`))
    .map((o) => o.id);
}

// ─── getAncestorOrgIds ───────────────────────────────────────────────
// Given a user's own org, returns that org's id plus every ancestor's
// id — the opposite direction from getDescendantOrgIds. Used to find
// which standing channels (own section, parent office, department...)
// a user should see.
export function getAncestorOrgIds(
  orgs: Organization[],
  orgId: string | null | undefined,
): string[] {
  if (!orgId) return [];
  const org = orgs.find((o) => o.id === orgId);
  if (!org) return [orgId];
  const parts = org.path.split(".");
  const ancestorPaths = parts.map((_, i) => parts.slice(0, i + 1).join("."));
  return orgs.filter((o) => ancestorPaths.includes(o.path)).map((o) => o.id);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function computePath(parent_id: string | null, slug: string): Promise<string> {
  if (!parent_id) return slug;
  const { data, error } = await supabase
    .from('organizations')
    .select('path')
    .eq('id', parent_id)
    .single();

  if (error || !data) throw new Error('Parent organization not found');
  return `${data.path}.${slug}`;
}

async function ensureUniqueSlug(slug: string): Promise<string> {
  let candidate = slug;
  let counter = 2;
  while (true) {
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data) break;
    candidate = `${slug}_${counter}`;
    counter++;
  }
  return candidate;
}

export async function createOrg(data: {
  name: string;
  slug?: string;
  parent_id: string | null;
  org_type: OrgType;
  description?: string;
}): Promise<Organization> {
  const baseSlug = data.slug || generateSlug(data.name);
  const slug = await ensureUniqueSlug(baseSlug);
  const path = await computePath(data.parent_id, slug);

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name: data.name,
      slug,
      parent_id: data.parent_id,
      path,
      org_type: data.org_type,
      description: data.description || '',
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  notifyOrgListeners();
  return org as Organization;
}

export async function recreateOrg(org: Organization): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      id: org.id,
      name: org.name,
      slug: org.slug,
      parent_id: org.parent_id,
      path: org.path,
      org_type: org.org_type,
      description: org.description,
      head_user_id: org.head_user_id,
      is_active: org.is_active,
    })
    .select()
    .single();

  if (error) throw error;
  notifyOrgListeners();
  return data as Organization;
}

export async function updateOrg(id: string, partial: Partial<Organization>): Promise<void> {
  const { error } = await supabase
    .from('organizations')
    .update({ ...partial, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  notifyOrgListeners();
}

export async function deleteOrg(id: string): Promise<void> {
  const { count: childCount } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', id);

  if (childCount && childCount > 0) {
    throw new Error('Cannot delete organization with child offices. Remove or reassign children first.');
  }

  const { count: userCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', id);

  if (userCount && userCount > 0) {
    throw new Error('Cannot delete organization with assigned users. Reassign users first.');
  }

  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', id);

  if (error) throw error;
  notifyOrgListeners();
}

export async function assignOrgHead(orgId: string, userId: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_organization_leadership', {
    p_org_id: orgId,
    p_head_user_id: userId,
    p_assistant_head_user_id: null,
  });

  if (error) throw error;
  await refreshOrganizationDirectory();
}

export async function refreshOrganizationDirectory(): Promise<void> {
  await Promise.all([notifyOrgListeners(), notifyProfileListeners()]);
}

export function subscribeToOrgs(callback: (orgs: Organization[]) => void): () => void {
  orgListeners.add(callback);
  
  const channelId = `orgs_realtime_${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'organizations' },
      async () => {
        const orgs = await fetchAllOrgs();
        notifyOrgListeners(orgs);
      }
    )
    .subscribe();

  return () => {
    orgListeners.delete(callback);
    supabase.removeChannel(channel);
  };
}

// ─── PROFILE OPERATIONS ──────────────────────────────────────────

export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name');

  if (error) throw error;
  return (data || []).map(profile => ({ ...profile, role: normalizeDirectoryRole(profile.role) })) as UserProfile[];
}

export async function fetchProfileById(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? { ...data, role: normalizeDirectoryRole(data.role) } as UserProfile : null;
}

export async function createProfile(data: {
  full_name: string;
  email: string;
  password: string;
  role: string;
  org_id?: string;
  employee_id?: string;
}): Promise<UserProfile> {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });

  if (authError) throw authError;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user?.id,
      full_name: data.full_name,
      email: data.email,
      employee_id: data.employee_id || '',
      org_id: data.org_id || null,
      role: data.role,
      skills: {},
      workload: 0,
      burnout_level: 'low',
      is_active: true,
    })
    .select()
    .single();

  if (profileError) throw profileError;
  notifyProfileListeners();
  return { ...profile, role: normalizeDirectoryRole(profile.role) } as UserProfile;
}

export async function updateProfile(id: string, partial: Partial<UserProfile>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...partial, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  notifyProfileListeners();
}

export async function assignUserToOrg(userId: string, orgId: string | null): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ org_id: orgId, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
  notifyProfileListeners();
}

export async function toggleUserActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  notifyProfileListeners();
}

export function subscribeToProfiles(callback: (profiles: UserProfile[]) => void): () => void {
  profileListeners.add(callback);
  
  const channelId = `profiles_realtime_${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      async () => {
        const profiles = await fetchAllProfiles();
        notifyProfileListeners(profiles);
      }
    )
    .subscribe();

  return () => {
    profileListeners.delete(callback);
    supabase.removeChannel(channel);
  };
}

// ─── updateOwnProfile ───────────────────────────────────────────────
// For the logged-in user editing their own profile. Whitelisted fields
// only — role/org_id/is_active are blocked client-side here AND at the
// DB level via the guard_self_profile_update trigger (defense in depth).
export async function updateOwnProfile(
  userId: string,
  data: { full_name?: string },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (data.full_name !== undefined) update.full_name = data.full_name;

  const { error } = await supabase.from("profiles").update(update).eq("id", userId);
  if (error) throw error;
}

// ─── updateEmailPreference ──────────────────────────────────────────
export async function updateEmailPreference(
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ email_notifications_enabled: enabled })
    .eq("id", userId);
  if (error) throw error;
}

// ─── SYSTEM CONFIG OPERATIONS ────────────────────────────────────

export async function fetchConfig(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return data?.value || null;
}

export async function updateConfig(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('system_config')
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw error;
}

export async function fetchAllConfig(): Promise<SystemConfig[]> {
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .order('key');

  if (error) throw error;
  return data as SystemConfig[];
}

function normalizeDirectoryRole(role: unknown): string {
  try { return normalizeUserRole(role); } catch { return typeof role === "string" ? role : "unsupported"; }
}
