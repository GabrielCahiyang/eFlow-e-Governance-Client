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
import {ShareRedemptionPage,ShareManagementPage} from '../project-access';
import { AcceptInvitationPage } from "../invitations";

export function AuthenticatedApp() {
  const { user, userProfile, loading, permissionsLoading } = useAuth();
  const { loading: preferencesLoading } = useUserPreferences();

  useEffect(() => {
    if (!user || ['/accept-invite','/accept-project-invite','/project-share','/manage-project-share'].includes(window.location.pathname)) return;
    void runTaskMaintenance().catch((error) => {
      console.warn("Task maintenance could not run:", error);
    });
    void runDepartmentBudgetMaintenance().catch((error) => {
      console.warn("Office budget maintenance could not run:", error);
    });
  }, [user]);

  if (['/accept-invite','/accept-project-invite'].includes(window.location.pathname)) return <AcceptInvitationPage />;
  if (loading || permissionsLoading || (user && preferencesLoading)) return <LoadingScreen />;
  if (!user || !userProfile) return <LoginPage />;
  if (window.location.pathname === '/project-share') return <ShareRedemptionPage/>;
  if (window.location.pathname === '/manage-project-share') return <ShareManagementPage/>;

  return (
    <SessionSecurityProvider>
      <EflowAppShell role={mapRoleToPanel(userProfile.role)} />
    </SessionSecurityProvider>
  );
}
