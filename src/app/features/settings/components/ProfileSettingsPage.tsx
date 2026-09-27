import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Building2, Camera, Check, IdCard, Mail, ShieldCheck, Trash2, Upload, UserRound } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { clearProfileAvatar, getProfileAvatarUrl, replaceProfileAvatar, updateOwnProfile } from '../../../services/userSettingsService';
import { fetchAllOrgs } from '../../../../lib/supabaseService';
import { Input } from '../../../components/ui/input';
import { IdentityItem, ResultMessage, SectionHeading, SettingsLoading, Surface, formatRole, initials, inputClass, type Result } from './settingsPrimitives';

export function ProfileSettingsPage() {
  const { userProfile, updateUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.full_name ?? '');
  const [nameDirty, setNameDirty] = useState(false);
  const [office, setOffice] = useState('Loading office…');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameSaving, setNameSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [nameResult, setNameResult] = useState<Result>(null);
  const [avatarResult, setAvatarResult] = useState<Result>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!nameDirty) setDisplayName(userProfile?.full_name ?? '');
  }, [nameDirty, userProfile?.full_name]);

  useEffect(() => {
    let active = true;
    if (!userProfile) {
      setLoading(false);
      return;
    }

    setLoading(true);
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
        setAvatarResult({ tone: 'error', text: 'We could not load your private profile photo.' });
      })
      .finally(() => {
        if (active) setLoading(false);
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

  if (!userProfile || loading) {
    return <SettingsLoading label="Loading your personal profile…" />;
  }

  return (
    <div className="space-y-5">
      <Surface className="overflow-hidden">
        <div className="relative overflow-hidden bg-[#0c1c3d] px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <div className="absolute -right-12 -top-16 size-56 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 size-36 rounded-full bg-cyan-300/10 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-br from-blue-400 to-indigo-600 text-[22px] font-semibold text-white shadow-xl shadow-blue-950/30">
                {avatarUrl ? <img src={avatarUrl} alt="Your profile" className="size-full object-cover" /> : initials(userProfile.full_name)}
                <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">Personal workspace</p>
                <h2 className="mt-1 text-[20px] font-semibold text-white">{userProfile.full_name}</h2>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-50">
                  <ShieldCheck size={12} /> {formatRole(userProfile.role)}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] text-blue-100 backdrop-blur-sm">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-blue-300">Account identity</span>
              <span className="mt-0.5 block truncate font-medium text-white">{userProfile.email}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-neutral-100 px-5 py-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-7 dark:divide-slate-800">
          <IdentityItem icon={<Mail size={15} />} label="Email" value={userProfile.email} />
          <IdentityItem icon={<IdCard size={15} />} label="Employee ID" value={userProfile.employee_id || '—'} />
          <IdentityItem icon={<Building2 size={15} />} label="Office / section" value={office} />
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.78fr)]">
        <Surface className="p-5 sm:p-6">
          <SectionHeading icon={<UserRound size={19} />} eyebrow="Profile" title="How your name appears" description="Use a clear display name for assignments, messages, and activity." />
          <div className="mt-5 max-w-xl">
            <label htmlFor="display-name" className="mb-2 block text-[12px] font-medium text-neutral-700 dark:text-slate-200">Display name</label>
            <Input id="display-name" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setNameDirty(true); }} className={inputClass} maxLength={100} />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={saveName} disabled={nameSaving || !displayName.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                {nameSaving ? 'Saving…' : <><Check size={15} /> Save name</>}
              </button>
              {nameDirty && !nameSaving && <span className="text-[11px] text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            </div>
            <ResultMessage result={nameResult} />
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeading icon={<Camera size={19} />} eyebrow="Profile photo" title="A recognizable account" description="JPEG, PNG, or WebP. Up to 2 MB. Your photo stays private." />
          <div className="mt-5 flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 text-[17px] font-semibold text-white dark:from-slate-700 dark:to-slate-900">
              {avatarUrl ? <img src={avatarUrl} alt="Current profile" className="size-full object-cover" /> : initials(userProfile.full_name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileInput.current?.click()} disabled={avatarSaving} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] font-semibold text-neutral-700 transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-primary/10">
                  {avatarSaving ? 'Working…' : <><Upload size={14} /> {userProfile.avatar_path ? 'Replace' : 'Upload'}</>}
                </button>
                {userProfile.avatar_path && <button type="button" onClick={removePhoto} disabled={avatarSaving} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"><Trash2 size={14} /> Remove</button>}
              </div>
              <p className="mt-2 text-[10px] leading-4 text-neutral-500 dark:text-slate-400">A signed link is generated only for your active session.</p>
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onChoosePhoto} />
          <ResultMessage result={avatarResult} />
        </Surface>
      </div>
    </div>
  );
}
