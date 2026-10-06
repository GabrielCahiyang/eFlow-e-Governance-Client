import { useRef, useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import {
  FormField,
  SelectInput,
  TextInput,
} from "../../../../components/ui/FormField";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import { Modal, ModalButton } from "../../../../components/ui/Modal";
import { useToast } from "../../../../components/ui/Toast";
import type { Organization, UserProfile, UserRole } from "../../../../types";
import { assignOrganizationLeadership } from "../../../organization";
import {
  getLeadershipSlotConflict,
  isManagedLeadershipRole,
} from "../../services/leadershipConstraints";
import { getAssignableRoleOptions } from "./userManagementPrimitives";
import {
  parsePdsFile,
  updateEmployeeNotes,
  type ParsedPdsImport,
  type PdsEmployeeNotes,
} from "../../../members";
import { FileSpreadsheet, Plus, X } from "lucide-react";
import { PdsImportReview } from "./PdsImportReview";

import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../../shared/navigationGuard";
export function CreateUserModal({
  isOpen,
  onClose,
  orgOptions,
  organizations,
  profiles,
}: {
  isOpen: boolean;
  onClose: () => void;
  orgOptions: { value: string; label: string }[];
  organizations: Organization[];
  profiles: UserProfile[];
}) {
  const { createManagedUser, userProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "member" as UserRole,
    orgId: "",
  });
  const savePending = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importingPds, setImportingPds] = useState(false);
  const [pdsPreview, setPdsPreview] = useState<ParsedPdsImport | null>(null);
  const [appliedPdsNotes, setAppliedPdsNotes] =
    useState<PdsEmployeeNotes | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Skills tab state
  const [activeTab, setActiveTab] = useState<"basic" | "skills" | "review">(
    "basic",
  );
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<Record<string, boolean>>({});
  const leadershipConflict = getLeadershipSlotConflict({
    role: form.role,
    orgId: form.orgId,
    organizations,
    profiles,
  });
  const roleOptions = getAssignableRoleOptions(userProfile?.role);

  const resetForm = () => {
    setForm({
      fullName: "",
      email: "",
      password: "",
      role: "member",
      orgId: "",
    });
    setErrors({});
    setActiveTab("basic");
    setSkillInput("");
    setSkills({});
    setPdsPreview(null);
    setAppliedPdsNotes(null);
  };

  const draft = useExplicitDraft(
    "New account",
    isOpen &&
      Boolean(
        form.fullName ||
          form.email ||
          form.password ||
          form.orgId ||
          form.role !== "member" ||
          skillInput ||
          Object.keys(skills).length ||
          pdsPreview ||
          appliedPdsNotes,
      ),
    saving || importingPds,
    resetForm,
  );
  const close = () => {
    void requestNavigation(() => {
      resetForm();
      onClose();
    });
  };
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

  const importPds = async (file: File | undefined) => {
    if (!file) return;
    setImportingPds(true);
    try {
      const parsed = await parsePdsFile(file, orgOptions);
      setPdsPreview(parsed);
      setActiveTab("review");
      toast(
        "PDS extracted. Review the details before applying them.",
        "success",
      );
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not read the PDS workbook.",
        "error",
      );
    } finally {
      setImportingPds(false);
    }
  };

  const applyPdsImport = () => {
    if (!pdsPreview) return;
    setForm((current) => ({
      ...current,
      fullName: pdsPreview.profile.fullName || current.fullName,
      email:
        pdsPreview.details.personal.email ||
        pdsPreview.profile.email ||
        current.email,
      orgId: pdsPreview.profile.departmentId || current.orgId,
      role: pdsPreview.profile.role,
    }));
    setSkills((current) => ({
      ...current,
      ...Object.fromEntries(
        pdsPreview.employeeNotes.tags.map((skill) => [skill, true]),
      ),
    }));
    setAppliedPdsNotes(pdsPreview.employeeNotes);
    setPdsPreview(null);
    setActiveTab("basic");
    toast(
      "PDS details applied. Set a password and confirm the user information.",
      "success",
    );
  };

  const discardPdsPreview = () => {
    setPdsPreview(null);
    setActiveTab("basic");
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "Required";
    if (!form.email.trim()) errs.email = "Required";
    if (!form.password || form.password.length < 6)
      errs.password = "Min 6 characters";
    if (!form.orgId) errs.orgId = "Required";
    if (!roleOptions.some(({ value }) => value === form.role))
      errs.role = "You cannot assign this role.";
    if (leadershipConflict) errs.role = leadershipConflict;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (savePending.current) return;
    if (!validate()) return;
    savePending.current = true;
    draft.pendingRef.current = true;
    setSaveError(null);
    setSaving(true);
    try {
      const requestedLeadershipRole = isManagedLeadershipRole(form.role);
      const userId = await createManagedUser(form.email.trim(), form.password, {
        full_name: form.fullName.trim(),
        role: requestedLeadershipRole ? "member" : form.role,
        org_id: form.orgId,
        employee_id: null,
        skills,
      });

      if (appliedPdsNotes) {
        try {
          await updateEmployeeNotes(userId, appliedPdsNotes, userProfile?.id);
        } catch (notesError) {
          toast(
            `The account was created, but the extracted PDS notes could not be saved: ${notesError instanceof Error ? notesError.message : "unknown error"}`,
            "error",
          );
        }
      }

      if (requestedLeadershipRole) {
        const organization = organizations.find(
          (candidate) => candidate.id === form.orgId,
        );
        if (!organization)
          throw new Error("The selected organization is no longer available.");
        try {
          await assignOrganizationLeadership(organization.id, {
            headUserId: userId,
          });
        } catch (leadershipError) {
          toast(
            `The account was created safely as Member, but leadership was not assigned: ${leadershipError instanceof Error ? leadershipError.message : "unknown error"}`,
            "error",
          );
          draft.markClean();
          resetForm();
          onClose();
          return;
        }
      }

      toast(`User "${form.fullName}" created successfully`, "success");
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
      preventClose={saving || importingPds}
      className="eflow-foundation-surface"
      onClose={close}
      title="Create New User"
      width="max-w-2xl"
      footer={
        activeTab === "review" && pdsPreview ? (
          <>
            <ModalButton onClick={discardPdsPreview}>Cancel import</ModalButton>
            <ModalButton variant="primary" onClick={applyPdsImport}>
              Use these details
            </ModalButton>
          </>
        ) : (
          <>
            <ModalButton disabled={saving || importingPds} onClick={close}>
              Cancel
            </ModalButton>
            <ModalButton
              variant="primary"
              onClick={handleSubmit}
              pending={saving}
            >
              {saving ? "Creating..." : "Create User"}
            </ModalButton>
          </>
        )
      }
    >
      <>
        {saveError && (
          <FeedbackState tone="error" title="Changes were not saved">
            {saveError} Your entries are retained; use the save action to retry.
          </FeedbackState>
        )}
        {activeTab !== "review" && (
          <label className="mb-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-teal-200 bg-teal-50/60 px-3.5 py-3 text-teal-900 transition-colors hover:border-teal-300 hover:bg-teal-50">
            <span className="flex items-center gap-2">
              <FileSpreadsheet size={17} />
              <span>
                <span className="block text-[11px] font-semibold">
                  Import from CSC Personal Data Sheet
                </span>
                <span className="block text-[9.5px] text-teal-700">
                  Extract the workbook and review every matched detail before
                  applying it.
                </span>
              </span>
            </span>
            <span className="shrink-0 text-[10px] font-semibold">
              {importingPds ? "Reading…" : "Choose file"}
            </span>
            <input
              type="file"
              accept=".xls,.xlsx"
              className="sr-only"
              disabled={importingPds}
              onChange={(event) => {
                void importPds(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        )}

        {activeTab !== "review" && (
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

        {activeTab === "review" && pdsPreview && (
          <PdsImportReview parsed={pdsPreview} />
        )}

        {activeTab === "basic" && (
          <div className="space-y-4">
            <FormField label="Full Name" error={errors.fullName} required>
              <TextInput
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Juan Dela Cruz"
                hasError={!!errors.fullName}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Email" error={errors.email} required>
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="j.delacruz@eflow.gov.ph"
                  hasError={!!errors.email}
                />
              </FormField>
              <FormField label="Password" error={errors.password} required>
                <TextInput
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="Min. 6 characters"
                  hasError={!!errors.password}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Role"
                error={errors.role || leadershipConflict || undefined}
                required
              >
                <SelectInput
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as UserRole })
                  }
                  options={roleOptions}
                  hasError={Boolean(errors.role || leadershipConflict)}
                />
              </FormField>
              <FormField label="Organization" error={errors.orgId} required>
                <SelectInput
                  value={form.orgId}
                  onChange={(e) => setForm({ ...form, orgId: e.target.value })}
                  options={orgOptions}
                  placeholder="Select organization"
                  hasError={!!errors.orgId}
                />
              </FormField>
            </div>
          </div>
        )}

        {activeTab === "skills" && (
          <div className="space-y-3">
            <p className="text-[11px] font-normal text-muted-foreground">
              Add skills that the AI recommendation engine will use to match
              this member to tasks. Each skill is a keyword (e.g. "data
              analysis", "coordination", "budgeting").
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Type a skill and press Enter or +"
                className="flex-1 px-3 py-2 text-[12px] font-normal border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={addSkill}
                disabled={!skillInput.trim()}
                className="px-3 py-2 rounded-lg bg-primary text-white text-[12px] font-medium hover:bg-neutral-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {Object.keys(skills).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-[12px] font-normal">
                No skills added yet. Skills help the AI recommend the right
                member for each task.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.keys(skills).map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-secondary-foreground text-[11px] font-medium"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="text-muted-foreground hover:text-secondary-foreground cursor-pointer transition-colors leading-none"
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

// ─── Edit User Modal ─────────────────────────────────────────────
