import { useEffect, useState, type ReactNode } from 'react';
import { Check, Laptop, Moon, Palette, SlidersHorizontal, Sun } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import type { ThemePreference } from '../../../types';
import {
  applyDisplayPreferences,
  readPersonalSettings,
  savePersonalSettings,
  type InterfaceDensity,
  type MotionMode,
} from '../personalSettingsStore';
import { ResultMessage, SectionHeading, Surface, type Result } from './settingsPrimitives';

function AppearanceSettingsSkeleton() {
  const pulse = 'animate-pulse rounded bg-[var(--eflow-subtle)]';
  return (
    <div className="space-y-5" role="status" aria-label="Loading appearance preference…">
      <span className="sr-only">Loading appearance preference…</span>
      <div aria-hidden="true" className="space-y-5">
        <Surface className="p-5 sm:p-6">
          <div className={`h-4 w-40 ${pulse}`} />
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="min-h-32 rounded-[10px] border border-[var(--eflow-border)] p-4">
                <div className={`size-9 rounded-lg ${pulse}`} />
                <div className={`mt-4 h-4 w-20 ${pulse}`} />
                <div className={`mt-2 h-3 w-36 ${pulse}`} />
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

export function AppearanceSettingsPage() {
  const { userProfile } = useAuth();
  const { theme, loading, error: preferenceError, setTheme } = useUserPreferences();
  const [pendingTheme, setPendingTheme] = useState<ThemePreference | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [prefs, setPrefs] = useState(() => readPersonalSettings(userProfile?.id));
  const [comfortSaved, setComfortSaved] = useState<Result>(null);

  useEffect(() => {
    const loaded = readPersonalSettings(userProfile?.id);
    setPrefs(loaded);
    applyDisplayPreferences(loaded);
    setComfortSaved(null);
  }, [userProfile?.id]);

  const options: Array<{ value: ThemePreference; title: string; description: string; icon: ReactNode; tint: string }> = [
    { value: 'system', title: 'System', description: 'Follow your device light or dark mode.', icon: <Laptop size={18} />, tint: 'bg-[var(--eflow-subtle)] text-[var(--eflow-text-secondary)]' },
    { value: 'light', title: 'Light', description: 'Crisp bright surfaces for daytime work.', icon: <Sun size={18} />, tint: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
    { value: 'dark', title: 'Dark', description: 'Low-glare dark surfaces for dim rooms.', icon: <Moon size={18} />, tint: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' },
  ];

  const chooseTheme = async (nextTheme: ThemePreference) => {
    if (nextTheme === theme || pendingTheme) return;
    setPendingTheme(nextTheme);
    setResult(null);
    try {
      await setTheme(nextTheme);
      setResult({ tone: 'success', text: `${nextTheme[0].toUpperCase()}${nextTheme.slice(1)} appearance saved.` });
    } catch {
      setResult({ tone: 'error', text: 'We could not save your appearance. Your previous theme has been restored.' });
    } finally {
      setPendingTheme(null);
    }
  };

  const updateComfort = (patch: { density?: InterfaceDensity; motion?: MotionMode }) => {
    const next = savePersonalSettings(userProfile?.id, patch);
    setPrefs(next);
    setComfortSaved({ tone: 'success', text: 'Display comfort preference saved.' });
  };

  if (loading) return <AppearanceSettingsSkeleton />;

  return (
    <div className="space-y-5">
      <Surface className="p-5 sm:p-6">
        <SectionHeading
          icon={<Palette size={18} />}
          title="Theme"
          description="Choose light, dark, or match your device setting."
        />
        <div role="radiogroup" aria-label="Appearance preference" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {options.map((option) => {
            const selected = theme === option.value || pendingTheme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseTheme(option.value)}
                disabled={Boolean(pendingTheme)}
                className={`group relative min-h-32 rounded-[10px] border p-4 text-left transition ${
                  selected
                    ? 'border-[var(--eflow-primary)] bg-[var(--eflow-selected)]'
                    : 'border-[var(--eflow-border)] bg-[var(--eflow-surface)] hover:border-[var(--eflow-primary)]/40 hover:bg-[var(--eflow-subtle)]'
                } disabled:cursor-not-allowed`}
              >
                <span className={`flex size-9 items-center justify-center rounded-lg ${option.tint}`}>{option.icon}</span>
                <span className="mt-3.5 block text-[13px] font-semibold text-[var(--eflow-text)]">{option.title}</span>
                <span className="mt-1 block text-[12px] leading-4 text-[var(--eflow-text-muted)]">{option.description}</span>
                <span
                  className={`absolute right-3 top-3 flex size-4 items-center justify-center rounded-full border ${
                    selected
                      ? 'border-[var(--eflow-primary)] bg-[var(--eflow-primary)] text-[var(--eflow-on-primary)]'
                      : 'border-[var(--eflow-border)] bg-[var(--eflow-surface)]'
                  }`}
                >
                  {selected && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
        <ResultMessage result={result ?? (preferenceError ? { tone: 'error', text: preferenceError } : null)} />
      </Surface>

      <Surface className="p-5 sm:p-6">
        <SectionHeading
          icon={<SlidersHorizontal size={18} />}
          title="Display & motion comfort"
          description="Adjust row spacing and animation intensity for your browser."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[12px] font-medium text-[var(--eflow-text-secondary)]">
            <span>Table & list density</span>
            <select
              aria-label="Table and list density"
              value={prefs.density}
              onChange={(e) => updateComfort({ density: e.target.value as InterfaceDensity })}
              className="h-10 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[13px] font-normal text-[var(--eflow-text)]"
            >
              <option value="comfortable">Comfortable (default spacing)</option>
              <option value="compact">Compact (show more rows)</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[12px] font-medium text-[var(--eflow-text-secondary)]">
            <span>Animations & transitions</span>
            <select
              aria-label="Animations and transitions"
              value={prefs.motion}
              onChange={(e) => updateComfort({ motion: e.target.value as MotionMode })}
              className="h-10 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-3 text-[13px] font-normal text-[var(--eflow-text)]"
            >
              <option value="system">Standard transitions</option>
              <option value="reduced">Reduced motion</option>
            </select>
          </label>
        </div>
        <ResultMessage result={comfortSaved} />
      </Surface>
    </div>
  );
}
