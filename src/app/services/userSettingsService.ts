import { supabase } from '../../lib/supabase';
import type { ThemePreference, UserPreferences } from '../types';

const AVATAR_BUCKET = 'profile-avatars';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const avatarTypes = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export interface OwnProfileChanges {
  full_name?: string;
  avatar_path?: string | null;
}

export interface SavedOwnProfile extends OwnProfileChanges {
  email_notifications_enabled?: boolean;
}

export function validateAvatarFile(file: File): void {
  if (!avatarTypes.has(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error('Profile photos must be 2 MB or smaller.');
  }
}

export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as UserPreferences | null;
}

export async function upsertUserPreferences(
  userId: string,
  changes: { theme: ThemePreference },
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, theme: changes.theme }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data as UserPreferences;
}

export async function updateOwnProfile(
  userId: string,
  changes: OwnProfileChanges,
): Promise<SavedOwnProfile> {
  const update: OwnProfileChanges = {};
  if (changes.full_name !== undefined) update.full_name = changes.full_name;
  if (changes.avatar_path !== undefined) update.avatar_path = changes.avatar_path;

  if (Object.keys(update).length === 0) {
    throw new Error('No profile changes were provided.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select('full_name, avatar_path, email_notifications_enabled')
    .single();

  if (error) throw error;
  return data as SavedOwnProfile;
}

export async function updateEmailPreference(
  userId: string,
  enabled: boolean,
): Promise<SavedOwnProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ email_notifications_enabled: enabled })
    .eq('id', userId)
    .select('full_name, avatar_path, email_notifications_enabled')
    .single();

  if (error) throw error;
  return data as SavedOwnProfile;
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  validateAvatarFile(file);
  const extension = avatarTypes.get(file.type)!;
  const objectPath = `${userId}/avatar.${extension}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, file, { upsert: true, cacheControl: '3600', contentType: file.type });

  if (error) throw error;
  return objectPath;
}

export async function removeProfileAvatar(_userId: string, avatarPath: string): Promise<void> {
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
  if (error) throw error;
}

export async function getProfileAvatarUrl(avatarPath: string | null | undefined): Promise<string | null> {
  if (!avatarPath) return null;
  // The private bucket permits owner reads only. Participant initials are the
  // fallback for other people's photos; do not send predictably denied signing
  // requests or expand Storage permissions to display them.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session || avatarPath.split('/')[0] !== session.user.id) return null;
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

// Keeps the storage and profile record aligned. If the profile update is
// rejected, the freshly uploaded private object is removed before surfacing it.
export async function replaceProfileAvatar(
  userId: string,
  file: File,
  previousAvatarPath: string | null | undefined,
): Promise<SavedOwnProfile> {
  const newPath = await uploadProfileAvatar(userId, file);
  let profileSaved = false;

  try {
    const profile = await updateOwnProfile(userId, { avatar_path: newPath });
    profileSaved = true;

    if (previousAvatarPath && previousAvatarPath !== newPath) {
      await removeProfileAvatar(userId, previousAvatarPath);
    }
    return profile;
  } catch (error) {
    if (!profileSaved) {
      try {
        await removeProfileAvatar(userId, newPath);
      } catch {
        // Preserve the original save error; the object remains private and can
        // only be reached through the owning user's storage policy.
      }
    }
    throw error;
  }
}

export async function clearProfileAvatar(
  userId: string,
  avatarPath: string,
): Promise<SavedOwnProfile> {
  await removeProfileAvatar(userId, avatarPath);
  return updateOwnProfile(userId, { avatar_path: null });
}
