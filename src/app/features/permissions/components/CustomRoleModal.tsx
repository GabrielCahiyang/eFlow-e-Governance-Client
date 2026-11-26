import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link2, ShieldPlus, X } from "lucide-react";
import { BoundedTextInput } from "../../../components/ui/BoundedInput";
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import {
  ACTION_PERMISSION_KEYS,
  VISIBLE_PAGE_PERMISSION_KEYS,
  type PermissionKey,
} from "../constants";
import {
  normalizeRolePermissionMap,
  planModulePresetChange,
  planRolePermissionToggle,
  type PermissionModuleDefinition,
} from "../dependencies";
import { rolePermissionAllowed } from "../selectors";
import {
  cleanCustomRoleLabel,
  validateCustomRoleName,
  type ExistingRoleLabelEntry,
} from "../validation/roleNameValidation";
import type { BaseCustomRole, CustomRoleDefinition, RolePermissionRow } from "../types";
import { ModuleRolePermissionCards } from "./ModulePermissionCards";

const ALL_CAPABILITY_KEYS: readonly PermissionKey[] = [
  ...VISIBLE_PAGE_PERMISSION_KEYS,
  ...ACTION_PERMISSION_KEYS,
];

function buildInitialPermissionMap(
  roleKey: string | null,
  baseRole: string | null,
  rows: RolePermissionRow[],
): Record<string, boolean> {
  const effectiveBase = baseRole || "member";
  const map: Record<string, boolean> = {};
  for (const permission of ALL_CAPABILITY_KEYS) {
    map[permission] = roleKey
      ? rolePermissionAllowed(roleKey, permission, rows, effectiveBase)
      : false;
  }
  return normalizeRolePermissionMap(map, effectiveBase);
}

export interface CustomRoleModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialRole?: CustomRoleDefinition | null;
  existingRoles?: readonly ExistingRoleLabelEntry[];
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

const EMPTY_EXISTING_ROLES: readonly ExistingRoleLabelEntry[] = [];
const EMPTY_ROLE_ROWS: RolePermissionRow[] = [];

export function CustomRoleModal({
  open,
  mode,
  initialRole,
  existingRoles = EMPTY_EXISTING_ROLES,
  roleRows = EMPTY_ROLE_ROWS,
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
  const [dependencyNotice, setDependencyNotice] = useState<string | null>(null);
  const [labelTouched, setLabelTouched] = useState(false);
  const [labelDirty, setLabelDirty] = useState(false);

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
    setDependencyNotice(null);
    setLabelTouched(false);
    setLabelDirty(false);
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

  const liveNameError = useMemo(() => {
    if (!label.trim()) return "Role name is required (2 to 60 characters).";
    return validateCustomRoleName(
      label,
      existingRoles,
      mode === "edit" ? initialRole?.key : null,
    );
  }, [label, existingRoles, mode, initialRole?.key]);

  if (!open) return null;

  const handleTogglePermission = (permission: PermissionKey, nextAllowed: boolean) => {
    const plan = planRolePermissionToggle(permissions, permission, nextAllowed, baseRole);
    if (!plan.allowed) {
      setDependencyNotice(plan.error || null);
      return;
    }
    setPermissions((current) =>
      normalizeRolePermissionMap({ ...current, ...plan.changes }, baseRole),
    );
    setDependencyNotice(plan.summary);
  };

  const handleSelectPreset = (module: PermissionModuleDefinition, presetId: string) => {
    const plan = planModulePresetChange(permissions, module, presetId, baseRole);
    if (!plan.allowed) {
      setDependencyNotice(plan.error || null);
      return;
    }
    setPermissions((current) =>
      normalizeRolePermissionMap({ ...current, ...plan.changes }, baseRole),
    );
    setDependencyNotice(plan.summary);
  };

  const handleBaseRoleChange = (nextBase: BaseCustomRole) => {
    setBaseRole(nextBase);
    setPermissions((current) => normalizeRolePermissionMap(current, nextBase));
    setDependencyNotice(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLabelTouched(true);
    const cleanedLabel = cleanCustomRoleLabel(label);
    const nameError = validateCustomRoleName(
      cleanedLabel,
      existingRoles,
      mode === "edit" ? initialRole?.key : null,
    );
    if (nameError) {
      setValidationError(nameError);
      return;
    }
    setValidationError(null);
    await onSubmit({
      label: cleanedLabel,
      description: description.trim().slice(0, INPUT_LIMITS.SHORT_DESCRIPTION),
      baseRole,
      permissions: normalizeRolePermissionMap(permissions, baseRole),
    });
  };

  const inlineNameError =
    validationError ||
    (labelTouched || labelDirty || label.trim().length >= 2 ? liveNameError : null);
  const submitBlocker = validationError || liveNameError || "";
  const displayError = inlineNameError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-role-modal-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
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
                  ? "Name the role and pick module access levels or individual permissions."
                  : "Update the role name, account type, and module permissions."}
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
                  Role name <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
                </label>
                <BoundedTextInput
                  id="custom-role-label"
                  type="text"
                  value={label}
                  onChange={(e) => {
                    setLabelDirty(true);
                    setLabel(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  onBlur={() => setLabelTouched(true)}
                  maxLength={INPUT_LIMITS.ROLE_NAME}
                  placeholder="e.g. Budget Reviewer"
                  autoFocus
                  disabled={saving}
                  aria-required
                  error={inlineNameError || undefined}
                  className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-[#0d544f] focus:outline-none"
                />
                {inlineNameError ? (
                  <span role="alert" className="sr-only">
                    {inlineNameError}
                  </span>
                ) : null}
              </div>

              <div>
                <label htmlFor="custom-role-desc" className="mb-1.5 block text-[12.5px] font-medium text-neutral-800">
                  Description
                </label>
                <BoundedTextInput
                  id="custom-role-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={INPUT_LIMITS.SHORT_DESCRIPTION}
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
                onChange={(event) => handleBaseRoleChange(event.target.value as BaseCustomRole)}
                disabled={saving}
                aria-describedby="custom-role-base-description"
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 sm:w-1/2"
              >
                <option value="member">Member</option>
                <option value="accounting_staff">Accounting Staff</option>
                <option value="head">Head</option>
              </select>
              <p id="custom-role-base-description" className="mt-1.5 text-[12px] text-neutral-500">
                Determines the account seat when assigning this role. Leave as Member unless this role replaces the Office Head or belongs to Accounting Staff.
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
                  Module permissions
                </span>
                <span className="text-[12px] text-neutral-500 tabular-nums">
                  {allowedCount} of {ALL_CAPABILITY_KEYS.length} allowed
                </span>
              </div>

              {dependencyNotice ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-lg border border-[#0d544f]/20 bg-teal-50/80 px-3 py-2 text-[12px] text-[#0d544f]"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{dependencyNotice}</span>
                </div>
              ) : null}

              <ModuleRolePermissionCards
                mode="modal"
                selectedRoleKey={initialRole?.key || "new_custom_role"}
                selectedRoleLabel={label || "Custom role"}
                baseRole={baseRole}
                isBuiltIn={false}
                isLocked={false}
                allowedMap={permissions}
                disabled={saving}
                onTogglePermission={handleTogglePermission}
                onSelectPreset={handleSelectPreset}
              />
            </div>

            {error && !inlineNameError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
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
            <ActionBlockerGroup
              actionLabel={mode === "create" ? "Create role" : "Save changes"}
              blockers={submitBlocker}
              busy={saving}
            >
              <button
                type="submit"
                disabled={saving || Boolean(validationError || liveNameError)}
                className="inline-flex min-h-[36px] items-center rounded-lg bg-[#0d544f] px-4 text-[13px] font-medium text-white hover:bg-[#0b4642] disabled:opacity-60"
              >
                {saving ? "Saving…" : mode === "create" ? "Create role" : "Save changes"}
              </button>
            </ActionBlockerGroup>
          </div>
        </form>
      </div>
    </div>
  );
}
