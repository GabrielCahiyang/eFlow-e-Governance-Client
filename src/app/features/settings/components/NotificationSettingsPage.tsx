import { useState } from 'react';
import { Bell, Mail } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { updateEmailPreference } from '../../../services/userSettingsService';
import { Switch } from '../../../components/ui/switch';
import { ResultMessage, SectionHeading, Surface, type Result } from './settingsPrimitives';

export function NotificationSettingsPage() {
  const { userProfile, updateUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const enabled = userProfile?.email_notifications_enabled ?? true;

  const toggleEmail = async (nextEnabled: boolean) => {
    if (!userProfile) return;
    setSaving(true);
    setResult(null);
    try {
      const saved = await updateEmailPreference(userProfile.id, nextEnabled);
      updateUserProfile({ email_notifications_enabled: saved.email_notifications_enabled ?? nextEnabled });
      setResult({ tone: 'success', text: nextEnabled ? 'Task email notifications are on.' : 'Task email notifications are off.' });
    } catch {
      setResult({ tone: 'error', text: 'We could not update email notifications. Your previous setting is unchanged.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <Surface className="overflow-hidden">
        <div className="border-b border-neutral-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-5 dark:border-slate-800 dark:from-blue-950/35 dark:to-cyan-950/20 sm:px-6">
          <SectionHeading icon={<Bell size={19} />} eyebrow="Notifications" title="Keep task work moving" description="Choose whether eFlow may email you about tasks that need your attention." />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${enabled ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary' : 'bg-neutral-100 text-neutral-400 dark:bg-slate-900 dark:text-slate-500'}`}><Mail size={18} /></span>
              <div>
                <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-slate-100">Task email notifications</h3>
                <p className="mt-1 max-w-lg text-[12px] leading-5 text-neutral-500 dark:text-slate-400">Receive email when work is assigned to you, updated, or needs your review. In-app notifications remain available either way.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
              <span className={`text-[11px] font-semibold ${enabled ? 'text-primary dark:text-primary' : 'text-neutral-500 dark:text-slate-400'}`}>{saving ? 'Saving…' : enabled ? 'On' : 'Off'}</span>
              <Switch checked={enabled} onCheckedChange={toggleEmail} disabled={saving} aria-label="Task email notifications" className="data-[state=checked]:bg-primary" />
            </div>
          </div>
          <ResultMessage result={result} />
        </div>
      </Surface>
    </div>
  );
}
