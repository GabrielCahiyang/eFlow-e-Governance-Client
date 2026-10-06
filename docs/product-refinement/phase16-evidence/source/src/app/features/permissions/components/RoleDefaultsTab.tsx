import { isAdminRole } from "../../../shared/roles";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LockKeyhole, MonitorCog, ShieldCheck } from "lucide-react";
import { useToast } from "../../../components/ui/Toast";
import {
  ACTION_PERMISSION_KEYS,
  MANAGED_ROLES,
  PAGE_PERMISSION_KEYS,
  PERMISSION_LABELS,
} from "../constants";
import { rolePermissionAllowed } from "../selectors";
import {
  fetchRolePermissions,
  setRolePermission,
} from "../services/permissionService";
import type { RolePermissionRow } from "../types";
import { Tooltip } from "@vibe/core";

function PermissionSection({
  title,
  description,
  permissions,
  rows,
  onToggle,
}: {
  title: string;
  description: string;
  permissions: readonly string[];
  rows: RolePermissionRow[];
  onToggle: (role: string, permission: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-neutral-100 bg-neutral-50/70 px-5 py-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-2 text-neutral-700">
          {title === "Page access" ? (
            <MonitorCog size={17} />
          ) : (
            <ShieldCheck size={17} />
          )}
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-neutral-900">
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">{description}</p>
        </div>
      </div>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label={`${title} role permissions`}
        tabIndex={0}
      >
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-neutral-100">
              <th
                scope="col"
                role="columnheader"
                className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.13em] text-neutral-400"
              >
                Capability
              </th>
              {MANAGED_ROLES.map((role) => (
                <th
                  key={role.key}
                  scope="col"
                  role="columnheader"
                  className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400"
                >
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr
                key={permission}
                className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60"
              >
                <td className="px-5 py-3">
                  <div className="text-[12px] font-medium text-neutral-900">
                    {
                      PERMISSION_LABELS[
                        permission as keyof typeof PERMISSION_LABELS
                      ]
                    }
                  </div>
                  <div className="mt-0.5 font-mono text-[9.5px] text-neutral-400">
                    {permission}
                  </div>
                </td>
                {MANAGED_ROLES.map((role) => {
                  const enabled = rolePermissionAllowed(
                    role.key,
                    permission,
                    rows,
                  );
                  const locked = isAdminRole(role.key);
                  return (
                    <td key={role.key} className="px-4 py-3 text-center">
                      <Tooltip
                        content={
                          locked
                            ? "Admin is limited to administrative capabilities"
                            : enabled
                              ? "Allowed. Select to deny this capability."
                              : "Denied. Select to allow this capability."
                        }
                      >
                        <span className="inline-flex">
                          <button
                            type="button"
                            aria-label={`${role.label}: ${enabled ? "Allowed" : "Denied"}`}
                            disabled={locked}
                            onClick={() => onToggle(role.key, permission)}
                            className={`relative h-6 w-11 rounded-full border transition-all duration-200 ${enabled ? "border-teal-700 bg-teal-700" : "border-neutral-300 bg-neutral-200"} ${locked ? "cursor-not-allowed opacity-55" : "hover:border-teal-600 hover:shadow-sm"}`}
                          >
                            <span
                              className={`absolute top-[3px] flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-[22px]" : "translate-x-[3px]"}`}
                            >
                              {enabled ? (
                                <Check size={9} className="text-teal-800" />
                              ) : null}
                            </span>
                          </button>
                        </span>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { FeedbackState } from "../../../components/ui/FeedbackState";
export function RoleDefaultsTab() {
  const [rows, setRows] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [result, setResult] = useState("");
  const [failure, setFailure] = useState("");
  const confirmation = useConfirmation();
  const draft = useExplicitDraft("Role default change", false, busy, () => {});
  const { toast } = useToast();

  const load = useCallback(async () => {
    setRows(await fetchRolePermissions());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (role: string, permission: string) => {
    if (isAdminRole(role)) {
      toast("Admin core access cannot be revoked.", "info");
      return;
    }
    if (pending.current) return;
    const next = !rolePermissionAllowed(role, permission, rows);
    pending.current = true;
    draft.pendingRef.current = true;
    setBusy(true);
    setFailure("");
    try {
      const label =
        MANAGED_ROLES.find((item) => item.key === role)?.label || role;
      if (
        !(await confirmation.confirm({
          title: "Change role default?",
          description: `${label}: ${PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] || permission} changes from ${next ? "Denied" : "Allowed"} to ${next ? "Allowed" : "Denied"}. This affects everyone inheriting this role default. Individual exceptions and data scope still apply.`,
          actionLabel: "Change default",
        }))
      )
        return;
      await setRolePermission(role, permission, next);
      setResult(
        `${role} · ${permission}: ${next ? "Allowed" : "Denied"}. Saved.`,
      );
      await load();
      toast(
        `${MANAGED_ROLES.find((item) => item.key === role)?.label || role} default updated.`,
        "success",
      );
    } catch (error: any) {
      setFailure(error?.message || "Failed to update the role default.");
      toast(error?.message || "Failed to update the role default.", "error");
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
    );

  return (
    <div className="space-y-4">
      {confirmation.dialog}
      <p className="text-xs text-muted-foreground">
        Displayed access uses role fallbacks when the current reader returns no
        overrides, including when a read is unavailable. A page permission never
        bypasses Office, project or server policy.
      </p>
      <button
        type="button"
        disabled={busy}
        className="rounded-lg border px-3 py-2 text-sm"
        onClick={() => void load()}
      >
        Refresh role defaults
      </button>
      {result && (
        <FeedbackState tone="success" title="Saved access change">
          {result}
        </FeedbackState>
      )}
      {failure && (
        <FeedbackState tone="error" title="Access change needs review">
          {failure} Refresh the current access before retrying.
        </FeedbackState>
      )}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <LockKeyhole size={17} className="mt-0.5 shrink-0 text-blue-700" />
        <div>
          <div className="text-[12px] font-semibold text-blue-950">
            Role defaults are the baseline
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800/80">
            Individual allows or denies can be added from User Access. Those
            exceptions never change anyone else with the same role.
          </p>
        </div>
      </div>
      <fieldset disabled={busy} className="min-w-0">
        <PermissionSection
          title="Page access"
          description="Controls which workspaces appear and whether direct navigation is allowed."
          permissions={PAGE_PERMISSION_KEYS}
          rows={rows}
          onToggle={toggle}
        />
      </fieldset>
      <fieldset disabled={busy} className="min-w-0">
        <PermissionSection
          title="Actions"
          description="Controls what a user can do after entering an authorized workspace."
          permissions={ACTION_PERMISSION_KEYS}
          rows={rows}
          onToggle={toggle}
        />
      </fieldset>
    </div>
  );
}
