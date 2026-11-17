import { useEffect, useState, type ReactNode } from 'react';
import { Bell, Database, LockKeyhole, Palette, UserRound } from 'lucide-react';
import { AppearanceSettingsPage } from './AppearanceSettingsPage';
import { NotificationSettingsPage } from './NotificationSettingsPage';
import { ProfileSettingsPage } from './ProfileSettingsPage';
import { SecuritySettingsPage } from './SecuritySettingsPage';
import { StorageCacheSettingsPage } from './StorageCacheSettingsPage';
import { PageHeader } from '../../../components/workflow/primitives';
import { requestNavigation } from '../../../shared/navigationGuard';

function resolvePage(page?: string): string {
  if (!page) return 'Profile';
  if (page.toLowerCase() === 'settings') return 'Appearance';
  if (page.toLowerCase() === 'storage & cache' || page.toLowerCase() === 'storage') return 'Storage & cache';
  if (['Profile', 'Appearance', 'Notifications', 'Security', 'Storage & cache'].includes(page)) return page;
  return 'Profile';
}

const SECTION_DESCRIPTIONS: Record<string, string> = {
  Profile: 'Manage your display name, photo, and regional display preferences.',
  Appearance: 'Choose your theme, layout density, and motion comfort.',
  Notifications: 'Control email alerts and default inbox behavior.',
  Security: 'Update your account password.',
  'Storage & cache': 'Inspect preserved local drafts and clear cached workspace reads.',
};

export function SettingsContent({ activePage, onNavigate }: { activePage?: string; onNavigate?: (section: string, page: string) => void }) {
  const [selectedPage, setSelectedPage] = useState<string>(() => resolvePage(activePage));

  useEffect(() => {
    setSelectedPage(resolvePage(activePage));
  }, [activePage]);

  const page: Record<string, ReactNode> = {
    Profile: <ProfileSettingsPage />,
    Appearance: <AppearanceSettingsPage />,
    Notifications: <NotificationSettingsPage />,
    Security: <SecuritySettingsPage />,
    'Storage & cache': <StorageCacheSettingsPage />,
  };

  const sections = [
    { id: 'Profile', label: 'Profile', icon: <UserRound size={14} /> },
    { id: 'Appearance', label: 'Appearance', icon: <Palette size={14} /> },
    { id: 'Notifications', label: 'Notifications', icon: <Bell size={14} /> },
    { id: 'Security', label: 'Security', icon: <LockKeyhole size={14} /> },
    { id: 'Storage & cache', label: 'Storage & cache', icon: <Database size={14} /> },
  ];
  const currentMeta = sections.find((item) => item.id === selectedPage) ?? sections[0];

  return (
    <div className="min-h-full bg-[var(--eflow-surface)] px-5 py-6 sm:px-8">
      <div className="max-w-5xl space-y-6">
        <PageHeader
          eyebrow={<>{currentMeta.icon} Account</>}
          title={selectedPage}
          subtitle={SECTION_DESCRIPTIONS[selectedPage]}
        />

        {/* Compact mobile section switcher (desktop uses the Context Rail) */}
        <div className="flex border-b border-[var(--eflow-border)] overflow-x-auto md:hidden" aria-label="Account sections">
          {sections.map((tab) => {
            const active = selectedPage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate ? onNavigate('settings', tab.id) : void requestNavigation(() => setSelectedPage(tab.id))}
                className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap
                  ${
                    active
                      ? 'border-[var(--eflow-primary)] text-[var(--eflow-primary)] font-semibold'
                      : 'border-transparent text-[var(--eflow-text-secondary)] hover:bg-[var(--eflow-subtle)] hover:text-[var(--eflow-primary)]'
                  }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {page[selectedPage]}
      </div>
    </div>
  );
}

export default SettingsContent;
