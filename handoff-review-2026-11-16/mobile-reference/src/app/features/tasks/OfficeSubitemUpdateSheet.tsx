import { useEffect, useRef, useState } from "react";
import {
  Button,
  Choice,
  Field,
  LabelValue,
  Row,
  Notice,
  Sheet,
} from "../../components/ui";
import { useToast } from "../../components/ui/Toast";
import { asServiceFile, chooseFiles, type PickedFile } from "../../../platform/files";
import { useAction } from "../../shared/useAction";
import { formDraftKey, useRetainedDraft } from "../../shared/formDraftMemory";
import {
  PublicMessageError,
  feedback,
  isDeterministicRejection,
} from "../../shared/userMessages";
import { saveSubtaskWorkUpdate } from "../../../core/web/app/features/subtasks/services/subtaskWorkflowService";
import { fetchWorkTree } from "../../../core/web/app/features/nested-work/services/workTreeService";
import { selectNodeWorkCapability } from "../../../core/web/app/features/nested-work/selectors/capabilities";
import type { WorkTreeSnapshot } from "../../../core/web/app/features/nested-work/types";
import { workScope } from "./branchInspector";
import { isSubtaskLeadOrContributor } from "./workPermissions";

export function OfficeSubitemUpdateSheet({
  tree,
  readOnly,
  nodeId,
  actorId,
  onClose,
  onSaved,
}: {
  tree: WorkTreeSnapshot;
  readOnly: boolean;
  nodeId: string;
  actorId: string;
  onClose: () => void;
  onSaved: (data: WorkTreeSnapshot) => Promise<void>;
}) {
  const baseline = useRef(tree).current;
  const activeBlocker =
    tree.nodes.find((item) => item.id === nodeId)?.blocker?.trim() || "";
  const { toast } = useToast();
  const [attempted, setAttempted] = useState(false);
  const action = useAction();
  const [draft, updateDraft, clearDraft] = useRetainedDraft(
    formDraftKey(actorId, "subitem-update:" + nodeId),
    true,
    () => ({
      state: (activeBlocker ? "stuck" : "in_progress") as "in_progress" | "stuck",
      note: "",
      blocker: activeBlocker,
      nextStep: "",
      attachment: undefined as PickedFile | undefined,
      seededBlocker: activeBlocker,
      dirty: false,
      stateTouched: false,
    }), { restoreOnOpen: false },
  );
  useEffect(() => {
    if (action.busy) return;
    const seeded = draft.seededBlocker ?? "";
    if (seeded === activeBlocker) return;
    if (!draft.dirty || (!draft.stateTouched && draft.blocker === seeded)) {
      updateDraft({
        state: activeBlocker ? "stuck" : "in_progress",
        blocker: activeBlocker,
        seededBlocker: activeBlocker,
      });
    }
  }, [
    action.busy,
    activeBlocker,
    draft.blocker,
    draft.dirty,
    draft.seededBlocker,
    draft.stateTouched,
    updateDraft,
  ]);
  const { state, note, blocker, nextStep, attachment } = draft;
  const close = () => {
    if (action.busy) return;
    action.clear();
    onClose();
  };
  const save = () =>
    action.run(async () => {
      if (attempted) return;
      if (state === "stuck" && !blocker.trim())
        throw new PublicMessageError("Describe what is blocking the work.");
      const latest = await fetchWorkTree(baseline.root.id);
      const latestNode = latest.nodes.find((item) => item.id === nodeId);
      if (
        readOnly ||
        latest.root.kind !== "office" ||
        latest.root.project !== baseline.root.project ||
        latest.root.office !== baseline.root.office ||
        latest.revision !== baseline.revision ||
        !latestNode ||
        !isSubtaskLeadOrContributor(latest, latestNode, actorId) ||
        !selectNodeWorkCapability(
          latest,
          nodeId,
          "execute",
          workScope(latest, actorId),
        ).allowed
      ) {
        throw new Error(
          "Work access or revision changed. Reopen this subtask and review the current work.",
        );
      }
      const file = attachment ? await asServiceFile(attachment) : null;
      setAttempted(true);
      try {
        await saveSubtaskWorkUpdate({
          subtaskId: nodeId,
          state: state === "stuck" ? "stuck" : "in_progress",
          blocker: state === "stuck" ? blocker : undefined,
          note,
          nextStep,
          attachment: file,
        });
      } catch (error) {
        if (isDeterministicRejection(error)) setAttempted(false);
        throw error;
      }
      clearDraft();
      toast("Work update posted.", "success");
      try {
        await onSaved(await fetchWorkTree(baseline.root.id));
      } catch {
        toast(feedback.saved, "info");
      }
      onClose();
    });
  return (
    <Sheet
      actionError={action.error}
      open
      title="Update subtask work"
      busy={action.busy}
      onClose={close}
      footer={
        <Button
          busy={action.busy}
          disabled={attempted || readOnly}
          onPress={() => void save()}
        >
          Post update
        </Button>
      }
    >
      <Choice
        label="Work state"
        value={state}
        searchable={false}
        onChange={(next) =>
          updateDraft({ state: next, dirty: true, stateTouched: true })
        }
        options={[
          { value: "in_progress", label: "In progress" },
          { value: "stuck", label: "Blocked" },
        ]}
      />
      {state === "stuck" && (
        <Field
          label="Blocker"
          required
          value={blocker}
          onChangeText={(next) => updateDraft({ blocker: next, dirty: true })}
          maxLength={3000}
          multiline
        />
      )}
      <Field
        label="Work note"
        value={note}
        onChangeText={(next) => updateDraft({ note: next, dirty: true })}
        maxLength={3000}
        multiline
      />
      <Field
        label="Next step"
        value={nextStep}
        onChangeText={(next) => updateDraft({ nextStep: next, dirty: true })}
        maxLength={300}
      />
      {attachment ? (
        <Row>
          <LabelValue label="Attachment" value={attachment.name} />
          <Button
            variant="outline"
            disabled={attempted || readOnly || action.busy}
            onPress={() => updateDraft({ attachment: undefined })}
          >
            Remove attachment
          </Button>
        </Row>
      ) : (
        <Button
          variant="outline"
          disabled={attempted || readOnly || action.busy}
          onPress={() =>
            void action.run(async () => {
              const picked = (await chooseFiles("*/*", false))[0];
              if (picked) updateDraft({ attachment: picked });
            })
          }
        >
          Attach evidence (optional)
        </Button>
      )}
      {attempted && !!action.error && (
        <Notice>
          Close this sheet and refresh the subtask before trying again. Check
          activity to see whether the update was recorded.
        </Notice>
      )}
    </Sheet>
  );
}
