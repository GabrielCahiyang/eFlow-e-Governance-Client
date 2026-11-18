import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import {
  FormField,
  SelectInput,
  TextInput,
} from "../../../../components/ui/FormField";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import { Modal, ModalButton } from "../../../../components/ui/Modal";
import { useToast } from "../../../../components/ui/Toast";
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
  const [activeTab, setActiveTab] = useState<"basic" | "skills">("basic");
  const [skills, setSkills] = useState<Record<string, boolean>>({});
  const { activeLabels: availableSkillTags, loading: loadingSkillTags } = useSkillTags(isOpen);
  const resolvedRole = resolveRoleSelection(form.role, roleCatalog);
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
    ? editUser.custom_role_key || normalizeUserRole(editUser.role)
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

  useEffect(() => {
    if (editUser) {
      setForm({
        fullName: editUser.full_name,
        role: editUser.custom_role_key || normalizeUserRole(editUser.role),
        orgId: editUser.org_id || "",
      });
      setSkills(editUser.skills || {});
      setActiveTab("basic");
    }
  }, [editUser]);

  const handleSave = async () => {
    if (savePending.current) return;
    if (!editUser) return;
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
          form.orgId !== (editUser.org_id || "")) &&
        !(await confirmation.confirm({
          title: "Change account assignment?",
          description: `${editUser.full_name}: ${currentRoleDisplay?.label || getRoleLabel(editUser.role)} → ${resolvedRole.label}. Office: ${organizations.find((org) => org.id === editUser.org_id)?.name || "Unassigned"} → ${organizations.find((org) => org.id === form.orgId)?.name || "Unassigned"}. This changes inherited access and any appointed leadership. Server protection still applies.`,
          actionLabel: "Save assignment",
        }))
      )
        return;
      await updateManagedUserWithLeadership({
        user: editUser,
        organizations,
        profiles,
        changes: {
          full_name: form.fullName,
          role: resolvedRole.role,
          custom_role_key: resolvedRole.customRoleKey,
          org_id: form.orgId || null,
          skills,
        },
      });
      toast(`User "${form.fullName}" updated`, "success");
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
          <ModalButton variant="primary" onClick={handleSave} pending={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </ModalButton>
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
              <TextInput
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Role" error={leadershipConflict || undefined}>
                <SelectInput
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value })
                  }
                  options={roleOptions}
                  hasError={Boolean(leadershipConflict)}
                  disabled={
                    leadershipLocked ||
                    lastAdmin ||
                    editUser.id === userProfile?.id
                  }
                />
              </FormField>
              <FormField label="Office" description="External Office access is managed through project invitations.">
                <TextInput value={organizations.find(office => office.id === form.orgId)?.name || 'Unassigned'} readOnly/>
              </FormField>
            </div>
            {lastAdmin ? (
              <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10.5px] text-amber-800">
                The last active Admin must keep Admin access. Create or activate
                another Admin before changing this account's role.
              </p>
            ) : null}
            {leadershipLocked ? (
              <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10.5px] text-blue-800">
                You can edit this leader’s name and skills. Leadership role,
                organization, and account status are managed by the Admin.
              </p>
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
