import { useEffect, useState } from 'react';
import { Bell, Mail, Monitor, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { updateEmailPreference } from '../../../services/userSettingsService';
import { Switch } from '../../../components/ui/switch';
import { Button } from '../../../components/ui/button';
import { playNotificationChime } from '../../notifications/notificationSound';
import {
  PERSONAL_SETTINGS_CHANGED_EVENT,
  readPersonalSettings,
  savePersonalSettings,
  type NotificationSoundVolume,
  type PersonalSettings,
} from '../personalSettingsStore';
import { ResultMessage, SectionHeading, Surface, type Result } from './settingsPrimitives';

export function NotificationSettingsPage() {
  const { userProfile, updateUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [inboxPrefs, setInboxPrefs] = useState<PersonalSettings>(() => readPersonalSettings(userProfile?.id));
  const [prefResult, setPrefResult] = useState<Result>(null);
  const [alertResult, setAlertResult] = useState<Result>(null);
  const enabled = userProfile?.email_notifications_enabled ?? true;

  useEffect(() => {
    setInboxPrefs(readPersonalSettings(userProfile?.id));
    setPrefResult(null);
    setAlertResult(null);
    const sync = () => setInboxPrefs(readPersonalSettings(userProfile?.id));
    window.addEventListener(PERSONAL_SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PERSONAL_SETTINGS_CHANGED_EVENT, sync);
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

  const updateInboxPref = (
    patch: Partial<Pick<PersonalSettings, 'defaultNotificationTab' | 'defaultNotificationCategory'>>,
  ) => {
    const next = savePersonalSettings(userProfile?.id, patch);
    setInboxPrefs(next);
    setPrefResult({ tone: 'success', text: 'Default Notifications view saved.' });
  };

  const updateAlertPref = (
    patch: Partial<Pick<PersonalSettings, 'notificationSoundEnabled' | 'notificationSoundVolume' | 'desktopNotificationsEnabled'>>,
    message: string,
  ) => {
    const next = savePersonalSettings(userProfile?.id, patch);
    setInboxPrefs(next);
    setAlertResult({ tone: 'success', text: message });
  };

  const toggleDesktopAlerts = async (nextEnabled: boolean) => {
    if (!nextEnabled) {
      updateAlertPref({ desktopNotificationsEnabled: false }, 'Browser desktop notifications turned off.');
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setAlertResult({ tone: 'error', text: 'This browser does not support desktop notifications.' });
      return;
    }
    if (window.Notification.permission === 'denied') {
      setAlertResult({
        tone: 'error',
        text: 'Desktop notifications are blocked in your browser settings. Allow notifications for this site to enable them.',
      });
      return;
    }
    let permission: NotificationPermission = window.Notification.permission;
    if (permission === 'default') {
      try {
        permission = await window.Notification.requestPermission();
      } catch {
        permission = 'denied';
      }
    }
    if (permission !== 'granted') {
      setAlertResult({ tone: 'error', text: 'Permission was not granted. Desktop notifications remain off.' });
      return;
    }
    updateAlertPref(
      { desktopNotificationsEnabled: true },
      'Browser desktop notifications enabled when this tab is in the background.',
    );
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

      <Surface className="overflow-hidden">
        <div className="border-b border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-5 py-5 sm:px-6">
          <SectionHeading
            icon={inboxPrefs.notificationSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            title="Live alert sound & desktop notifications"
            description="Control the chime played when live notification banners appear and optional OS desktop alerts when you work in another tab."
          />
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-4 rounded-[10px] border border-[var(--eflow-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  inboxPrefs.notificationSoundEnabled
                    ? 'bg-[var(--eflow-selected)] text-[var(--eflow-primary)]'
                    : 'bg-[var(--eflow-subtle)] text-[var(--eflow-text-muted)]'
                }`}
              >
                {inboxPrefs.notificationSoundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </span>
              <div>
                <h3 className="text-[13px] font-semibold text-[var(--eflow-text)]">Notification bell sound</h3>
                <p className="mt-1 max-w-lg text-[12px] leading-5 text-[var(--eflow-text-muted)]">
                  Play a brief bell chime when a new notification pops up (burst alerts are automatically coalesced).
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2.5 self-end sm:self-auto">
              <select
                aria-label="Notification bell volume"
                disabled={!inboxPrefs.notificationSoundEnabled}
                value={inboxPrefs.notificationSoundVolume}
                onChange={(e) =>
                  updateAlertPref(
                    { notificationSoundVolume: e.target.value as NotificationSoundVolume },
                    `Bell volume set to ${e.target.value}.`,
                  )
                }
                className="h-8 rounded-md border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-2.5 text-[12px] text-[var(--eflow-text)] disabled:opacity-50"
              >
                <option value="normal">Normal volume</option>
                <option value="soft">Soft volume</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const played = playNotificationChime('normal', {
                    volume: inboxPrefs.notificationSoundVolume,
                    force: true,
                  });
                  setAlertResult(
                    played
                      ? { tone: 'success', text: 'Played notification bell chime.' }
                      : { tone: 'error', text: 'Browser audio is unavailable in this session.' },
                  );
                }}
              >
                Test sound
              </Button>
              <Switch
                checked={inboxPrefs.notificationSoundEnabled}
                onCheckedChange={(checked) =>
                  updateAlertPref(
                    { notificationSoundEnabled: checked },
                    checked ? 'Notification bell sound is on.' : 'Notification bell sound muted.',
                  )
                }
                aria-label="Notification bell sound"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[10px] border border-[var(--eflow-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  inboxPrefs.desktopNotificationsEnabled
                    ? 'bg-[var(--eflow-selected)] text-[var(--eflow-primary)]'
                    : 'bg-[var(--eflow-subtle)] text-[var(--eflow-text-muted)]'
                }`}
              >
                <Monitor size={17} />
              </span>
              <div>
                <h3 className="text-[13px] font-semibold text-[var(--eflow-text)]">Desktop notifications when tab is hidden</h3>
                <p className="mt-1 max-w-lg text-[12px] leading-5 text-[var(--eflow-text-muted)]">
                  Show a native browser alert when a new eFlow notification arrives while you are working in another tab or window.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
              <span className={`text-[11.5px] font-semibold ${inboxPrefs.desktopNotificationsEnabled ? 'text-[var(--eflow-primary)]' : 'text-[var(--eflow-text-muted)]'}`}>
                {inboxPrefs.desktopNotificationsEnabled ? 'On' : 'Off'}
              </span>
              <Switch
                checked={inboxPrefs.desktopNotificationsEnabled}
                onCheckedChange={(checked) => void toggleDesktopAlerts(checked)}
                aria-label="Desktop notifications when tab is hidden"
              />
            </div>
          </div>

          <ResultMessage result={alertResult} />
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
              <option value="urgent">Action required / Urgent</option>
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
