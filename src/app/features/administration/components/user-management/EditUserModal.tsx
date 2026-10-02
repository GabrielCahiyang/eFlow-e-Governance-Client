import { useEffect, useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import { FormField, SelectInput, TextInput } from "../../../../components/ui/FormField";
import { Modal, ModalButton } from "../../../../components/ui/Modal";
import { useToast } from "../../../../components/ui/Toast";
import type { Organization, UserProfile, UserRole } from "../../../../types";
import { getAssignableRoleOptions } from "./userManagementPrimitives";
import { getLeadershipSlotConflict, isManagedLeadershipRole } from "../../services/leadershipConstraints";
import { updateManagedUserWithLeadership } from "../../services/managedUserLeadershipService";
import { Plus, X } from "lucide-react";
import { getRoleLabel, isAdminRole, normalizeUserRole } from "../../../../shared/roles";
import { isLastActiveAdmin } from "../../selectors/adminAccountProtection";

export function EditUserModal({
  isOpen,
  onClose,
  user: editUser,
  orgOptions,
  organizations,
  profiles,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  orgOptions: { value: string; label: string }[];
  organizations: Organization[];
  profiles: UserProfile[];
}) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    role: "employee" as UserRole,
    orgId: "",
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "skills">("basic");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<Record<string, boolean>>({});
  const leadershipConflict = getLeadershipSlotConflict({
    role: form.role,
    orgId: form.orgId,
    currentUserId: editUser?.id,
    organizations,
    profiles,
  });
  const leadershipLocked = !isAdminRole(userProfile?.role) && isManagedLeadershipRole(editUser?.role || "");
  const roleOptions = leadershipLocked && editUser
    ? [{ value: editUser.role, label: getRoleLabel(editUser.role) }]
    : getAssignableRoleOptions(userProfile?.role);
  if (editUser && !roleOptions.some((item) => item.value === normalizeUserRole(editUser.role))) {
    roleOptions.push({ value: normalizeUserRole(editUser.role), label: getRoleLabel(editUser.role) });
  }
  const lastAdmin = editUser ? isLastActiveAdmin(editUser, profiles) : false;

  useEffect(() => {
    if (editUser) {
      setForm({
        fullName: editUser.full_name,
        role: normalizeUserRole(editUser.role),
        orgId: editUser.org_id || "",
      });
      setSkills(editUser.skills || {});
      setActiveTab("basic");
      setSkillInput("");
    }
  }, [editUser]);

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skills[trimmed]) return;
    setSkills((prev) => ({ ...prev, [trimmed]: true }));
    setSkillInput("");
  };

  const removeSkill = (key: string) => {
    setSkills((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    if (!editUser) return;
    if (lastAdmin && !isAdminRole(form.role)) {
      toast("The last active Admin must keep Admin access.", "error");
      return;
    }
    if (leadershipConflict) {
      toast(leadershipConflict, "error");
      return;
    }
    setSaving(true);
    try {
      await updateManagedUserWithLeadership({
        user: editUser,
        organizations,
        profiles,
        changes: {
        full_name: form.fullName,
        role: form.role,
        org_id: form.orgId || null,
        skills,
        },
      });
      toast(`User "${form.fullName}" updated`, "success");
      onClose();
    } catch (err: any) {
      toast(err?.message || "Failed to update user", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!editUser) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit User — ${editUser.full_name}`}
      width="max-w-xl"
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </ModalButton>
        </>
      }
    >
      <>
        {/* Tab bar */}
        <div className="flex border-b border-neutral-200 mb-4 -mt-1">
          <button
            onClick={() => setActiveTab("basic")}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "basic"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-400 hover:text-neutral-700"
            }`}
          >
            Basic Info
          </button>
          <button
            onClick={() => setActiveTab("skills")}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "skills"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-400 hover:text-neutral-700"
            }`}
          >
            Skills
            {Object.keys(skills).length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-900 text-white text-[9px] font-semibold">
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
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  options={roleOptions}
                  hasError={Boolean(leadershipConflict)}
                  disabled={leadershipLocked || lastAdmin || editUser.id === userProfile?.id}
                />
              </FormField>
              <FormField label="Organization">
                <SelectInput
                  value={form.orgId}
                  onChange={(e) => setForm({ ...form, orgId: e.target.value })}
                  options={orgOptions}
                  placeholder="Select organization"
                  disabled={leadershipLocked || editUser.id === userProfile?.id}
                />
              </FormField>
            </div>
            {lastAdmin ? <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10.5px] text-amber-800">The last active Admin must keep Admin access. Create or activate another Admin before changing this account's role.</p> : null}
            {leadershipLocked ? <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10.5px] text-blue-800">You can edit this leader’s name and skills. Leadership role, organization, and account status are managed by the Admin.</p> : null}
            <div className="text-[11px] font-normal text-neutral-500">
              Email: {editUser.email} · ID: {editUser.id.slice(0, 12)}...
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-neutral-500">
              Add or remove skills for this employee. The AI recommendation engine uses these to match tasks. Each skill is a keyword (e.g. "data analysis", "coordination", "budgeting").
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="Type a skill and press Enter or +"
                className="flex-1 px-3 py-2 text-[12px] font-normal border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white text-neutral-900 placeholder:text-neutral-400"
              />
              <button
                onClick={addSkill}
                disabled={!skillInput.trim()}
                className="px-3 py-2 rounded-lg bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {Object.keys(skills).length === 0 ? (
              <div className="text-center py-8 text-neutral-400 text-[12px] font-normal">
                No skills added yet. Skills help the AI recommend the right employee for each task.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.keys(skills).map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-[11px] font-medium"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="text-neutral-400 hover:text-neutral-700 cursor-pointer transition-colors leading-none"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────────────
