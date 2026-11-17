import '@vibe/core/tokens';
import '@fontsource-variable/figtree/wght.css';
import '../../../src/styles/index.css';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { AuthContext, type AuthContextValue } from '../../../src/app/contexts/authContextValue';
import { UpdatesFeed } from '../../../src/app/features/action-center/components/UpdatesFeed';
import { NotificationBell } from '../../../src/app/components/ui/NotificationBell';
import { ToastProvider } from '../../../src/app/components/ui/Toast';
import { EflowVibeThemeProvider } from '../../../src/app/shared/vibe/EflowVibeProvider';

const userId = '00000000-0000-4000-8000-000000000090';
const auth = { user: { id: userId }, userProfile: { id: userId, role: 'member' } } as AuthContextValue;
function Proof() {
  const [dark, setDark] = useState(false), [opened, setOpened] = useState('');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  return <AuthContext.Provider value={auth}><EflowVibeThemeProvider preference={dark ? 'dark' : 'light'}><ToastProvider>
    <main style={{ padding: 20, minHeight: '100dvh', background: 'var(--eflow-canvas)', color: 'var(--eflow-text)' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}><h1 style={{ fontSize: 24 }}>Notifications</h1><NotificationBell userId={userId} role="member" alignToInbox onNavigate={() => {}}/><button onClick={() => setDark(!dark)}>Switch theme</button></div>
      <UpdatesFeed onOpen={item => setOpened(item.id)}/><output aria-label="Opened notification">{opened}</output>
    </main>
  </ToastProvider></EflowVibeThemeProvider></AuthContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Proof/>);
