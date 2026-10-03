import * as React from "react";
import { Modal, ModalButton } from "../../../../components/ui/Modal";
import { useToast } from "../../../../components/ui/Toast";
import type { Organization, UserProfile } from "../../../../types";
import {
  assignOrganizationLeadership,
} from "../../services/leadershipService";
import { LeadershipAssignmentFields } from "./LeadershipAssignmentFields";

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

  React.useEffect(() => {
    if (!org) return;
    setHeadUserId(org.head_user_id || "");
  }, [org, isOpen]);

  const handleSave = async () => {
    if (!org) return;

    setSaving(true);
    try {
      await assignOrganizationLeadership(org.id, {
        headUserId: headUserId || null,
      });
      toast(`Leadership updated for ${org.name}`, "success");
      onClose();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to assign leadership",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!org) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Leadership — ${org.name}`}
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Assign"}
          </ModalButton>
        </>
      }
    >
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
