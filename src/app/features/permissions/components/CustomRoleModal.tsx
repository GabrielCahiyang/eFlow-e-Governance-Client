import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ShieldPlus, X } from "lucide-react";
import {
  ACTION_PERMISSION_KEYS,
  PERMISSION_LABELS,
  VISIBLE_PAGE_PERMISSION_KEYS,
  type PermissionKey,
} from "../constants";
import { rolePermissionAllowed } from "../selectors";
import type { BaseCustomRole, CustomRoleDefinition, RolePermissionRow } from "../types";

const ALL_CAPABILITY_KEYS: readonly PermissionKey[] = [
  ...VISIBLE_PAGE_PERMISSION_KEYS,
  ...ACTION_PERMISSION_KEYS,
];

function buildInitialPermissionMap(
  roleKey: string | null,
  baseRole: string | null,
  rows: RolePermissionRow[],
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const permission of ALL_CAPABILITY_KEYS) {
    map[permission] = roleKey
      ? rolePermissionAllowed(roleKey, permission, rows, baseRole || "member")
      : false;
  }
  return map;
}

export interface CustomRoleModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialRole?: CustomRoleDefinition | null;
  roleRows?: RolePermissionRow[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: {
    label: string;
    description: string;
    baseRole: BaseCustomRole;
    permissions: Record<string, boolean>;
  }) => Promise<void> | void;
}

function ModalPermissionGroup({
  title,
  keys,
  permissions,
  disabled,
  onToggle,
}: {
  title: string;
  keys: readonly PermissionKey[];
  permissions: Record<string, boolean>;
  disabled: boolean;
  onToggle: (permission: PermissionKey) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/70 px-3.5 py-2">
        <h4 className="text-[12px] font-semibold text-neutral-900">{title}</h4>
        <span className="text-[11px] text-neutral-500">
          {keys.filter((k) => Boolean(permissions[k])).length}/{keys.length} allowed
        </span>
      </div>
      <div className="divide-y divide-neutral-100">
        {keys.map((permission) => {
          const allowed = Boolean(permissions[permission]);
          return (
            <div
              key={permission}
              className="flex items-center justify-between gap-3 px-3.5 py-2 hover:bg-neutral-50/60"
            >
              <span className="text-[12.5px] font-medium text-neutral-800">
                {PERMISSION_LABELS[permission] || permission}
              </span>
              <div
                role="group"
                aria-label={PERMISSION_LABELS[permission] || permission}
                className="inline-flex shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={allowed}
                  disabled={disabled}
                  onClick={() => {
                    if (!allowed) onToggle(permission);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    allowed
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Allow
                </button>
                <button
                  type="button"
                  aria-pressed={!allowed}
                  disabled={disabled}
                  onClick={() => {
                    if (allowed) onToggle(permission);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    !allowed
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Deny
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CustomRoleModal({
  open,
  mode,
  initialRole,
  roleRows = [],
  saving,
  error,
  onClose,
  onSubmit,
}: CustomRoleModalProps) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [baseRole, setBaseRole] = useState<BaseCustomRole>("member");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(initialRole?.label || "");
    setDescription(initialRole?.description || "");
    setBaseRole(initialRole?.baseRole ?? "member");
    setPermissions(
      buildInitialPermissionMap(
        mode === "edit" && initialRole ? initialRole.key : null,
        initialRole?.baseRole || null,
        roleRows,
      ),
    );
    setValidationError(null);
  }, [open, initialRole, mode, roleRows]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  const allowedCount = useMemo(
    () => ALL_CAPABILITY_KEYS.filter((k) => Boolean(permissions[k])).length,
    [permissions],
  );

  if (!open) return null;

  const handleTogglePermission = (permission: PermissionKey) => {
    setPermissions((current) => ({
      ...current,
      [permission]: !current[permission],
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanedLabel = label.trim().replace(/\s+/g, " ");
    if (cleanedLabel.length < 2 || cleanedLabel.length > 60) {
      setValidationError("Enter a role name between 2 and 60 characters.");
      return;
    }
    setValidationError(null);
    await onSubmit({
      label: cleanedLabel,
      description: description.trim().slice(0, 240),
      baseRole,
      permissions,
    });
  };

  const displayError = validationError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-role-modal-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d544f]/10 text-[#0d544f]">
              <ShieldPlus className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 id="custom-role-modal-title" className="text-[15px] font-semibold text-neutral-900">
                {mode === "create" ? "Create custom role" : "Edit custom role"}
              </h3>
              <p className="text-[12px] text-neutral-500">
                {mode === "create"
                  ? "Name the role and pick which pages and actions it can access."
                  : "Update the role name, description, and allowed permissions."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="custom-role-label" className="mb-1.5 block text-[12.5px] font-medium text-neutral-800">
                  Role name <span className="text-red-500">*</span>
                </label>
                <input
                  id="custom-role-label"
                  type="text"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  maxLength={60}
                  placeholder="e.g. Budget Reviewer"
                  autoFocus
                  disabled={saving}
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-[#0d544f] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="custom-role-desc" className="mb-1.5 block text-[12.5px] font-medium text-neutral-800">
                  Description
                </label>
                <input
                  id="custom-role-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={240}
                  placeholder="Optional note on when to assign this role"
                  disabled={saving}
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-[#0d544f] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="custom-role-base" className="mb-1.5 block text-[12.5px] font-medium text-neutral-800">
                Account type
              </label>
              <select
                id="custom-role-base"
                value={baseRole}
                onChange={(event) => setBaseRole(event.target.value as BaseCustomRole)}
                disabled={saving}
                aria-describedby="custom-role-base-description"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 sm:w-1/2"
              >
                <option value="member">Member</option>
                <option value="accounting_staff">Accounting Staff</option>
                <option value="head">Head</option>
              </select>
              <p id="custom-role-base-description" className="mt-1.5 text-[12px] text-neutral-500">
                Determines the account seat when assigning this role. Leave as Member unless this role replaces the Office Head.
              </p>
              {baseRole === "head" && (
                <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-800">
                  Only one active Head can lead an Office. Selecting Head subjects this role to Office Head approval and uniqueness limits.
                </p>
              )}
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-neutral-900">
                  Permissions
                </span>
                <span className="text-[12px] text-neutral-500">
                  {allowedCount} of {ALL_CAPABILITY_KEYS.length} allowed
                </span>
              </div>

              <ModalPermissionGroup
                title="Page access"
                keys={VISIBLE_PAGE_PERMISSION_KEYS}
                permissions={permissions}
                disabled={saving}
                onToggle={handleTogglePermission}
              />

              <ModalPermissionGroup
                title="Actions"
                keys={ACTION_PERMISSION_KEYS}
                permissions={permissions}
                disabled={saving}
                onToggle={handleTogglePermission}
              />
            </div>

            {displayError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {displayError}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-white px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex min-h-[36px] items-center rounded-lg border border-neutral-200 bg-white px-3.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[36px] items-center rounded-lg bg-[#0d544f] px-4 text-[13px] font-medium text-white hover:bg-[#0b4642] disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "create" ? "Create role" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
