import { ArrowLeft, CalendarDays, FileText, ShieldCheck } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import {
  FormField,
  TextInput,
  SelectInput,
} from "../../../../components/ui/FormField";
import { calendarMinDate } from "../../../../shared/calendarDates";
import { ProjectReadinessPanel } from "../../../project-readiness";
import type { Project, ProjectPriority } from "../../services/types";
import type { ProjectCommandTab } from "./types";
import "./projectSettingsPage.css";

import { useProjectSettings } from "../../hooks/useProjectSettings";

/** One metadata editor per project. Lifecycle, staffing and plan approvals retain their own commands. */
export function ProjectSettingsPage({
  project,
  canManage,
  onResolve,
  onBack,
}: {
  project: Project;
  canManage: boolean;
  onResolve: (view: ProjectCommandTab) => void;
  onBack: () => void;
}) {
  return (
    <SettingsForm
      key={project.id}
      project={project}
      canManage={canManage}
      onResolve={onResolve}
      onBack={onBack}
    />
  );
}

function SettingsForm({
  project,
  canManage,
  onResolve,
  onBack,
}: Parameters<typeof ProjectSettingsPage>[0]) {
  const {
    base,
    draft,
    setDraft,
    pending,
    error,
    setError,
    notice,
    conflict,
    setConflict,
    latest,
    setLatest,
    refreshing,
    dirty,
    closed,
    editable,
    loadLatest,
    save,
    fieldError,
    setBase,
    details,
  } = useProjectSettings(project, canManage);
  return (
    <section
      className="eflow-project-settings-page"
      aria-label="Project settings"
    >
      <header className="project-settings-heading">
        <div>
          <h2>Project settings</h2>
          <p>Details, dates and the checks needed to activate this project.</p>
        </div>
        <Button variant="outline" disabled={pending} onClick={onBack}>
          <ArrowLeft size={16} />
          Back to project
        </Button>
      </header>
      {!editable && (
        <FeedbackState title={closed ? "Closed project" : "Read-only project"}>
          {closed
            ? "Completed and archived project details are read-only. History and reports remain available."
            : "Only the appointed Head of the lead office can edit these details."}
        </FeedbackState>
      )}
      {conflict && (
        <div className="project-settings-conflict" role="alert">
          <strong>
            Project updated elsewhere; review new values before saving.
          </strong>
          <p>Your entries are retained.</p>
          {latest ? (
            <>
              <dl>
                {Object.entries(details(latest)).map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {
                        {
                          title: "Project name",
                          description: "Description",
                          priority: "Priority",
                          startDate: "Start date",
                          targetDate: "Target date",
                        }[key]
                      }
                    </dt>
                    <dd>{value || "Not set"}</dd>
                  </div>
                ))}
              </dl>
              <div className="project-settings-actions">
                <Button
                  variant="outline"
                  disabled={pending || refreshing}
                  onClick={() => {
                    setBase(latest);
                    setConflict(false);
                    setLatest(undefined);
                    setError("");
                  }}
                >
                  Keep my entries against this version
                </Button>
                <Button
                  variant="outline"
                  disabled={pending || refreshing}
                  onClick={() => {
                    setBase(latest);
                    setDraft(details(latest));
                    setConflict(false);
                    setLatest(undefined);
                    setError("");
                  }}
                >
                  Use latest values
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="outline"
              disabled={pending || refreshing}
              onClick={() => void loadLatest()}
            >
              {refreshing ? "Refreshing…" : "Refresh project details"}
            </Button>
          )}
        </div>
      )}
      <div className="project-settings-grid">
        <form
          className="project-settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <section className="project-settings-card">
            <h3>
              <FileText size={18} />
              General
            </h3>
            <FormField
              label="Project name"
              required
              error={fieldError("project name")}
            >
              <TextInput
                maxLength={200}
                value={draft.title}
                disabled={!editable || pending}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </FormField>
            <FormField label="Description">
              <textarea
                className="eflow-form-input"
                rows={4}
                value={draft.description}
                disabled={!editable || pending}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </FormField>
            <FormField label="Priority">
              <SelectInput
                value={draft.priority}
                disabled={!editable || pending}
                options={["low", "medium", "high"].map((value) => ({
                  value,
                  label: value[0].toUpperCase() + value.slice(1),
                }))}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    priority: e.target.value as ProjectPriority,
                  })
                }
              />
            </FormField>
          </section>
          <section className="project-settings-card">
            <h3>
              <CalendarDays size={18} />
              Timeline
            </h3>
            <div className="project-settings-dates">
              <FormField label="Start date" error={fieldError("start date")}>
                <TextInput
                  type="date"
                  min={calendarMinDate(base.startDate)}
                  value={draft.startDate}
                  disabled={!editable || pending}
                  onChange={(e) =>
                    setDraft({ ...draft, startDate: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Target date" error={fieldError("target date")}>
                <TextInput
                  type="date"
                  min={
                    draft.startDate &&
                    draft.startDate > calendarMinDate(base.targetDate)
                      ? draft.startDate
                      : calendarMinDate(base.targetDate)
                  }
                  value={draft.targetDate}
                  disabled={!editable || pending}
                  onChange={(e) =>
                    setDraft({ ...draft, targetDate: e.target.value })
                  }
                />
              </FormField>
            </div>
            <p>
              Save dates before confirming plan reviews. Material changes may
              require another review.
            </p>
          </section>
          {error && (
            <FeedbackState tone="error" title="Settings could not be saved">
              {error}
            </FeedbackState>
          )}
          {notice && <FeedbackState tone="success" title={notice} />}
          {editable && (
            <div className="project-settings-actions">
              <Button
                type="submit"
                pending={pending}
                disabled={!dirty || conflict}
              >
                Save changes
              </Button>
              <Button
                variant="outline"
                disabled={!dirty || pending}
                onClick={() => {
                  setDraft(details(base));
                  setError("");
                }}
              >
                Discard changes
              </Button>
              <span role="status">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </span>
            </div>
          )}
        </form>
        <section className="project-settings-card project-settings-readiness">
          <h3>
            <ShieldCheck size={18} />
            Setup & reviews
          </h3>
          {dirty && (
            <p>Save or discard your changes before confirming reviews.</p>
          )}
          <ProjectReadinessPanel
            project={project}
            canManage={editable && !dirty && !pending && !conflict}
            refreshKey={notice}
            onResolve={(view) =>
              view === "gantt"
                ? document
                    .querySelector<HTMLInputElement>(
                      ".project-settings-dates input",
                    )
                    ?.focus()
                : onResolve(view)
            }
          />
        </section>
      </div>
    </section>
  );
}
