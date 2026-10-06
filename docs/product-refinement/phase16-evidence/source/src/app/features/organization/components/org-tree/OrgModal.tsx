import * as React from "react";
import { createOrg, updateOrg } from "../../../../../lib/supabaseService";
import {
  FormField,
  SelectInput,
  TextInput,
} from "../../../../components/ui/FormField";
import { Modal, ModalButton } from "../../../../components/ui/Modal";
import { useToast } from "../../../../components/ui/Toast";
import type { Organization, OrgType, UserProfile } from "../../../../types";
import {
  assignOrganizationLeadership,
  assignOrganizationApprovers,
  fetchOrganizationApprovers,
} from "../../services/leadershipService";
import { ORG_TYPE_OPTIONS } from "./orgTreeModel";
import { LeadershipAssignmentFields } from "./LeadershipAssignmentFields";

import { useConfirmation } from "../../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../../shared/navigationGuard";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
export function OrgModal({
  isOpen,
  onClose,
  org,
  parentId,
  orgs,
  profiles,
}: {
  isOpen: boolean;
  onClose: () => void;
  org?: Organization;
  parentId?: string;
  orgs: Organization[];
  profiles: UserProfile[];
}) {
  const { toast } = useToast();
  const isEdit = !!org;
  const [form, setForm] = React.useState({
    name: "",
    org_type: "department" as OrgType,
    description: "",
    parent_id: "",
    head_user_id: "",
    backup_reviewer_id: "",
  });
  const [saving, setSaving] = React.useState(false);
  const baseline = React.useRef(JSON.stringify(form));
  const [receipt, setReceipt] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const createdOffice = React.useRef<string | null>(null);
  const pending = React.useRef(false);
  const confirmation = useConfirmation();
  const draft = useExplicitDraft(
    "Office details",
    isOpen && JSON.stringify(form) !== baseline.current,
    saving,
    () => setForm(JSON.parse(baseline.current)),
  );
  const close = () => {
    void requestNavigation(onClose);
  };
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (org) {
      const initial = {
        name: org.name,
        org_type: org.org_type,
        description: org.description,
        parent_id: org.parent_id || "",
        head_user_id: org.head_user_id || "",
        backup_reviewer_id: "",
      };
      baseline.current = JSON.stringify(initial);
      setForm(initial);
    } else {
      const initial = {
        name: "",
        org_type: (parentId ? "division" : "department") as OrgType,
        description: "",
        parent_id: parentId || "",
        head_user_id: "",
        backup_reviewer_id: "",
      };
      baseline.current = JSON.stringify(initial);
      setForm(initial);
    }
    createdOffice.current = null;
    setReceipt("");
    setSaveError("");
  }, [org, parentId, isOpen]);

  React.useEffect(() => {
    if (!isOpen || !org || !["board", "committee"].includes(org.org_type))
      return;
    let cancelled = false;
    void fetchOrganizationApprovers(org.id)
      .then((leadership) => {
        if (cancelled) return;
        setForm((current) => {
          if (JSON.stringify(current) !== baseline.current) return current;
          const loaded = {
            ...current,
            head_user_id: leadership.headUserId || "",
            backup_reviewer_id: leadership.assistantHeadUserId || "",
          };
          baseline.current = JSON.stringify(loaded);
          return loaded;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen, org]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Required";
    if (form.head_user_id && form.head_user_id === form.backup_reviewer_id) {
      errs.backup_reviewer_id =
        "Primary and backup reviewers must be different people";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (pending.current || !validate()) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const previous = JSON.parse(baseline.current) as typeof form;
      if (
        (form.head_user_id !== previous.head_user_id ||
          form.backup_reviewer_id !== previous.backup_reviewer_id) &&
        !(await confirmation.confirm({
          title: "Change Office appointments?",
          description: `${form.name}: Head ${profiles.find((profile) => profile.id === previous.head_user_id)?.full_name || "Unassigned"} → ${profiles.find((profile) => profile.id === form.head_user_id)?.full_name || "Unassigned"}. ${["board", "committee"].includes(form.org_type) ? "Primary and backup reviewers must remain independent." : "This changes Head responsibilities and inherited role access."} Existing leadership validation remains in force.`,
          actionLabel: "Save Office appointments",
          danger: !form.head_user_id,
        }))
      )
        return;
      if (isEdit && org) {
        await updateOrg(org.id, {
          name: form.name.trim(),
          description: form.description.trim(),
        });
        if (
          form.head_user_id !== org.head_user_id ||
          ["board", "committee"].includes(form.org_type)
        ) {
          await (
            ["board", "committee"].includes(form.org_type)
              ? assignOrganizationApprovers
              : assignOrganizationLeadership
          )(org.id, {
            headUserId: form.head_user_id || null,
            assistantHeadUserId: ["board", "committee"].includes(form.org_type)
              ? form.backup_reviewer_id || null
              : null,
          });
        }
        toast(`"${form.name}" updated`, "success");
      } else {
        const newOrg = createdOffice.current
          ? { id: createdOffice.current }
          : await createOrg({
              name: form.name.trim(),
              parent_id: form.parent_id || null,
              org_type: form.org_type,
              description: form.description.trim(),
            });
        createdOffice.current = newOrg.id;
        setReceipt(
          `Office ${newOrg.id} created. Leadership assignment is a separate step; retry continues this Office.`,
        );
        if (form.head_user_id || form.backup_reviewer_id) {
          await (
            ["board", "committee"].includes(form.org_type)
              ? assignOrganizationApprovers
              : assignOrganizationLeadership
          )(newOrg.id, {
            headUserId: form.head_user_id || null,
            assistantHeadUserId: form.backup_reviewer_id || null,
          });
        }
        toast(`"${form.name}" created`, "success");
      }
      baseline.current = JSON.stringify(form);
      draft.markClean();
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || "Office details could not be saved.");
      toast(err?.message || "Failed to save", "error");
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setSaving(false);
    }
  };

  const parentOptions = orgs
    .filter((o) => o.id !== org?.id)
    .map((o) => ({ value: o.id, label: o.name }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      preventClose={saving}
      title={isEdit ? `Edit Organization — ${org?.name}` : "Add Organization"}
      width="max-w-2xl"
      footer={
        <>
          <ModalButton disabled={saving} onClick={close}>
            Cancel
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create"}
          </ModalButton>
        </>
      }
    >
      {confirmation.dialog}
      {receipt && (
        <FeedbackState tone="success" title="Office receipt">
          {receipt}
        </FeedbackState>
      )}
      {saveError && (
        <FeedbackState tone="error" title="Office save needs review">
          {saveError} Entries are retained; any completed Office creation is
          reused on retry.
        </FeedbackState>
      )}
      <div className="space-y-4">
        <FormField label="Name" error={errors.name} required>
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. LEDIPO"
            hasError={!!errors.name}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Org Type">
            <SelectInput
              value={form.org_type}
              onChange={(e) =>
                setForm({ ...form, org_type: e.target.value as OrgType })
              }
              options={ORG_TYPE_OPTIONS}
            />
          </FormField>
          <FormField label="Parent">
            <SelectInput
              value={form.parent_id}
              onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              options={[
                { value: "", label: "No parent (root-level)" },
                ...parentOptions,
              ]}
            />
          </FormField>
        </div>
        <FormField label="Description">
          <TextInput
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description..."
          />
        </FormField>
        <LeadershipAssignmentFields
          isOpen={isOpen}
          orgId={org?.id}
          organizations={orgs}
          profiles={profiles}
          headUserId={form.head_user_id}
          assistantHeadUserId={form.backup_reviewer_id}
          onHeadChange={(userId) => setForm({ ...form, head_user_id: userId })}
          onAssistantHeadChange={(userId) =>
            setForm({ ...form, backup_reviewer_id: userId })
          }
          assistantHeadError={errors.backup_reviewer_id}
          boardMode={["board", "committee"].includes(form.org_type)}
        />
      </div>
    </Modal>
  );
}

// ─── Assign Head Modal ───────────────────────────────────────────
