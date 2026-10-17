import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useUserPreferences } from "../../contexts/UserPreferencesContext";
import { LoginPage } from "../../components/Auth/LoginPage";
import { LoadingScreen } from "./LoadingScreen";
import { mapRoleToPanel } from "./role";
import { lazyFeature } from "../../shared/lazyFeature";
import { ActivateAccountPage } from '../account-activation';

const SignedInApp = lazyFeature(() =>
  import("./SignedInApp").then((module) => ({ default: module.SignedInApp })),
);
const AcceptInvitationPage = lazyFeature(() =>
  import("../invitations").then((module) => ({ default: module.AcceptInvitationPage })),
);
const ShareRedemptionPage = lazyFeature(() =>
  import("../project-access").then((module) => ({ default: module.ShareRedemptionPage })),
);
const ShareManagementPage = lazyFeature(() =>
  import("../project-access").then((module) => ({ default: module.ShareManagementPage })),
);

export function AuthenticatedApp() {
  const { user, userProfile, loading, permissionsLoading } = useAuth();
  const { loading: preferencesLoading } = useUserPreferences();

  useEffect(() => {
    if (!user || ['/activate-account','/accept-invite','/accept-project-invite','/project-share','/manage-project-share'].includes(window.location.pathname)) return;
    void import("../tasks").then((module) => module.runTaskMaintenance()).catch((error) => {
      console.warn("Task maintenance could not run:", error);
    });
    void import("../budget").then((module) => module.runDepartmentBudgetMaintenance()).catch((error) => {
      console.warn("Office budget maintenance could not run:", error);
    });
  }, [user]);

  if (window.location.pathname === '/activate-account') return <ActivateAccountPage />;
  if (['/accept-invite','/accept-project-invite'].includes(window.location.pathname)) return <AcceptInvitationPage />;
  if (loading || permissionsLoading || (user && preferencesLoading)) return <LoadingScreen />;
  if (!user || !userProfile) return <LoginPage />;
  if (window.location.pathname === '/project-share') return <ShareRedemptionPage/>;
  if (window.location.pathname === '/manage-project-share') return <ShareManagementPage/>;

  return <SignedInApp key={`${user.id}:${userProfile.role}`} actorId={user.id} role={mapRoleToPanel(userProfile.role)} />;
}
