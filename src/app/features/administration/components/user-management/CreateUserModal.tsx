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
import {
  getAssignableRoleCatalog,
  resolveRoleSelection,
  type ManagedRoleCatalogEntry,
} from "../../../permissions";
import {
  getLeadershipSlotConflict,
} from "../../services/leadershipConstraints";
import { getAssignableRoleOptions } from "./userManagementPrimitives";
import { getRoleLabel } from "../../../../shared/roles";
import { ledipoOffice } from '../../selectors/ledipoOffice';
import { accountSkillsError, listActivationOffices, stageAccountActivation, type ActivationOffice, type ManagedAccountRole } from '../../../account-activation';
import {
  SkillTagSelector,
  skillListToMap,
  skillMapToList,
} from "../../../../components/ui/SkillTagSelector";
import { useSkillTags } from "../../../../shared/skillTags";
import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../../shared/navigationGuard";

export function CreateUserModal({
  isOpen,
  onClose,
  organizations,
  profiles,
  mode = 'ledipo_create',
  roleCatalog = [],
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  organizations: Organization[];
  profiles: UserProfile[];
  mode?: 'ledipo_create' | 'office_invite';
  roleCatalog?: ManagedRoleCatalogEntry[];
  onCreated?: () => void;
}) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const homeOffice = ledipoOffice(organizations);
  const homeOfficeId = homeOffice?.id || '';
  const [authorizedOffices, setAuthorizedOffices] = useState<ActivationOffice[]>([]);
  const [officeError, setOfficeError] = useState('');
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    let active = true;
    setAuthorizedOffices([]); setOfficeError('');
    if (isOpen && userProfile?.role === 'admin') void listActivationOffices()
      .then(result => {
        if (!Array.isArray(result.offices)) throw new Error('Could not load LEDIPO workspace. Close this form and try again.');
        if (active) setAuthorizedOffices(result.offices);
      })
      .catch(reason => { if (active) setOfficeError(reason.message); });
    return () => { active = false; };
  }, [isOpen, userProfile?.id, userProfile?.role]);
  const resolvedLedipoId =
    homeOfficeId ||
    authorizedOffices.find((o) => o.slug === 'ledipo')?.id ||
    authorizedOffices[0]?.id ||
    '';
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "member",
    orgId: resolvedLedipoId,
  });
  useEffect(() => { setForm(current => ({ ...current, orgId: resolvedLedipoId })); }, [resolvedLedipoId, mode]);
  const savePending = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Skills tab state
  const [activeTab, setActiveTab] = useState<"basic" | "skills">("basic");
  const [skills, setSkills] = useState<Record<string, boolean>>({});
  const { activeLabels: availableSkillTags, loading: loadingSkillTags } = useSkillTags(isOpen);
  const resolvedRole = resolveRoleSelection(form.role, roleCatalog);
  const leadershipConflict = getLeadershipSlotConflict({
    role: resolvedRole.role,
    customRoleLabel: resolvedRole.customRoleKey ? resolvedRole.label : undefined,
    orgId: form.orgId,
    organizations,
    profiles,
  });
  const roleOptions = roleCatalog.length > 0
    ? getAssignableRoleCatalog(roleCatalog, userProfile?.role).map((entry) => ({
        value: entry.key,
        label: entry.label,
      }))
    : getAssignableRoleOptions(userProfile?.role);

  const resetForm = () => {
    setForm({
      fullName: "",
      email: "",
      role: "member",
      orgId: resolvedLedipoId,
    });
    request.current = null;
    setErrors({});
    setActiveTab("basic");
    setSkills({});
  };

  const draft = useExplicitDraft(
    "New account",
    isOpen &&
      Boolean(
        form.fullName ||
          form.email ||
          form.role !== "member" ||
          Object.keys(skills).length,
      ),
    saving,
    resetForm,
  );
  const close = () => {
    void requestNavigation(() => {
      resetForm();
      onClose();
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    const targetOrgId = form.orgId || resolvedLedipoId;
    if (mode === 'ledipo_create' && !form.fullName.trim()) errs.fullName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    if (!targetOrgId || (authorizedOffices.length > 0 && !authorizedOffices.some(o => o.id === targetOrgId))) {
      errs.orgId = officeError || 'LEDIPO workspace is unavailable. Close this form and try again.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (mode === 'ledipo_create' && form.fullName.trim() && form.fullName.trim().length < 2) errs.fullName = 'Enter the full name.';
    if (!roleOptions.some(({ value }) => value === form.role))
      errs.role = "You cannot assign this role.";
    if (mode === 'ledipo_create') {
      const skillIssue = accountSkillsError(skills);
      if (skillIssue) { errs.skills = skillIssue; setActiveTab('skills'); }
    }
    setErrors(errs);
    return !leadershipConflict && Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (savePending.current) return;
    if (!validate()) return;
    savePending.current = true;
    draft.pendingRef.current = true;
    setSaveError(null);
    setSaving(true);
    try {
      const cleanedFullName = form.fullName.trim();
      const targetOrgId = form.orgId || resolvedLedipoId;
      const values = {
        mode,
        email: form.email.trim().toLowerCase(),
        ...(mode === 'ledipo_create' && cleanedFullName ? { full_name: cleanedFullName } : {}),
        role: resolvedRole.role as ManagedAccountRole,
        ...(resolvedRole.customRoleKey ? { custom_role_key: resolvedRole.customRoleKey } : {}),
        org_id: targetOrgId,
        skills: mode === 'ledipo_create' ? skills : {},
        pds_notes: null,
      };
      const fingerprint = JSON.stringify(values);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      const receipt = await stageAccountActivation({ ...values, request_id: request.current.id });
      toast(receipt.email_delivery_status === 'failed'
        ? 'Invitation saved, but email could not be sent. Resend it from Pending activation.'
        : 'Activation invitation saved. The person will set their own password from the email.', receipt.email_delivery_status === 'failed' ? 'warning' : 'success');
      onCreated?.();
      draft.markClean();
      resetForm();
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || "Failed to create user");
      toast(err?.message || "Failed to create user", "error");
    } finally {
      savePending.current = false;
      draft.pendingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      preventClose={saving}
      className="eflow-foundation-surface"
      onClose={close}
      title={mode === 'ledipo_create' ? "Create LEDIPO User" : "Invite eFlow User"}
      width="max-w-2xl"
      footer={
        <>
          <ModalButton disabled={saving} onClick={close}>
            Cancel
          </ModalButton>
          <ModalButton
            variant="primary"
            onClick={handleSubmit}
            pending={saving}
          >
            {saving ? "Saving invitation…" : "Send activation email"}
          </ModalButton>
        </>
      }
    >
      <fieldset className="m-0 min-w-0 border-0 p-0" aria-label="Account invitation" disabled={saving}>
        <FeedbackState tone="info" title="Email activation required">
          {mode === 'office_invite'
            ? 'The person will receive an activation link to enter their name, skills, and password. They cannot sign in before activation.'
            : 'The person will receive a link and choose their own password. They cannot sign in before activation.'}
        </FeedbackState>
        {(officeError || errors.orgId) && (
          <FeedbackState tone="error" title="LEDIPO workspace unavailable">
            {officeError || errors.orgId}
          </FeedbackState>
        )}
        {saveError && (
          <FeedbackState tone="error" title="Could not confirm the invitation">
            {saveError} Your entries are kept. Retry to check the same request.
          </FeedbackState>
        )}
        {mode === 'ledipo_create' && (
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
        )}

        {activeTab === "basic" && (
          <div className="space-y-4">
            {mode === 'ledipo_create' && (
              <FormField label="Full Name" error={errors.fullName} required>
                <TextInput
                  maxLength={160}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Juan Dela Cruz"
                  hasError={!!errors.fullName}
                />
              </FormField>
            )}

            <div>
              <FormField label="Email" error={errors.email} required>
                <TextInput
                  type="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="j.delacruz@eflow.gov.ph"
                  hasError={!!errors.email}
                />
              </FormField>
            </div>
            {(resolvedRole.role === 'admin' || resolvedRole.role === 'head') && <FeedbackState tone="info" title="Approval after activation">After this person verifies their email, Admin must approve their role from Pending activation before they can sign in.</FeedbackState>}

            <div>
              <FormField
                label="Role"
                error={errors.role || leadershipConflict || undefined}
                required
              >
                <SelectInput
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value })
                  }
                  options={roleOptions}
                  hasError={Boolean(errors.role || leadershipConflict)}
                />
              </FormField>
            </div>
            {resolvedRole.customRoleKey && resolvedRole.role !== 'head' && resolvedRole.role !== 'admin' && (
              <p className="text-[11.5px] text-muted-foreground">
                Assigns a {getRoleLabel(resolvedRole.role)} account with {resolvedRole.label} permissions.
              </p>
            )}
          </div>
        )}

        {mode === 'ledipo_create' && activeTab === "skills" && (
          <div className="space-y-3">
            {errors.skills && <p role="alert" className="text-xs text-destructive">{errors.skills}</p>}
            <SkillTagSelector
              availableTags={availableSkillTags}
              loading={loadingSkillTags}
              selected={skillMapToList(skills)}
              disabled={saving}
              title="Pre-select skills (optional)"
              description="Tap skill tags maintained by Admin so the invited user starts with matching tags."
              emptyMessage="No skill tags added yet. Add skills in System & Maintenance → Skill Tags."
              onChange={(next) => {
                setErrors((current) => ({ ...current, skills: "" }));
                setSkills(skillListToMap(next));
              }}
            />
          </div>
        )}
      </fieldset>
    </Modal>
  );
}
