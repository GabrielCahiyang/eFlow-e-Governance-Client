import { useState, type ReactNode } from 'react';
import { Check, Laptop, Moon, Palette, Sun } from 'lucide-react';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import type { ThemePreference } from '../../../types';
import { ResultMessage, SectionHeading, SettingsLoading, Surface, type Result } from './settingsPrimitives';

export function AppearanceSettingsPage() {
  const { theme, loading, error: preferenceError, setTheme } = useUserPreferences();
  const [pendingTheme, setPendingTheme] = useState<ThemePreference | null>(null);
  const [result, setResult] = useState<Result>(null);
  const options: Array<{ value: ThemePreference; title: string; description: string; icon: ReactNode; tint: string }> = [
    { value: 'system', title: 'System', description: 'Follow your device setting.', icon: <Laptop size={19} />, tint: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
    { value: 'light', title: 'Light', description: 'A clear, focused workspace.', icon: <Sun size={19} />, tint: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
    { value: 'dark', title: 'Dark', description: 'A quieter interface for late work.', icon: <Moon size={19} />, tint: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' },
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

  if (loading) return <SettingsLoading label="Loading appearance preference…" />;

  return (
    <div className="max-w-3xl space-y-5">
      <Surface className="p-5 sm:p-6">
        <SectionHeading icon={<Palette size={19} />} eyebrow="Appearance" title="Set the tone for your workspace" description="Choose one appearance. System automatically tracks your device’s light or dark mode." />
        <div role="radiogroup" aria-label="Appearance preference" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {options.map((option) => {
            const selected = theme === option.value || pendingTheme === option.value;
            return (
              <button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => chooseTheme(option.value)} disabled={Boolean(pendingTheme)} className={`group relative min-h-36 rounded-2xl border p-4 text-left transition ${selected ? 'border-primary bg-primary/5 shadow-sm dark:border-primary dark:bg-primary/10' : 'border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600'} disabled:cursor-not-allowed`}>
                <span className={`flex size-9 items-center justify-center rounded-xl ${option.tint}`}>{option.icon}</span>
                <span className="mt-4 block text-[13px] font-semibold text-neutral-900 dark:text-slate-100">{option.title}</span>
                <span className="mt-1 block text-[11px] leading-4 text-neutral-500 dark:text-slate-400">{option.description}</span>
                <span className={`absolute right-3 top-3 flex size-4 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-neutral-300 bg-white dark:border-slate-600 dark:bg-slate-900'}`}>{selected && <Check size={11} strokeWidth={3} />}</span>
              </button>
            );
          })}
        </div>
        <ResultMessage result={result ?? (preferenceError ? { tone: 'error', text: preferenceError } : null)} />
      </Surface>

      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3.5 text-[12px] text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200">
        <Laptop size={17} className="mt-0.5 shrink-0" />
        <p><span className="font-semibold">System is the default.</span> It only listens for device changes while System is selected; Light and Dark stay exactly as you set them.</p>
      </div>
    </div>
  );
}
