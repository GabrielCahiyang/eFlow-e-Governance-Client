import * as React from "react";
import { Modal, ModalButton } from "../../../../components/ui/Modal";
import { useToast } from "../../../../components/ui/Toast";
import type { Organization, UserProfile } from "../../../../types";
import { assignOrganizationLeadership } from "../../services/leadershipService";
import { LeadershipAssignmentFields } from "./LeadershipAssignmentFields";

import { useConfirmation } from "../../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import { requestNavigation } from "../../../../shared/navigationGuard";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
export function AssignHeadModal({
  isOpen,
  onClose,
  org,
  orgs,
  profiles,
}: {
  isOpen: boolean;
  onClose: () => void;
  org: Organization | null;
  orgs: Organization[];
  profiles: UserProfile[];
}) {
  const { toast } = useToast();
  const [headUserId, setHeadUserId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const confirmation = useConfirmation();
  const pending = React.useRef(false);
  const [error, setError] = React.useState("");
  const draft = useExplicitDraft(
    "Office leadership",
    Boolean(isOpen && org && headUserId !== (org.head_user_id || "")),
    saving,
    () => setHeadUserId(org?.head_user_id || ""),
  );
  const close = () => {
    void requestNavigation(onClose);
  };
  React.useEffect(() => {
    if (!org) return;
    setHeadUserId(org.head_user_id || "");
  }, [org, isOpen]);

  const handleSave = async () => {
    if (!org || pending.current) return;
    pending.current = true;
    draft.pendingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (
        !(await confirmation.confirm({
          title: "Change Office leadership?",
          description: `${org.name}: ${profiles.find((profile) => profile.id === org.head_user_id)?.full_name || "Unassigned"} → ${profiles.find((profile) => profile.id === headUserId)?.full_name || "Unassigned"}. This changes appointed Head responsibilities and role access. Server leadership protections still apply.`,
          actionLabel: "Assign leadership",
          danger: !headUserId,
        }))
      )
        return;
      await assignOrganizationLeadership(org.id, {
        headUserId: headUserId || null,
      });
      toast(`Leadership updated for ${org.name}`, "success");
      draft.markClean();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Leadership could not be assigned.",
      );
      toast(
        error instanceof Error ? error.message : "Failed to assign leadership",
        "error",
      );
    } finally {
      pending.current = false;
      draft.pendingRef.current = false;
      setSaving(false);
    }
  };

  if (!org) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      preventClose={saving}
      title={`Assign Leadership — ${org.name}`}
      footer={
        <>
          <ModalButton disabled={saving} onClick={close}>
            Cancel
          </ModalButton>
          <ModalButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Assign"}
          </ModalButton>
        </>
      }
    >
      {confirmation.dialog}
      {error && (
        <FeedbackState tone="error" title="Leadership not saved">
          {error} Your selection is retained.
        </FeedbackState>
      )}
      <LeadershipAssignmentFields
        isOpen={isOpen}
        orgId={org.id}
        organizations={orgs}
        profiles={profiles}
        headUserId={headUserId}
        assistantHeadUserId=""
        onHeadChange={setHeadUserId}
        onAssistantHeadChange={() => {}}
      />
    </Modal>
  );
}
