import { useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, Mail, Pencil, ShieldAlert } from "lucide-react";
import type { UserProfile } from "../../../../types";
import { Modal } from "../../../../components/ui/Modal";
import { Button } from "../../../../components/ui/button";
import { RoleBadge, StatusBadge } from "./userManagementPrimitives";

function accountInitials(name?: string) {
  return (
    (name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

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
  const [copiedEmail, setCopiedEmail] = useState(false);
  const idTimer = useRef<number | undefined>(undefined);
  const emailTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (idTimer.current !== undefined) window.clearTimeout(idTimer.current);
      if (emailTimer.current !== undefined) window.clearTimeout(emailTimer.current);
    },
    [],
  );

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(profile.id);
      setCopiedId(true);
      if (idTimer.current !== undefined) window.clearTimeout(idTimer.current);
      idTimer.current = window.setTimeout(() => setCopiedId(false), 1800);
    } catch {
      /* Clipboard unavailable. */
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopiedEmail(true);
      if (emailTimer.current !== undefined) window.clearTimeout(emailTimer.current);
      emailTimer.current = window.setTimeout(() => setCopiedEmail(false), 1800);
    } catch {
      /* Clipboard unavailable. */
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      preventClose={resettingPassword}
      title={profile.full_name}
      description="People & Accounts · Account overview and access controls"
      ariaLabel={`Account: ${profile.full_name}`}
      width="max-w-lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!onEdit || resettingPassword}
              onClick={(event) => {
                event.stopPropagation();
                onEdit?.();
              }}
            >
              <Pencil size={14} aria-hidden="true" />
              Edit account
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!onAccess || resettingPassword}
              onClick={onAccess}
            >
              <KeyRound size={14} aria-hidden="true" />
              Individual access
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={resettingPassword}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] text-sm font-semibold text-[var(--eflow-primary)]"
            >
              {accountInitials(profile.full_name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--eflow-text)]">
                {profile.full_name}
              </p>
              <p className="truncate text-xs text-[var(--eflow-text-muted)]">
                {profile.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={profile.role} roleLabel={roleLabel} />
            <StatusBadge active={profile.is_active} />
          </div>
        </div>

        <dl className="grid gap-3 text-sm">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-3.5">
            <div className="flex min-w-0 items-start gap-3">
              <Mail
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--eflow-primary)]"
              />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-[var(--eflow-text-muted)]">
                  Email address
                </dt>
                <dd className="mt-0.5 break-all font-medium text-[var(--eflow-text)]">
                  {profile.email}
                </dd>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => void copyEmail()}
            >
              {copiedEmail ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              {copiedEmail ? "Copied" : "Copy"}
            </Button>
          </div>
        </dl>

        {protection && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900"
          >
            <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700" />
            <p className="m-0 leading-relaxed">{protection}</p>
          </div>
        )}

        <p className="rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--eflow-text-secondary)]">
          Default workspace access comes from the account’s role. You can add custom overrides in Individual Access without changing anyone else.
        </p>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--eflow-border)] pt-3 text-xs text-[var(--eflow-text-muted)]">
          <span className="truncate font-mono">ID: {profile.id}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void copyId()}
          >
            {copiedId ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Copy size={13} aria-hidden="true" />
            )}
            {copiedId ? "Copied" : "Copy ID"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
