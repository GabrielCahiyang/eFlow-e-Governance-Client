import { Avatar, IconButton, Tooltip } from "@vibe/core";
import { LogOut, Menu as MenuIcon, Person, Settings } from "@vibe/icons";
import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { ChatListDrawer } from "../../chat-calls";
import { PageWalkthroughButton, SystemWalkthroughButton } from "../../guided-tours";
import { getProfileAvatarUrl } from "../../../services/userSettingsService";
import { getRoleLabel } from "../../../shared/roles";
import { IncomingCallListener } from "../../../components/ui/IncomingCallListener";
import { NotificationBell } from "../../../components/ui/NotificationBell";
import { EFlowMark } from "../../../../components/EFlowMark";
import { OnboardingHelpButton } from '../../onboarding';
import { requestNavigation } from '../../../shared/navigationGuard';
import { ActionMenu } from '../../../components/ui/workspace';
import { Button as MenuTriggerButton } from '../../../components/ui/button';

interface EflowTopBarProps {
  activePage?: string;
  activeSection?: string;
  onOpenMobileNavigation: () => void;
  onPageSelect: (section: string, page: string) => void;
  role: string;
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

function getAccountRoleLabel(role: string): string { return getRoleLabel(role); }

function AccountMenu({ onPageSelect, role }: Pick<EflowTopBarProps, "onPageSelect" | "role">) {
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
      <span className="eflow-topbar__account-avatar">
        <Avatar
          aria-label={fullName}
          size="small"
          src={avatarUrl}
          text={getInitials(fullName)}
          type={avatarUrl ? "img" : "text"}
        />
      </span>
      <span data-tour-id="settings">
        <ActionMenu
          trigger={(
            <MenuTriggerButton
              aria-label="Open account menu"
              className="eflow-topbar__account-trigger"
              variant="ghost"
            >
              <Person aria-hidden="true" /> Account
            </MenuTriggerButton>
          )}
          actions={[
            { id: 'profile', label: 'Profile', icon: <Person />, onSelect: () => onPageSelect('settings', 'Profile') },
            { id: 'settings', label: 'Settings', icon: <Settings />, onSelect: () => onPageSelect('settings', 'Appearance') },
            { id: 'logout', label: 'Log out', icon: <LogOut />, onSelect: () => { void requestNavigation(() => { void logout(); }); } },
          ]}
        />
      </span>
      <div className="eflow-topbar__account-context">
        <span className="eflow-topbar__account-name">{fullName}</span>
        <span className="eflow-topbar__account-role">{getAccountRoleLabel(userProfile?.role || role)}</span>
      </div>
    </div>
  );
}

export function EflowTopBar({
  onOpenMobileNavigation,
  onPageSelect,
  role,
}: EflowTopBarProps) {
  const { user, userProfile } = useAuth();

  return (
    <header className="eflow-topbar" aria-label="Workspace utilities">
      <div className="eflow-topbar__leading">
        <Tooltip content="Open navigation">
          <IconButton
            aria-label="Open navigation"
            className="eflow-topbar__mobile-menu"
            icon={MenuIcon}
            kind="tertiary"
            onClick={onOpenMobileNavigation}
            size="small"
          />
        </Tooltip>
        <div className="eflow-topbar__brand-lockup" data-tour-id="brand">
          <EFlowMark variant="default" height={36} />
          <div className="eflow-topbar__brand-divider" aria-hidden="true" />
          <span className="eflow-topbar__brand-org">LGU Ormoc City</span>
        </div>
      </div>

      <div className="eflow-topbar__utilities">
        {userProfile?.role !== 'admin' && <OnboardingHelpButton />}
        <PageWalkthroughButton />
        <SystemWalkthroughButton collapsed={false} />
        {user?.id && (
          <div className="eflow-topbar__communications" data-tour-id="communications">
            <NotificationBell
              compact
              onNavigate={onPageSelect}
              role={role}
              userId={user.id}
            />
            <ChatListDrawer
              userId={user.id}
              userName={userProfile?.fullName}
              userOrgId={userProfile?.departmentId}
            />
            <IncomingCallListener userId={user.id} />
          </div>
        )}
        <AccountMenu onPageSelect={onPageSelect} role={role} />
      </div>
    </header>
  );
}
