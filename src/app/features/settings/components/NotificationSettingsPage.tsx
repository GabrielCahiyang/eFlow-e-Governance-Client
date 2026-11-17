import { useEffect, useState } from 'react';
import { Bell, Mail, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { updateEmailPreference } from '../../../services/userSettingsService';
import { Switch } from '../../../components/ui/switch';
import {
  readPersonalSettings,
  savePersonalSettings,
  type PersonalSettings,
} from '../personalSettingsStore';
import { ResultMessage, SectionHeading, Surface, type Result } from './settingsPrimitives';

export function NotificationSettingsPage() {
  const { userProfile, updateUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [inboxPrefs, setInboxPrefs] = useState<PersonalSettings>(() => readPersonalSettings(userProfile?.id));
  const [prefResult, setPrefResult] = useState<Result>(null);
  const enabled = userProfile?.email_notifications_enabled ?? true;

  useEffect(() => {
    setInboxPrefs(readPersonalSettings(userProfile?.id));
    setPrefResult(null);
  }, [userProfile?.id]);

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

  const updateInboxPref = (patch: Partial<Pick<PersonalSettings, 'defaultNotificationTab' | 'defaultNotificationCategory'>>) => {
    const next = savePersonalSettings(userProfile?.id, patch);
    setInboxPrefs(next);
    setPrefResult({ tone: 'success', text: 'Default Notifications view saved.' });
  };

  return (
    <div className="space-y-5">
      <Surface className="overflow-hidden">
        <div className="border-b border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-5 py-5 sm:px-6">
          <SectionHeading
            icon={<Bell size={18} />}
            title="Email alerts"
            description="Allow email copies of supported task alerts while keeping in-app alerts active."
          />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 rounded-[10px] border border-[var(--eflow-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  enabled
                    ? 'bg-[var(--eflow-selected)] text-[var(--eflow-primary)]'
                    : 'bg-[var(--eflow-subtle)] text-[var(--eflow-text-muted)]'
                }`}
              >
                <Mail size={17} />
              </span>
              <div>
                <h3 className="text-[13px] font-semibold text-[var(--eflow-text)]">Task email notifications</h3>
                <p className="mt-1 max-w-lg text-[12px] leading-5 text-[var(--eflow-text-muted)]">
                  Receive email copies for assignments, reviews, and changes to your work.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
              <span className={`text-[11.5px] font-semibold ${enabled ? 'text-[var(--eflow-primary)]' : 'text-[var(--eflow-text-muted)]'}`}>
                {saving ? 'Saving…' : enabled ? 'On' : 'Off'}
              </span>
              <Switch checked={enabled} disabled={saving} onCheckedChange={toggleEmail} aria-label="Task email notifications" />
            </div>
          </div>
          <ResultMessage result={result} />
        </div>
      </Surface>

      <Surface className="p-5 sm:p-6">
        <SectionHeading
          icon={<SlidersHorizontal size={18} />}
          title="Inbox notification defaults"
          description="Choose which alerts appear first when you open Inbox → Notifications."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[12px] font-medium text-[var(--eflow-text-secondary)]">
            <span>Default tab</span>
            <select
              aria-label="Default notifications tab"
              value={inboxPrefs.defaultNotificationTab}
              onChange={(e) => updateInboxPref({ defaultNotificationTab: e.target.value as 'all' | 'unread' })}
              className="h-10 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[13px] font-normal text-[var(--eflow-text)]"
            >
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[12px] font-medium text-[var(--eflow-text-secondary)]">
            <span>Default activity filter</span>
            <select
              aria-label="Default activity filter"
              value={inboxPrefs.defaultNotificationCategory}
              onChange={(e) =>
                updateInboxPref({
                  defaultNotificationCategory: e.target.value as PersonalSettings['defaultNotificationCategory'],
                })
              }
              className="h-10 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[13px] font-normal text-[var(--eflow-text)]"
            >
              <option value="all">All activity</option>
              <option value="reviews">Reviews</option>
              <option value="assignments">Assignments</option>
              <option value="finance">Funding and expenses</option>
            </select>
          </label>
        </div>
        <ResultMessage result={prefResult} />
      </Surface>
    </div>
  );
}
