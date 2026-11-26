import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import { BoundedTextInput } from "../../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../../components/ui/FieldValidationTooltip";
import {
  FormField,
  SelectInput,
} from "../../../../components/ui/FormField";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import { Modal, ModalButton } from "../../../../components/ui/Modal";
import { useToast } from "../../../../components/ui/Toast";
import { ActionBlockerGroup } from "../../../../components/ui/action-blockers";
import { INPUT_LIMITS } from "../../../../shared/inputLimits";
import type { Organization, UserProfile } from "../../../../types";
import { getAssignableRoleOptions } from "./userManagementPrimitives";
import {
  getAssignableRoleCatalog,
  resolveAccountRoleDisplay,
  resolveRoleSelection,
  type ManagedRoleCatalogEntry,
} from "../../../permissions";
import {
  getLeadershipSlotConflict,
  isManagedLeadershipRole,
} from "../../services/leadershipConstraints";
import { updateManagedUserWithLeadership } from "../../services/managedUserLeadershipService";
import { sendManagedUserPasswordReset } from "../../services/managedUserService";
import { Mail } from "lucide-react";
import {
  SkillTagSelector,
  skillListToMap,
  skillMapToList,
} from "../../../../components/ui/SkillTagSelector";
import { useSkillTags } from "../../../../shared/skillTags";
import {
  getRoleLabel,
  isAdminRole,
  normalizeUserRole,
} from "../../../../shared/roles";
import { isLastActiveAdmin } from "../../selectors/adminAccountProtection";

import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../../shared/navigationGuard";
import { useConfirmation } from "../../../../components/ui/useConfirmation";
export function EditUserModal({
  isOpen,
  onClose,
  user: editUser,
  organizations,
  profiles,
  roleCatalog = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  organizations: Organization[];
  profiles: UserProfile[];
  roleCatalog?: ManagedRoleCatalogEntry[];
}) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    role: "member",
    orgId: "",
  });
  const savePending = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSentNotice, setResetSentNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "skills">("basic");
  const [skills, setSkills] = useState<Record<string, boolean>>({});
  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [roleTipOpen, setRoleTipOpen] = useState(false);
  const roleWrapRef = useRef<HTMLDivElement | null>(null);
  const roleId = useId();
  const roleTipId = useId();
  const { activeLabels: availableSkillTags, loading: loadingSkillTags } = useSkillTags(isOpen);
  const initialBaseRole = editUser ? normalizeUserRole(editUser.role) : "member";
  const resolvedRole = (() => {
    try {
      return resolveRoleSelection(form.role, roleCatalog);
    } catch {
      return {
        role: initialBaseRole,
        customRoleKey:
          editUser?.custom_role_key && form.role === editUser.custom_role_key
            ? editUser.custom_role_key
            : null,
        label: getRoleLabel(initialBaseRole),
      };
    }
  })();
  const leadershipConflict = getLeadershipSlotConflict({
    role: resolvedRole.role,
    customRoleLabel: resolvedRole.customRoleKey ? resolvedRole.label : undefined,
    orgId: form.orgId,
    currentUserId: editUser?.id,
    organizations,
    profiles,
  });
  const leadershipLocked =
    !isAdminRole(userProfile?.role) &&
    isManagedLeadershipRole(editUser?.role || "");
  const initialRoleKey = editUser
    ? editUser.custom_role_key || initialBaseRole
    : "member";
  const currentRoleDisplay = editUser
    ? resolveAccountRoleDisplay(editUser.role, editUser.custom_role_key, roleCatalog)
    : null;
  const assignableOptions = roleCatalog.length > 0
    ? getAssignableRoleCatalog(roleCatalog, userProfile?.role).map((entry) => ({
        value: entry.key,
        label: entry.label,
      }))
    : getAssignableRoleOptions(userProfile?.role);
  const roleOptions =
    leadershipLocked && editUser
      ? [{ value: initialRoleKey, label: currentRoleDisplay?.label || getRoleLabel(editUser.role) }]
      : [...assignableOptions];
  if (
    editUser &&
    !roleOptions.some((item) => item.value === initialRoleKey)
  ) {
    roleOptions.push({
      value: initialRoleKey,
      label: currentRoleDisplay?.label || getRoleLabel(editUser.role),
    });
  }
  const confirmation = useConfirmation();
  const restore = () => {
    if (editUser) {
      setForm({
        fullName: editUser.full_name,
        role: initialRoleKey,
        orgId: editUser.org_id || "",
      });
      setSkills(editUser.skills || {});
      setFullNameTouched(false);
    }
  };
  const dirty = Boolean(
    isOpen &&
      editUser &&
      (form.fullName !== editUser.full_name ||
        form.role !== initialRoleKey ||
        form.orgId !== (editUser.org_id || "") ||
        JSON.stringify(skills) !== JSON.stringify(editUser.skills || {})),
  );
  const draft = useExplicitDraft("Account details", dirty, saving, restore);
  const close = () => {
    void requestNavigation(onClose);
  };
  const lastAdmin = editUser ? isLastActiveAdmin(editUser, profiles) : false;
  const isSelfEdit = Boolean(editUser && editUser.id === userProfile?.id);
  const trimmedFullName = form.fullName.trim();
  const rawFullNameIssue = !trimmedFullName
    ? "Full name is required."
    : trimmedFullName.length < 2
      ? "Enter the full name (at least 2 characters)."
      : "";
  const visibleFullNameError =
    fullNameTouched || form.fullName !== (editUser?.full_name ?? "")
      ? rawFullNameIssue
      : "";
  const lastAdminRoleBlocked = lastAdmin && !isAdminRole(resolvedRole.role);
  const saveBlockers = [
    rawFullNameIssue,
    lastAdminRoleBlocked ? "The last active Admin must keep Admin access." : "",
    leadershipConflict,
  ].filter(Boolean);
  const roleFieldError =
    leadershipConflict ||
    (lastAdminRoleBlocked ? "The last active Admin must keep Admin access." : "");
  const roleTooltipMessage =
    roleFieldError ||
    (isSelfEdit
      ? "You cannot change your own role while signed in. Ask another Admin to update it."
      : lastAdmin
        ? "The last active Admin must keep Admin access."
        : leadershipLocked
          ? "Leadership roles are managed by Admin."
          : "");
  const roleTooltipTone: "error" | "warning" = roleFieldError ? "error" : "warning";

  useEffect(() => {
    if (editUser) {
      setForm({
        fullName: editUser.full_name,
        role: editUser.custom_role_key || normalizeUserRole(editUser.role),
        orgId: editUser.org_id || "",
      });
      setSkills(editUser.skills || {});
      setActiveTab("basic");
      setResetSentNotice(null);
      setSaveError(null);
      setFullNameTouched(false);
    }
  }, [editUser]);

  const canSendPasswordReset =
    Boolean(editUser) &&
    editUser?.is_active !== false &&
    (isAdminRole(userProfile?.role) ||
      (!isAdminRole(editUser?.role) && !isManagedLeadershipRole(editUser?.role || "")));
  const resetBlockers =
    editUser && editUser.is_active === false
      ? ["Activate this account before sending a password reset link."]
      : !canSendPasswordReset
        ? ["Only Admin can send a password reset link for an Admin or leadership account."]
        : [];

  const handleSendPasswordReset = async () => {
    if (!editUser || sendingReset || !canSendPasswordReset) return;
    if (
      !(await confirmation.confirm({
        title: "Send password reset link?",
        description: `Send a one-time password reset email to ${editUser.full_name} (${editUser.email})? They will choose a new password on the dedicated reset page.`,
        actionLabel: "Send reset link",
      }))
    ) {
      return;
    }

    setSendingReset(true);
    setResetSentNotice(null);
    try {
      const result = await sendManagedUserPasswordReset(editUser.id);
      const msg = `Password reset link sent to ${result.email}.`;
      setResetSentNotice(msg);
      toast(msg, "success");
    } catch (err: any) {
      toast(err?.message || "Failed to send password reset link", "error");
    } finally {
      setSendingReset(false);
    }
  };

  const handleSave = async () => {
    if (savePending.current) return;
    if (!editUser) return;
    if (rawFullNameIssue) {
      setFullNameTouched(true);
      setActiveTab("basic");
      return;
    }
    if (lastAdmin && !isAdminRole(resolvedRole.role)) {
      toast("The last active Admin must keep Admin access.", "error");
      return;
    }
    if (leadershipConflict) {
      toast(leadershipConflict, "error");
      return;
    }
    if (savePending.current) return;
    savePending.current = true;
    draft.pendingRef.current = true;
    setSaveError(null);
    setSaving(true);
    try {
      if (
        (form.role !== initialRoleKey ||
          resolvedRole.role !== initialBaseRole ||
          form.orgId !== (editUser.org_id || "")) &&
        !(await confirmation.confirm({
          title: "Change account role?",
          description: `${editUser.full_name}: ${currentRoleDisplay?.label || getRoleLabel(editUser.role)} → ${resolvedRole.label}. This changes inherited access and any appointed leadership. Server protection still applies.`,
          actionLabel: "Save role",
        }))
      )
        return;
      await updateManagedUserWithLeadership({
        user: editUser,
        organizations,
        profiles,
        changes: {
          full_name: trimmedFullName,
          role: resolvedRole.role,
          custom_role_key: resolvedRole.customRoleKey,
          org_id: form.orgId || null,
          skills,
        },
      });
      toast(`User "${trimmedFullName}" updated`, "success");
      draft.markClean();
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to update user");
      toast(err?.message || "Failed to update user", "error");
    } finally {
      savePending.current = false;
      draft.pendingRef.current = false;
      setSaving(false);
    }
  };

  if (!editUser) return null;

  return (
    <Modal
      isOpen={isOpen}
      preventClose={saving}
      className="eflow-foundation-surface"
      onClose={close}
      title={`Edit User — ${editUser.full_name}`}
      width="max-w-xl"
      footer={
        <>
          <ModalButton disabled={saving} onClick={close}>
            Cancel
          </ModalButton>
          <ActionBlockerGroup
            actionLabel="Save Changes"
            blockers={saveBlockers}
            busy={saving}
          >
            <ModalButton
              variant="primary"
              onClick={handleSave}
              pending={saving}
              disabled={saveBlockers.length > 0}
            >
              {saving ? "Saving..." : "Save Changes"}
            </ModalButton>
          </ActionBlockerGroup>
        </>
      }
    >
      <>
        {confirmation.dialog}
        {saveError && (
          <FeedbackState tone="error" title="Changes were not saved">
            {saveError} Your entries are retained; use the save action to retry.
          </FeedbackState>
        )}
        {/* Tab bar */}
        <div className="flex border-b border-border mb-4 -mt-1">
          <button
            onClick={() => setActiveTab("basic")}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "basic"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-secondary-foreground"
            }`}
          >
            Basic Info
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "skills"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-secondary-foreground"
            }`}
          >
            Skills
            {Object.keys(skills).length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[9px] font-semibold">
                {Object.keys(skills).length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "basic" && (
          <div className="space-y-4">
            <FormField label="Full Name" required>
              <BoundedTextInput
                maxLength={INPUT_LIMITS.PERSON_NAME}
                value={form.fullName}
                error={visibleFullNameError || undefined}
                onBlur={() => setFullNameTouched(true)}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="eflow-form-input h-10 w-full rounded-lg border border-border bg-input-background px-3 text-[13px] font-normal text-foreground placeholder:text-muted-foreground outline-none transition-all hover:border-neutral-400 focus:border-ring focus:ring-2 focus:ring-ring/15"
              />
            </FormField>
            <div>
              <FormField label="Role" controlId={roleId} error={roleFieldError || undefined}>
                <div
                  ref={roleWrapRef}
                  onMouseEnter={() => setRoleTipOpen(true)}
                  onMouseLeave={() => setRoleTipOpen(false)}
                >
                  <SelectInput
                    id={roleId}
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value })
                    }
                    onFocus={() => setRoleTipOpen(true)}
                    onBlur={() => setRoleTipOpen(false)}
                    options={roleOptions}
                    hasError={Boolean(roleFieldError)}
                    aria-invalid={Boolean(roleFieldError) || undefined}
                    aria-describedby={roleTipOpen && Boolean(roleTooltipMessage) ? roleTipId : undefined}
                    disabled={
                      leadershipLocked ||
                      lastAdmin ||
                      isSelfEdit
                    }
                  />
                  <FieldValidationTooltip
                    id={roleTipId}
                    anchorRef={roleWrapRef}
                    message={roleTooltipMessage || undefined}
                    open={roleTipOpen && Boolean(roleTooltipMessage)}
                    tone={roleTooltipTone}
                  />
                </div>
              </FormField>
            </div>
            {lastAdmin ? (
              <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10.5px] text-amber-800">
                The last active Admin must keep Admin access. Create or activate
                another Admin before changing this account's role.
              </p>
            ) : null}
            {isSelfEdit && !lastAdmin && !leadershipLocked ? (
              <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10.5px] text-blue-800">
                You cannot change your own role while signed in. Ask another
                Admin if your role needs to be updated.
              </p>
            ) : null}
            {leadershipLocked ? (
              <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10.5px] text-blue-800">
                You can edit this leader’s name and skills. Leadership role and
                account status are managed by the Admin.
              </p>
            ) : null}
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-foreground">
                  Password recovery
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {editUser.is_active
                    ? `Send a reset link to ${editUser.email} so they can set a new password.`
                    : "Activate this account before sending a password reset link."}
                </p>
              </div>
              <ActionBlockerGroup
                actionLabel="Send reset link"
                blockers={resetBlockers}
                busy={saving || sendingReset}
              >
                <ModalButton
                  disabled={saving || sendingReset || !canSendPasswordReset}
                  onClick={() => void handleSendPasswordReset()}
                >
                  <Mail size={13} aria-hidden="true" />
                  {sendingReset ? "Sending…" : "Send reset link"}
                </ModalButton>
              </ActionBlockerGroup>
            </div>
            {resetSentNotice ? (
              <FeedbackState tone="success" title="Reset link sent">
                {resetSentNotice}
              </FeedbackState>
            ) : null}
            <div className="text-[11px] font-normal text-muted-foreground">
              Email: {editUser.email} · ID: {editUser.id.slice(0, 12)}...
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="space-y-3">
            <SkillTagSelector
              availableTags={availableSkillTags}
              loading={loadingSkillTags}
              selected={skillMapToList(skills)}
              disabled={saving}
              title="Member skills"
              description="Tap skill tags to assign or remove skills used for task recommendations."
              emptyMessage="No skill tags added yet. Add skills in System & Maintenance → Skill Tags."
              onChange={(next) => setSkills(skillListToMap(next))}
            />
          </div>
        )}
      </>
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────────────
