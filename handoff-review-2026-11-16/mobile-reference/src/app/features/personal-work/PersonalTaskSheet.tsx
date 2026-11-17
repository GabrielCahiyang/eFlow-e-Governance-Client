import { confirmAction } from "../../shared/confirm";
import { formDraftKey, useRetainedDraft } from "../../shared/formDraftMemory";
import { useState } from "react";
import {
  Button,
  Choice,
  Field,
  Notice,
  Sheet,
} from "../../components/ui";
import type {
  PersonalCommand,
  PersonalMember,
  PersonalTask,
} from "../../../core/web/app/features/workspaces/types";
type Mode = "create" | "staff" | "progress" | "submit" | "review";
export function PersonalTaskSheet({
  mode,
  task,
  members,
  actor,
  busy,
  run,
  onClose,
}: {
  mode: Mode;
  task?: PersonalTask;
  members: PersonalMember[];
  actor: string;
  busy: boolean;
  run: (
    command: PersonalCommand,
    payload: Record<string, unknown>,
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const [draft, updateDraft, clearDraft] = useRetainedDraft(
      formDraftKey(actor, "personal-task:" + mode + ":" + (task?.id ?? "new")),
      true,
      () => ({
        title: "",
        lead: task?.lead_id || actor,
        reviewer: task?.reviewer_id || "",
        progress: String(task?.progress || 0),
        note: mode === "review" ? "" : task?.note || "",
        decision: "approve",
      }), { restoreOnOpen: mode !== "staff" },
    ),
    { title, lead, reviewer, progress, note, decision } = draft,
    [error, setError] = useState("");
  const close = () => {
    if (busy) return;
    setError("");
    onClose();
  };
  const eligible = members
    .filter((member) => member.state === "active" && member.eligible)
    .map((member) => ({ value: member.user_id, label: member.name }));
  const save = async () => {
    setError("");
    let command: PersonalCommand,
      payload: Record<string, unknown> = {
        task_id: task?.id,
        revision: task?.revision,
      };
    if (mode === "create" || mode === "staff") {
      if (
        !lead ||
        reviewer === lead ||
        (mode === "staff" && task?.reviewer_id && !reviewer)
      ) {
        setError(
          "Choose an eligible lead and a different reviewer. Required review cannot be removed.",
        );
        return;
      }
      if (mode === "create" && !title.trim()) {
        setError("Task name is required.");
        return;
      }
      command = mode === "create" ? "create_task" : "staff_task";
      payload = {
        ...(mode === "staff" ? payload : {}),
        ...(mode === "create" ? { title: title.trim() } : {}),
        lead_id: lead,
        reviewer_id: reviewer || null,
      };
    } else if (mode === "progress") {
      const amount = Number(progress);
      if (!Number.isInteger(amount) || amount < 0 || amount > 99) {
        setError("Progress must be a whole number from 0 to 99.");
        return;
      }
      command = "progress_task";
      payload = { ...payload, progress: amount, note };
    } else if (mode === "submit") {
      command = "submit_task";
      payload = { ...payload, note };
    } else {
      if (
        task?.reviewer_id !== actor ||
        task.lead_id === actor ||
        task.status !== "submitted"
      ) {
        setError("Current independent review access is required.");
        return;
      }
      if (decision !== "approve" && !note.trim()) {
        setError("Explain what needs to change.");
        return;
      }
      if (
        !(await confirmAction(
          decision === "approve"
            ? "Approve personal work?"
            : "Request changes?",
          note.trim() || task.title,
          decision === "approve" ? "Approve work" : "Request changes",
        ))
      )
        return;
      command = "review_task";
      payload = { ...payload, decision, note };
    }
    if (await run(command, payload)) {
      clearDraft();
      onClose();
    }
  };
  return (
    <Sheet
      actionError={error}
      open
      title={
        mode === "create"
          ? "Add personal task"
          : mode === "staff"
            ? "Task lead and reviewer"
            : mode === "progress"
              ? "Record personal progress"
              : mode === "submit"
                ? task?.reviewer_id
                  ? "Submit for independent review"
                  : "Mark personal task done"
                : "Review personal work"
      }
      description={task?.title}
      onClose={close}
      busy={busy}
      footer={
        <Button busy={busy} onPress={() => void save()}>
          {mode === "create"
            ? "Add personal task"
            : mode === "staff"
              ? "Save task people"
              : mode === "progress"
                ? "Save progress update"
                : mode === "submit"
                  ? task?.reviewer_id
                    ? "Submit for review"
                    : "Complete personal task"
                  : decision === "approve"
                    ? "Approve personal work"
                    : "Request changes"}
        </Button>
      }
    >
      {!!(mode === "create") && (
        <Field
          label="Task name"
          required
          value={title}
          onChangeText={(next) => updateDraft({ title: next })}
          maxLength={200}
        />
      )}
      {!!(mode === "create" || mode === "staff") && (
        <>
          <Choice
            label="Task lead"
            value={lead}
            onChange={(value) =>
              updateDraft((old) => ({
                ...old,
                lead: value,
                reviewer: value === old.reviewer ? "" : old.reviewer,
              }))
            }
            options={eligible}
          />
          <Choice
            label="Independent reviewer"
            value={reviewer}
            onChange={(next) => updateDraft({ reviewer: next })}
            options={[
              {
                value: "",
                label: task?.reviewer_id
                  ? "Choose independent reviewer"
                  : "No review required",
              },
              ...eligible.filter((person) => person.value !== lead),
            ]}
          />
          <Notice>
            Personal review does not grant Office approval or financial
            authority. Staffing reopens submitted work for a new submission.
          </Notice>
        </>
      )}
      {!!(mode === "progress") && (
        <Field
          label="Progress (%)"
          required
          value={progress}
          onChangeText={(next) => updateDraft({ progress: next })}
          keyboardType="number-pad"
        />
      )}
      {!!(mode === "review") && (
        <Choice
          label="Decision"
          required
          searchable={false}
          value={decision}
          onChange={(next) => updateDraft({ decision: next })}
          options={[
            { value: "approve", label: "Approve personal work" },
            { value: "reject", label: "Return for changes" },
          ]}
        />
      )}
      {!["create", "staff"].includes(mode) && (
        <Field
          label={mode === "review" ? "Review note" : "Work update"}
          required={mode === "review" && decision !== "approve"}
          value={note}
          onChangeText={(next) => updateDraft({ note: next })}
          multiline
          maxLength={4000}
        />
      )}
    </Sheet>
  );
}
