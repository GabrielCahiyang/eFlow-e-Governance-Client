import { useEffect, useRef, useState } from "react";
import { useNavigationBlocker } from "../../../shared/navigationGuard";
import { scheduledDateError } from "../../../shared/calendarDates";
import { updateProject } from "../services/projectMutationService";
import {
  fetchProjectMetadata,
  ProjectMetadataConflict,
} from "../services/projectMetadata";
import { projectOperationError } from "../presentation/projectOperationError";
import type { Project } from "../services/types";
const details = (p: Project) => ({
  title: p.title,
  description: p.description || "",
  priority: p.priority,
  startDate: p.startDate || "",
  targetDate: p.targetDate || "",
});
export function useProjectSettings(project: Project, canManage: boolean) {
  const [base, setBase] = useState(project),
    [draft, setDraft] = useState(() => details(project));
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false),
    [latest, setLatest] = useState<Project>(),
    [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false),
    alive = useRef(true),
    ignoreVersion = useRef<string | number | undefined>(undefined);
  const receivedVersion = useRef(project.metadataVersion || project.updatedAt);
  const dirty = JSON.stringify(draft) !== JSON.stringify(details(base));
  const closed = ["completed", "archived"].includes(project.status);
  const editable = canManage && !closed;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const version = project.metadataVersion || project.updatedAt;
    if (receivedVersion.current === version) return;
    if (inFlight.current) return;
    receivedVersion.current = version;
    if (
      project.metadataVersion === base.metadataVersion &&
      project.updatedAt === base.updatedAt
    )
      return;
    if (
      ignoreVersion.current === (project.metadataVersion || project.updatedAt)
    )
      return;
    if (dirty) {
      setLatest(project);
      setConflict(true);
      setNotice("");
    } else {
      setBase(project);
      setDraft(details(project));
    }
  }, [project, base, dirty, pending]);
  useNavigationBlocker({
    label: "Project settings",
    identity: project.id,
    dirty,
    pending,
    pendingCheck: () => inFlight.current,
    onDiscard: () => {
      setDraft(details(base));
      setError("");
    },
  });

  const loadLatest = async () => {
    setRefreshing(true);
    setError("");
    try {
      const next = await fetchProjectMetadata(project.id);
      if (alive.current) {
        setLatest(next);
        setConflict(true);
      }
    } catch (e) {
      if (alive.current)
        setError(
          projectOperationError(e, "Could not refresh project details."),
        );
    } finally {
      if (alive.current) setRefreshing(false);
    }
  };
  const save = async () => {
    if (!editable || inFlight.current || !dirty || conflict) return;
    const dateIssue =
      draft.startDate && draft.targetDate && draft.targetDate < draft.startDate
        ? "Target date must be on or after the start date."
        : scheduledDateError(draft.startDate, {
            original: base.startDate,
            label: "Start date",
          }) ||
          scheduledDateError(draft.targetDate, {
            original: base.targetDate,
            label: "Target date",
          });
    const issue = !draft.title.trim()
      ? "Enter a project name."
      : draft.title.trim().length > 200
        ? "Project name must be 200 characters or fewer."
        : dateIssue;
    if (issue) {
      setError(issue);
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError("");
    setNotice("");
    const next = { ...draft, title: draft.title.trim() };
    try {
      const changed = Object.fromEntries(
        Object.entries(next).filter(
          ([key, value]) => value !== details(base)[key as keyof typeof next],
        ),
      );
      await updateProject(project.id, changed, base.metadataVersion);
      if (!alive.current) return;
      // The write succeeded. Never repeat it just because the following read fails.
      ignoreVersion.current = base.metadataVersion || base.updatedAt;
      setBase({ ...base, ...next });
      setDraft(next);
      setNotice("Project settings saved.");
      try {
        const fresh = await fetchProjectMetadata(project.id);
        if (alive.current) {
          setBase(fresh);
          setDraft(details(fresh));
        }
      } catch {
        if (alive.current) {
          setConflict(true);
          setNotice("Saved. Refresh project details before editing again.");
        }
      }
    } catch (e) {
      if (alive.current) {
        if (e instanceof ProjectMetadataConflict) {
          setConflict(true);
          void loadLatest();
        }
        setError(
          projectOperationError(
            e,
            "Could not save project settings. Your changes are retained.",
          ),
        );
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setPending(false);
    }
  };
  const fieldError = (name: string) =>
    error.toLowerCase().includes(name.toLowerCase()) ? error : undefined;
  return {
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
  };
}
