import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "../../contexts/AuthContext";
import { UserPreferencesProvider } from "../../contexts/UserPreferencesContext";
import { ToastProvider } from "../../components/ui/Toast";
import { EflowVibeProvider } from "../../shared/vibe";
import { EflowMotionProvider } from "../../shared/motion";
import { installConnectivityMonitor } from "../../shared/networkConnectivity";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    installConnectivityMonitor();
  }, []);

  return (
    <AuthProvider>
      <UserPreferencesProvider>
        <EflowVibeProvider>
          <EflowMotionProvider>
            <ToastProvider>{children}</ToastProvider>
          </EflowMotionProvider>
        </EflowVibeProvider>
      </UserPreferencesProvider>
    </AuthProvider>
  );
}
