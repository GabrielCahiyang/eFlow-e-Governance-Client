import { attachmentError } from '../../../shared/fileValidation';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Building2, Calendar, Check, IdCard, Mail, ShieldCheck, Trash2, Upload, UserRound } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { clearProfileAvatar, getProfileAvatarUrl, replaceProfileAvatar, updateOwnProfile } from '../../../services/userSettingsService';
import { fetchAllOrgs } from '../../../../lib/supabaseService';
import { Input } from '../../../components/ui/input';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import {
  readPersonalSettings,
  savePersonalSettings,
  type DateDisplayFormat,
  type PersonalSettings,
  type TimeDisplayFormat,
  type WeekStartDay,
} from '../personalSettingsStore';
import { IdentityItem, ResultMessage, SectionHeading, Surface, formatRole, initials, inputClass, type Result } from './settingsPrimitives';

function ProfileSettingsSkeleton() {
  const pulse = 'animate-pulse rounded bg-[var(--eflow-subtle)]';
  return (
    <div className="space-y-5" role="status" aria-label="Loading your personal profile…">
      <span className="sr-only">Loading your personal profile…</span>
      <div aria-hidden="true" className="space-y-5">
        <Surface className="overflow-hidden">
          <div className="border-b border-[var(--eflow-border)] px-5 py-5 sm:px-7">
            <div className="flex items-center gap-4">
              <div className={`size-16 shrink-0 rounded-xl ${pulse}`} />
              <div className="space-y-2">
                <div className={`h-5 w-44 ${pulse}`} />
                <div className={`h-3.5 w-60 ${pulse}`} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-[var(--eflow-border)] px-5 py-3 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-7">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-3 py-2 sm:px-3">
                <div className={`size-7 shrink-0 rounded-lg ${pulse}`} />
                <div className="space-y-1.5">
                  <div className={`h-2.5 w-16 ${pulse}`} />
                  <div className={`h-3.5 w-32 ${pulse}`} />
                </div>
              </div>
            ))}
          </div>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <div className={`h-4 w-36 ${pulse}`} />
          <div className={`mt-4 h-10 max-w-md ${pulse}`} />
        </Surface>
      </div>
    </div>
  );
}

export function ProfileSettingsPage() {
  const { userProfile, updateUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.full_name ?? '');
  const [nameDirty, setNameDirty] = useState(false);
  const [office, setOffice] = useState(userProfile?.org_name ?? 'Loading office…');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [nameResult, setNameResult] = useState<Result>(null);
  const [avatarResult, setAvatarResult] = useState<Result>(null);
  const [regional, setRegional] = useState<PersonalSettings>(() => readPersonalSettings(userProfile?.id));
  const [regionalSaved, setRegionalSaved] = useState<Result>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useNavigationBlocker({
    label: 'Profile',
    dirty: nameDirty && displayName !== (userProfile?.full_name ?? ''),
    pending: nameSaving || avatarSaving,
    onDiscard: () => {
      setNameDirty(false);
      setDisplayName(userProfile?.full_name ?? '');
    },
  });

  useEffect(() => {
    if (!nameDirty) setDisplayName(userProfile?.full_name ?? '');
  }, [nameDirty, userProfile?.full_name]);

  useEffect(() => {
    setRegional(readPersonalSettings(userProfile?.id));
    setRegionalSaved(null);
  }, [userProfile?.id]);

  useEffect(() => {
    let active = true;
    if (!userProfile) return;

    Promise.all([
      getProfileAvatarUrl(userProfile.avatar_path),
      fetchAllOrgs(),
    ])
      .then(([url, organizations]) => {
        if (!active) return;
        setAvatarUrl(url);
        const currentOffice = organizations.find((organization) => organization.id === userProfile.org_id)?.name;
        setOffice(currentOffice ?? userProfile.org_name ?? 'Not assigned');
      })
      .catch(() => {
        if (!active) return;
        setAvatarUrl(null);
        setOffice(userProfile.org_name ?? 'Unavailable');
      });

    return () => {
      active = false;
    };
  }, [userProfile?.avatar_path, userProfile?.id, userProfile?.org_id, userProfile?.org_name]);

  const saveName = async () => {
    const nextName = displayName.trim();
    if (!userProfile) return;
    if (!nextName) {
      setNameResult({ tone: 'error', text: 'Display name cannot be empty.' });
      return;
    }

    setNameSaving(true);
    setNameResult(null);
    try {
      const saved = await updateOwnProfile(userProfile.id, { full_name: nextName });
      updateUserProfile({ full_name: saved.full_name ?? nextName });
      setDisplayName(saved.full_name ?? nextName);
      setNameDirty(false);
      setNameResult({ tone: 'success', text: 'Display name saved across your account.' });
    } catch {
      setNameResult({ tone: 'error', text: 'We could not save your display name. Please try again.' });
    } finally {
      setNameSaving(false);
    }
  };

  const onChoosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userProfile) return;
    const issue = attachmentError([file], { maxMb: 2, maxCount: 1, extensions: ['jpg', 'jpeg', 'png', 'webp'] });
    if (issue) {
      setAvatarResult({ tone: 'error', text: issue });
      return;
    }

    setAvatarSaving(true);
    setAvatarResult(null);
    try {
      const saved = await replaceProfileAvatar(userProfile.id, file, userProfile.avatar_path);
      const savedPath = saved.avatar_path ?? null;
      const signedUrl = await getProfileAvatarUrl(savedPath);
      updateUserProfile({ avatar_path: savedPath });
      setAvatarUrl(signedUrl);
      setAvatarResult({ tone: 'success', text: 'Profile photo updated.' });
    } catch (error) {
      setAvatarResult({ tone: 'error', text: error instanceof Error ? error.message : 'We could not update your profile photo.' });
    } finally {
      setAvatarSaving(false);
    }
  };

  const removePhoto = async () => {
    if (!userProfile?.avatar_path) return;
    setAvatarSaving(true);
    setAvatarResult(null);
    try {
      await clearProfileAvatar(userProfile.id, userProfile.avatar_path);
      updateUserProfile({ avatar_path: null });
      setAvatarUrl(null);
      setAvatarResult({ tone: 'success', text: 'Profile photo removed. Your initials are now shown.' });
    } catch {
      setAvatarResult({ tone: 'error', text: 'We could not remove your profile photo. Please try again.' });
    } finally {
      setAvatarSaving(false);
    }
  };

  const updateRegional = (patch: Partial<PersonalSettings>) => {
    const next = savePersonalSettings(userProfile?.id, patch);
    setRegional(next);
    setRegionalSaved({ tone: 'success', text: 'Regional preference saved on this browser.' });
  };

  if (!userProfile) {
    return <ProfileSettingsSkeleton />;
  }

  return (
    <div className="space-y-5">
      {/* Unified Identity & Photo Card (single avatar + inline photo controls) */}
      <Surface className="overflow-hidden">
        <div className="border-b border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[var(--eflow-border)] bg-[var(--eflow-primary)] text-[20px] font-semibold text-[var(--eflow-on-primary)]">
                {avatarUrl ? <img src={avatarUrl} alt="Your profile" className="size-full object-cover" /> : initials(userProfile.full_name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[18px] font-semibold text-[var(--eflow-text)]">{userProfile.full_name}</h2>
                  <span className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--eflow-border)] bg-[var(--eflow-selected)] px-2 py-0.5 text-[11px] font-medium text-[var(--eflow-on-selected)]">
                    <ShieldCheck size={12} /> {formatRole(userProfile.role)}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--eflow-text-muted)]">
                  JPEG, PNG, or WebP up to 2 MB · Private signed link for your active session
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={avatarSaving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[12px] font-medium text-[var(--eflow-text)] transition hover:border-[var(--eflow-primary)] hover:bg-[var(--eflow-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload size={14} aria-hidden="true" />
                <span>{avatarSaving ? 'Working…' : userProfile.avatar_path ? 'Replace photo' : 'Upload photo'}</span>
              </button>
              {userProfile.avatar_path && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={avatarSaving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-[12px] font-medium text-[var(--eflow-negative-text)] transition hover:bg-[var(--eflow-negative-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Remove</span>
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload profile photo" onChange={onChoosePhoto} />
            </div>
          </div>
          <ResultMessage result={avatarResult} />
        </div>
        <div className="grid grid-cols-1 divide-y divide-[var(--eflow-border)] px-5 py-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          <IdentityItem icon={<Mail size={15} />} label="Email" value={userProfile.email} />
          <IdentityItem icon={<IdCard size={15} />} label="Employee ID" value={userProfile.employee_id || '—'} />
          <IdentityItem icon={<Building2 size={15} />} label="Office / section" value={office} />
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Surface className="p-5 sm:p-6">
          <SectionHeading
            icon={<UserRound size={18} />}
            title="Display name"
            description="Shown on task assignments, reviews, comments, and activity logs."
          />
          <div className="mt-4">
            <label htmlFor="display-name" className="mb-1.5 block text-[12px] font-medium text-[var(--eflow-text-secondary)]">
              Display name
            </label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setNameDirty(true);
              }}
              className={inputClass}
              maxLength={100}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveName}
                disabled={nameSaving || !displayName.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {nameSaving ? 'Saving…' : <><Check size={14} aria-hidden="true" /> Save name</>}
              </button>
              {nameDirty && !nameSaving && (
                <span className="text-[11.5px] font-medium text-[var(--eflow-warning-text)]">Unsaved changes</span>
              )}
            </div>
            <ResultMessage result={nameResult} />
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeading
            icon={<Calendar size={18} />}
            title="Regional display"
            description="Personalize how dates, timestamps, and calendars are formatted."
          />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[12px] font-medium text-[var(--eflow-text-secondary)]">
              <span>Date format</span>
              <select
                aria-label="Date format"
                value={regional.dateFormat}
                onChange={(e) => updateRegional({ dateFormat: e.target.value as DateDisplayFormat })}
                className="h-10 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[13px] font-normal text-[var(--eflow-text)]"
              >
                <option value="dmy">17 Nov 2026</option>
                <option value="mdy">Nov 17, 2026</option>
                <option value="iso">2026-11-17</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-[12px] font-medium text-[var(--eflow-text-secondary)]">
              <span>Time format</span>
              <select
                aria-label="Time format"
                value={regional.timeFormat}
                onChange={(e) => updateRegional({ timeFormat: e.target.value as TimeDisplayFormat })}
                className="h-10 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[13px] font-normal text-[var(--eflow-text)]"
              >
                <option value="12h">12-hour (2:30 PM)</option>
                <option value="24h">24-hour (14:30)</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-[12px] font-medium text-[var(--eflow-text-secondary)] sm:col-span-2">
              <span>Week starts on</span>
              <select
                aria-label="Week starts on"
                value={regional.weekStartsOn}
                onChange={(e) => updateRegional({ weekStartsOn: e.target.value as WeekStartDay })}
                className="h-10 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[13px] font-normal text-[var(--eflow-text)]"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </label>
          </div>
          <ResultMessage result={regionalSaved} />
        </Surface>
      </div>
    </div>
  );
}
