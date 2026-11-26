import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useUserPreferences } from "../../contexts/UserPreferencesContext";
import { LoginPage } from "../../components/Auth/LoginPage";
import { LoadingScreen } from "./LoadingScreen";
import { mapRoleToPanel } from "./role";
import { lazyFeature } from "../../shared/lazyFeature";
import {
  NAVIGATION_LOCATION_EVENT,
  pushNavigationHistory,
  replaceNavigationHistory,
} from "../../shared/navigationHistory";
import {
  clearExplicitLandingVisit,
  isExplicitLandingVisitActive,
  readSkipLandingPreference,
} from "../../shared/landingPreference";
import { hasPendingLogoutNotice } from "../session-security/services/logoutNotice";

const loadLandingPage = () =>
  import("../../../pages/Landing").then((module) => ({ default: module.LandingPage }));

const LandingPage = lazyFeature(loadLandingPage, undefined, undefined, <LoadingScreen />);
const ActivateAccountPage = lazyFeature(
  () => import("../account-activation").then((module) => ({ default: module.ActivateAccountPage })),
  undefined,
  undefined,
  <LoadingScreen />,
);
const ResetPasswordPage = lazyFeature(
  () => import("../authentication").then((module) => ({ default: module.ResetPasswordPage })),
  undefined,
  undefined,
  <LoadingScreen />,
);
const SignedInApp = lazyFeature(
  () => import("./SignedInApp").then((module) => ({ default: module.SignedInApp })),
  undefined,
  undefined,
  <LoadingScreen />,
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
  const { user, userProfile, loading, permissionsLoading, passwordRecovery, clearPasswordRecovery, accessRevision } = useAuth();
  const { loading: preferencesLoading } = useUserPreferences();
  const [, setLocationTick] = useState(0);
  const pathname = window.location.pathname;
  const userId = user?.id;
  const isRecoveryFlow = pathname === '/reset-password' || Boolean(passwordRecovery);

  useEffect(() => {
    const syncLocation = () => setLocationTick((tick) => tick + 1);
    window.addEventListener("popstate", syncLocation);
    window.addEventListener(NAVIGATION_LOCATION_EVENT, syncLocation);
    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener(NAVIGATION_LOCATION_EVENT, syncLocation);
    };
  }, []);

  useEffect(() => {
    if (user && userProfile) {
      clearExplicitLandingVisit();
      if (pathname === '/login') {
        replaceNavigationHistory('/');
      }
      return;
    }
    if (!loading && (pathname === '/' || pathname === '') && hasPendingLogoutNotice()) {
      clearExplicitLandingVisit();
      replaceNavigationHistory('/login');
    }
  }, [user, userProfile, loading, pathname]);

  useEffect(() => {
    if (!user && (pathname === "/" || pathname === "")) {
      void loadLandingPage();
    }
  }, [user, pathname]);

  useEffect(() => {
    if (!userId || isRecoveryFlow || ['/activate-account','/accept-invite','/accept-project-invite','/project-share','/manage-project-share','/reset-password'].includes(pathname)) return;
    void import("../tasks").then((module) => module.runTaskMaintenance()).catch((error) => {
      console.warn("Task maintenance could not run:", error);
    });
    void import("../budget").then((module) => module.runDepartmentBudgetMaintenance()).catch((error) => {
      console.warn("Office budget maintenance could not run:", error);
    });
  }, [userId, isRecoveryFlow, pathname]);

  if (pathname === '/activate-account') return <ActivateAccountPage />;
  if (isRecoveryFlow) {
    return (
      <ResetPasswordPage
        accountEmail={user?.email}
        accountRole={userProfile?.role}
        hasActiveRecovery={Boolean(passwordRecovery)}
        onRecoveryComplete={clearPasswordRecovery}
      />
    );
  }
  if (['/accept-invite','/accept-project-invite'].includes(pathname)) return <AcceptInvitationPage />;
  if (loading || permissionsLoading || (user && preferencesLoading)) return <LoadingScreen />;
  if (!user || !userProfile) {
    const isRootPath = pathname === '/' || pathname === '';
    const shouldShowLanding =
      isRootPath &&
      !hasPendingLogoutNotice() &&
      (!readSkipLandingPreference() || isExplicitLandingVisitActive());

    if (shouldShowLanding) {
      return (
        <LandingPage
          onSignIn={() => {
            clearExplicitLandingVisit();
            pushNavigationHistory('/login');
          }}
        />
      );
    }
    return <LoginPage />;
  }
  if (pathname === '/project-share') return <ShareRedemptionPage/>;
  if (pathname === '/manage-project-share') return <ShareManagementPage/>;

  return <SignedInApp key={`${user.id}:${userProfile.role}:${accessRevision ?? 0}`} actorId={user.id} role={mapRoleToPanel(userProfile.role)} />;
}
