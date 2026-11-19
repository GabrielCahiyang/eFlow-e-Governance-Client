import { useState } from "react";
import { WorkspaceTooltip } from "../../../../components/ui/workspace/WorkspaceTooltip";
import { Check, Copy, KeyRound, Mail, Pencil, X } from "lucide-react";
import type { UserProfile } from "../../../../types";
import { InspectorPanel } from "../../../../shared/motion";
import { Button } from "../../../../components/ui/button";
import { RoleBadge, StatusBadge } from "./userManagementPrimitives";
export function AccountInspector({
  profile,
  roleLabel,
  protection,
  onClose,
  onEdit,
  onAccess,
  onResetPassword,
  resettingPassword = false,
}: {
  profile: UserProfile;
  roleLabel?: string;
  protection: string;
  onClose: () => void;
  onEdit?: () => void;
  onAccess?: () => void;
  onResetPassword?: () => void;
  resettingPassword?: boolean;
}) {
  const [copiedId, setCopiedId] = useState(false);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(profile.id);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1800);
    } catch {
      /* Clipboard unavailable. */
    }
  };
  return (
    <InspectorPanel
      open
      onClose={onClose}
      ariaLabel={`Account: ${profile.full_name}`}
      className="w-full bg-[var(--eflow-surface)] sm:w-[480px]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--eflow-border)] p-5">
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--eflow-text-muted)]">
            People & Accounts
          </p>
          <h2 className="text-xl font-semibold text-[var(--eflow-text)]">
            {profile.full_name}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={profile.role} roleLabel={roleLabel} />
            <StatusBadge active={profile.is_active} />
          </div>
        </div>
        <WorkspaceTooltip content="Close account details"><Button
          variant="ghost"
          size="icon"
          aria-label="Close account details"
          onClick={onClose}
        >
          <X size={18} />
        </Button></WorkspaceTooltip>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <dl className="grid gap-4 text-sm">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] p-3.5">
            <Mail size={16} aria-hidden="true" className="mt-0.5 text-[var(--eflow-primary)]" />
            <div className="min-w-0">
              <dt className="text-xs text-[var(--eflow-text-muted)]">Email address</dt>
              <dd className="break-all font-medium text-[var(--eflow-text)]">{profile.email}</dd>
            </div>
          </div>
        </dl>
        {protection && (
          <p className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-warning-bg)] p-3.5 text-sm text-[var(--eflow-warning-text)]">
            {protection}
          </p>
        )}
        <p className="eflow-admin-copy">
          Default workspace access comes from the account’s role. You can add custom overrides in Individual Access without changing anyone else.
        </p>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--eflow-border)] pt-3 text-xs text-[var(--eflow-text-muted)]">
          <span className="truncate font-mono">ID: {profile.id}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void copyId()}>
            {copiedId ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            {copiedId ? "Copied" : "Copy ID"}
          </Button>
        </div>
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-[var(--eflow-border)] p-4">
        <Button
          disabled={!onEdit}
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.();
          }}
        >
          <Pencil size={14} aria-hidden="true" />
          Edit account
        </Button>
        <Button variant="outline" disabled={!onAccess} onClick={onAccess}>
          <KeyRound size={14} aria-hidden="true" />
          Individual access
        </Button>
        <Button
          variant="outline"
          disabled={!onResetPassword || !profile.is_active || resettingPassword}
          title={
            !profile.is_active
              ? "Activate this account before sending a password reset link"
              : undefined
          }
          onClick={onResetPassword}
        >
          <Mail size={14} aria-hidden="true" />
          {resettingPassword ? "Sending reset…" : "Send password reset"}
        </Button>
      </footer>
    </InspectorPanel>
  );
}
