import { Avatar, IconButton } from "@vibe/core";
import { LogOut, Menu as MenuIcon, Person } from "@vibe/icons";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useUserPreferences } from "../../../contexts/UserPreferencesContext";
import { MessagesButton } from "../../chat-calls";
import { WorkspaceHelpMenu } from "../../guided-tours";
import { getProfileAvatarUrl } from "../../../services/userSettingsService";
import { IncomingCallListener } from "../../../components/ui/IncomingCallListener";
import { NotificationBell } from "../../../components/ui/NotificationBell";
import { EFlowMark } from "../../../../components/EFlowMark";
import { requestNavigation } from "../../../shared/navigationGuard";
import { ActionMenu } from "../../../components/ui/workspace";
import { Button as MenuTriggerButton } from "../../../components/ui/button";
import { usePresentationBranding } from "../../administration";
import { useNetworkConnectivity } from "../../../shared/networkConnectivity";
import { ConnectivitySignal } from "./ConnectivitySignal";

interface EflowTopBarProps {
  activePage?: string;
  activeSection?: string;
  onOpenMobileNavigation: () => void;
  onPageSelect: (section: string, page: string) => void;
  role: string;
  helpOpen: boolean;
  onHelpOpenChange: (open: boolean, trigger?: HTMLElement | null) => void;
  helpReturnFocusTarget?: HTMLElement | null;
}

function getInitials(name?: string) {
  return (name || "User")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AccountMenu({
  onPageSelect,
}: Pick<EflowTopBarProps, "onPageSelect">) {
  const { logout, userProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const fullName = userProfile?.fullName || "eFlow user";

  useEffect(() => {
    let active = true;
    void getProfileAvatarUrl(userProfile?.avatar_path)
      .then((url) => {
        if (active) setAvatarUrl(url || undefined);
      })
      .catch(() => {
        if (active) setAvatarUrl(undefined);
      });
    return () => {
      active = false;
    };
  }, [userProfile?.avatar_path]);

  return (
    <div className="eflow-topbar__account" data-tour-id="profile">
      <span data-tour-id="settings">
        <ActionMenu
          trigger={
            <MenuTriggerButton
              aria-label="Open account menu"
              className="eflow-topbar__account-trigger"
              variant="ghost"
            >
              <Avatar
                aria-hidden={true}
                size="small"
                customBackgroundColor="var(--eflow-primary)"
                src={avatarUrl}
                text={getInitials(fullName)}
                type={avatarUrl ? "img" : "text"}
              />
              <span className="eflow-topbar__account-name">{fullName}</span>
              <ChevronDown size={14} aria-hidden="true" className="eflow-topbar__account-chevron" />
            </MenuTriggerButton>
          }
          actions={[
            {
              id: "profile",
              label: "Profile & settings",
              icon: <Person />,
              onSelect: () => onPageSelect("settings", "Profile"),
            },
            {
              id: "logout",
              label: "Log out",
              icon: <LogOut />,
              onSelect: () => {
                void requestNavigation(() => {
                  void logout();
                });
              },
            },
          ]}
        />
      </span>
    </div>
  );
}

export function EflowTopBar({
  activePage,
  activeSection,
  onOpenMobileNavigation,
  onPageSelect,
  role,
  helpOpen,
  onHelpOpenChange,
  helpReturnFocusTarget,
}: EflowTopBarProps) {
  const { user, userProfile } = useAuth();
  useUserPreferences();
  const dark = false;
  const branding = usePresentationBranding(user?.id);
  const connectivity = useNetworkConnectivity();
  const topbarClass =
    connectivity.status === "online"
      ? "eflow-topbar"
      : `eflow-topbar eflow-topbar--${connectivity.status}`;

  return (
    <header className={topbarClass} aria-label="Workspace utilities">
      <div className="eflow-topbar__leading">
          <IconButton
            aria-label="Open navigation"
            className="eflow-topbar__mobile-menu"
            icon={MenuIcon}
            kind="tertiary"
            onClick={onOpenMobileNavigation}
            size="small"
          />
        <div
          className="eflow-topbar__brand-lockup"
          data-tour-id="brand"
          title={branding.organization_subtitle || undefined}
        >
          <EFlowMark variant={dark ? "white" : "default"} height={36} className="eflow-topbar__wordmark" />
          <div className="eflow-topbar__brand-divider" aria-hidden="true" />
          <span className="eflow-topbar__brand-org">{branding.organization_name}</span>
        </div>
      </div>

      <div className="eflow-topbar__utilities">
        <ConnectivitySignal
          status={connectivity.status}
          checking={connectivity.checking}
          onRetry={() => {
            void connectivity.retry();
          }}
        />
        <WorkspaceHelpMenu open={helpOpen} onOpenChange={onHelpOpenChange} role={userProfile?.role || role} returnFocusTarget={helpReturnFocusTarget} />
        {user?.id && (
          <div
            className="eflow-topbar__communications"
            data-tour-id="communications"
          >
            <NotificationBell
              compact
              onNavigate={onPageSelect}
              role={role}
              userId={user.id}
            />
            <MessagesButton
              active={activeSection === 'messages' || (activeSection === 'inbox' && activePage === 'Messages')}
              onOpen={() => onPageSelect('inbox', 'Messages')}
            />
            <IncomingCallListener userId={user.id} />
          </div>
        )}
        <AccountMenu onPageSelect={onPageSelect} />
      </div>
    </header>
  );
}
