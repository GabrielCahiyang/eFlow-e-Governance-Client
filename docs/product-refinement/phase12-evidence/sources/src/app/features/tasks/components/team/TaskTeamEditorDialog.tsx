import { FeedbackState } from '../../../../components/ui/FeedbackState';
import { FeatureDialog } from '../../../../components/ui/FeatureDialog';
import { useConfirmation } from '../../../../components/ui/useConfirmation';
import { requestNavigation } from '../../../../shared/navigationGuard';
import { useExplicitDraft } from '../../../../shared/useExplicitDraft';
import { isAdminRole } from "../../../../shared/roles";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Search, Text } from "@vibe/core";
import { Favorite, Remove, Team, Warning } from "@vibe/icons";
import type { UserProfile } from "../../../../types";
import type { Subtask } from "../../../../services/subtaskService";
import { useToast } from "../../../../components/ui/Toast";
import { getTaskLeadId, getTaskTeamMemberIds, getTaskTeamRemovalBlockers } from "../../selectors/teamMembership";
import { updateTaskTeamMembers } from "../../services/taskTeamService";
import type { Task } from "../../taskTypes";

interface TeamCandidate {
  id: string;
  name: string;
  role: string;
  organization: string;
  canBeAdded: boolean;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
const roleLabel = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function TaskTeamEditorDialog({
  task,
  profiles,
  subtasks,
  responsibleOrgId,
  onClose,
}: {
  task: Task | null;
  profiles: UserProfile[];
  subtasks: Subtask[];
  responsibleOrgId?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [baselineIds, setBaselineIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const currentIds = useMemo(() => task ? getTaskTeamMemberIds(task) : [], [task]);
  const latestTask = useRef(task); latestTask.current = task;
  const { confirm, dialog, cancel } = useConfirmation();
  const dirty = selectedIds.length !== baselineIds.length || selectedIds.some(id => !baselineIds.includes(id));
  const draftGuard = useExplicitDraft('Task team members', !!task && dirty, saving, () => setSelectedIds(currentIds));
  const close = () => { if (!draftGuard.pendingRef.current) void requestNavigation(onClose); };
  const leadId = task ? getTaskLeadId(task) : undefined;
  const blockers = useMemo(() => task ? getTaskTeamRemovalBlockers(task, subtasks) : new Map(), [subtasks, task]);

  useEffect(() => {
    if (!task) { cancel(); return; }
    setSelectedIds(getTaskTeamMemberIds(task));
    setBaselineIds(getTaskTeamMemberIds(task));
    setSearch("");
    setError("");
  }, [task?.id]);

  const candidates = useMemo<TeamCandidate[]>(() => {
    if (!task) return [];
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const taskNameById = new Map((task.teamMemberIds || []).map((id, index) => [id, task.teamMemberNames?.[index] || "Team Member"]));
    if (task.assigneeId && task.assigneeName) taskNameById.set(task.assigneeId, task.assigneeName);
    const ids = new Set([
      ...profiles.filter((profile) => profile.is_active && !isAdminRole(profile.role) && (!responsibleOrgId || profile.org_id === responsibleOrgId || profile.departmentId === responsibleOrgId)).map((profile) => profile.id),
      ...currentIds,
    ]);
    return Array.from(ids).map((id) => {
      const profile = profileById.get(id);
      return {
        id,
        name: profile?.full_name || taskNameById.get(id) || "Team Member",
        role: profile?.role || "member",
        organization: profile?.org_name || task.teamName || "Responsible organization",
        canBeAdded: currentIds.includes(id) || Boolean(profile?.is_active && (!responsibleOrgId || profile.org_id === responsibleOrgId || profile.departmentId === responsibleOrgId)),
      };
    }).sort((a, b) => Number(selectedIds.includes(b.id)) - Number(selectedIds.includes(a.id)) || a.name.localeCompare(b.name));
  }, [currentIds, profiles, responsibleOrgId, selectedIds, task]);

  const filtered = candidates.filter((candidate) => {
    const value = `${candidate.name} ${candidate.role} ${candidate.organization}`.toLowerCase();
    return value.includes(search.trim().toLowerCase());
  });

  const toggle = (candidate: TeamCandidate) => {
    const selected = selectedIds.includes(candidate.id);
    if (selected) {
      const blocker = blockers.get(candidate.id);
      if (blocker) {
        setError(`${blocker.reason}${blocker.subtaskTitles.length ? ` Active work: ${blocker.subtaskTitles.join(", ")}.` : ""}`);
        return;
      }
      setSelectedIds((ids) => ids.filter((id) => id !== candidate.id));
    } else if (candidate.canBeAdded) {
      setSelectedIds((ids) => [...ids, candidate.id]);
    }
    setError("");
  };

  const save = async () => {
    if (!task || draftGuard.pendingRef.current || !dirty) return;
    draftGuard.pendingRef.current = true;
    const accepted = await confirm({title: 'Save task team changes?', description: 'Members added or removed gain or lose access to this task. The Task Lead and unfinished subtask assignments stay protected.', actionLabel: 'Save members', impact: <p>{selectedIds.filter(id => !currentIds.includes(id)).length} added · {currentIds.filter(id => !selectedIds.includes(id)).length} removed</p>});
    if (!accepted) { draftGuard.pendingRef.current = false; return; }
    if (!latestTask.current || latestTask.current.id !== task.id) { draftGuard.pendingRef.current = false; return; }
    const latestIds = getTaskTeamMemberIds(latestTask.current);
    if (latestIds.length !== baselineIds.length || latestIds.some(id => !baselineIds.includes(id))) { draftGuard.pendingRef.current = false; setError('The task team changed while you were editing. Close and reopen to review current members.'); return; }
    setSaving(true);
    setError("");
    try {
      await updateTaskTeamMembers({ task, nextMemberIds: selectedIds, profiles, subtasks });
      toast("Task members updated.", "success");
      draftGuard.markClean();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update task members.");
    } finally {
      draftGuard.pendingRef.current = false;
      setSaving(false);
    }
  };

  if (!task) return null;
  return (
    <><FeatureDialog title="Manage members" description={`${task.title} · only active people from the responsible organization can be added.`} onClose={close} preventClose={saving} contentClassName="max-w-xl">
      <div className="min-h-0 flex flex-1 flex-col p-5">
        <h2 className="text-lg font-semibold">Manage members</h2><p className="text-sm text-neutral-500 mb-3">{task.title} · active people from the responsible organization</p>
        <div className="flex min-h-0 max-h-[60vh] flex-col gap-3">
          <Search value={search} onChange={setSearch} onClear={() => setSearch("")} autoFocus placeholder="Search members by name or role…" inputAriaLabel="Search task members" showClearIcon />
          {error && <FeedbackState tone="error" title="Task member changes are blocked"><p className="break-words">{error}</p></FeedbackState>}

        <div className="flex-1 space-y-1 overflow-y-auto">
          {filtered.map((candidate) => {
            const selected = selectedIds.includes(candidate.id);
            const blocker = blockers.get(candidate.id);
            return <button key={candidate.id} type="button" onClick={() => toggle(candidate)} disabled={saving || (!selected && !candidate.canBeAdded)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selected ? "border-violet-200 bg-violet-50" : "border-transparent hover:border-neutral-200 hover:bg-neutral-50"} disabled:cursor-not-allowed disabled:opacity-40`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">{initials(candidate.name)}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-900">{candidate.name}{candidate.id === leadId && <Favorite size={12} className="text-amber-500" />}</span><span className="block truncate text-[9.5px] text-neutral-400">{roleLabel(candidate.role)} · {candidate.organization}</span>{blocker && selected && <span className="mt-0.5 block truncate text-[9px] text-amber-700">{candidate.id === leadId ? "Task Lead · change the lead before removing" : `Working on: ${blocker.subtaskTitles.join(", ")}`}</span>}</span>
              {selected ? blocker ? <span title={blocker.reason} className="rounded-lg bg-amber-100 p-1.5 text-amber-700"><Warning size={14} /></span> : <span className="rounded-lg p-1.5 text-neutral-400"><Remove size={14} /></span> : <span className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-300" />}
            </button>;
          })}
          {!filtered.length && <div className="py-12 text-center text-[11px] text-neutral-400">No eligible members match your search.</div>}
        </div>
        </div>
      </div>
      <footer className="mt-auto flex shrink-0 items-center justify-between border-t border-neutral-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Text className="inline-flex items-center gap-1.5 text-neutral-500" type="text3"><Team size={14} /> <span className="tabular-nums">{selectedIds.length}</span> member{selectedIds.length === 1 ? "" : "s"} assigned</Text>
        <div className="flex gap-2"><Button kind="secondary" onClick={close} disabled={saving} size="small">Cancel</Button><Button kind="primary" loading={saving} disabled={saving || !dirty} onClick={() => void save()} size="small">Save members</Button></div>
      </footer>
    </FeatureDialog>{dialog}</>
  );
}
