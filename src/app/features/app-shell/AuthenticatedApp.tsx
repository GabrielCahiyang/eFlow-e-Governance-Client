import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useUserPreferences } from "../../contexts/UserPreferencesContext";
import { LoginPage } from "../../components/Auth/LoginPage";
import { EflowAppShell } from "./EflowAppShell";
import { LoadingScreen } from "./LoadingScreen";
import { mapRoleToPanel } from "./role";
import { runTaskMaintenance } from "../tasks";
import { SessionSecurityProvider } from "../session-security";
import { runDepartmentBudgetMaintenance } from "../budget";

export function AuthenticatedApp() {
  const { user, userProfile, loading } = useAuth();
  const { loading: preferencesLoading } = useUserPreferences();

  useEffect(() => {
    if (!user) return;
    void runTaskMaintenance().catch((error) => {
      console.warn("Task maintenance could not run:", error);
    });
    void runDepartmentBudgetMaintenance().catch((error) => {
      console.warn("Office budget maintenance could not run:", error);
    });
  }, [user]);

  if (loading || (user && preferencesLoading)) return <LoadingScreen />;
  if (!user || !userProfile) return <LoginPage />;

  return (
    <SessionSecurityProvider>
      <EflowAppShell role={mapRoleToPanel(userProfile.role)} />
    </SessionSecurityProvider>
  );
}
