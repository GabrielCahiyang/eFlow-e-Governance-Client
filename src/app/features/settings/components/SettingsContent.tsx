import { useEffect, useState, type ReactNode } from 'react';
import { Bell, ChevronRight, LockKeyhole, Palette, UserRound } from 'lucide-react';
import { AppearanceSettingsPage } from './AppearanceSettingsPage';
import { NotificationSettingsPage } from './NotificationSettingsPage';
import { ProfileSettingsPage } from './ProfileSettingsPage';
import { SecuritySettingsPage } from './SecuritySettingsPage';
import { PageHeader } from '../../../components/workflow/primitives';

function resolvePage(page?: string): string {
  if (!page) return 'Profile';
  if (page.toLowerCase() === 'settings') return 'Appearance';
  if (['Profile', 'Appearance', 'Notifications', 'Security'].includes(page)) return page;
  return 'Profile';
}

export function SettingsContent({ activePage }: { activePage?: string }) {
  const [selectedPage, setSelectedPage] = useState<string>(() => resolvePage(activePage));

  useEffect(() => {
    setSelectedPage(resolvePage(activePage));
  }, [activePage]);

  const page: Record<string, ReactNode> = {
    Profile: <ProfileSettingsPage />,
    Appearance: <AppearanceSettingsPage />,
    Notifications: <NotificationSettingsPage />,
    Security: <SecuritySettingsPage />,
  };

  const tabs = [
    { id: 'Profile', label: 'Profile', icon: <UserRound size={15} /> },
    { id: 'Appearance', label: 'Appearance', icon: <Palette size={15} /> },
    { id: 'Notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'Security', label: 'Security', icon: <LockKeyhole size={15} /> },
  ];

  return (
    <div className="min-h-full bg-muted/30 px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          actions={<div className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"><span>Account</span><ChevronRight size={13} /><span className="font-medium text-foreground">{selectedPage}</span></div>}
          eyebrow={<><Palette size={13} /> Personal settings</>}
          title={selectedPage}
        />

        {/* Horizontal Navigation Tabs */}
        <div className="mb-6 flex border-b border-neutral-200 dark:border-slate-800 overflow-x-auto">
          {tabs.map((tab) => {
            const active = selectedPage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedPage(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-medium transition-all duration-200 whitespace-nowrap
                  ${
                    active
                      ? 'border-primary text-primary dark:border-primary dark:text-primary font-semibold'
                      : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-200'
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
