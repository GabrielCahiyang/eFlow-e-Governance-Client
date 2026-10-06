import { useState, type FormEvent } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';
import { Input } from '../../../components/ui/input';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { ResultMessage, SectionHeading, Surface, inputClass, type Result } from './settingsPrimitives';

export function SecuritySettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const clearPasswords = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
  };
  useNavigationBlocker({ label: 'Security', dirty: Boolean(currentPassword || newPassword || confirmation), pending: saving, onDiscard: clearPasswords });

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setResult(null);

    if (!currentPassword) {
      clearPasswords();
      setResult({ tone: 'error', text: 'Enter your current password to continue.' });
      return;
    }
    if (newPassword.length < 8) {
      clearPasswords();
      setResult({ tone: 'error', text: 'Your new password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmation) {
      clearPasswords();
      setResult({ tone: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    if (!user?.email) {
      clearPasswords();
      setResult({ tone: 'error', text: 'Your session has expired. Please sign in again.' });
      return;
    }

    setSaving(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) throw new Error('Your current password could not be verified.');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setResult({ tone: 'success', text: 'Password changed. Use your new password next time you sign in.' });
    } catch (error) {
      const message = error instanceof Error && error.message && error.message !== 'Your current password could not be verified.'
        ? error.message
        : 'Your current password could not be verified, or your session has expired.';
      setResult({ tone: 'error', text: message });
    } finally {
      clearPasswords();
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <Surface className="p-5 sm:p-6">
        <SectionHeading icon={<LockKeyhole size={19} />} eyebrow="Security" title="Change your password" description="For your protection, confirm your current password before choosing a new one." />
        <form onSubmit={changePassword} className="mt-6 max-w-xl space-y-4">
          <div>
            <label htmlFor="current-password" className="mb-2 block text-[12px] font-medium text-neutral-700 dark:text-slate-200">Current password</label>
            <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} disabled={saving} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-[12px] font-medium text-neutral-700 dark:text-slate-200">New password</label>
              <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} disabled={saving} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-[12px] font-medium text-neutral-700 dark:text-slate-200">Confirm new password</label>
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} disabled={saving} />
            </div>
          </div>
          <p className="text-[11px] leading-5 text-neutral-500 dark:text-slate-400">Use at least 8 characters. Any additional password policy configured for your account will be checked before saving.</p>
          <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
            <KeyRound size={15} /> {saving ? 'Updating password…' : 'Update password'}
          </button>
          <ResultMessage result={result} />
        </form>
      </Surface>
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[12px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        <p>Your password is never stored in eFlow profile data and is cleared from this form after every submission.</p>
      </div>
    </div>
  );
}
