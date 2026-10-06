import { useExplicitDraft } from "../../../../shared/useExplicitDraft";
import * as React from "react";
import { Plus, Save, Trash2, Users } from "lucide-react";
import type { Organization, UserProfile } from "../../../../types";
import type {
  CollaborationOrganizationSelection,
  CollaborationParticipant,
  GovernanceAssignment,
  GovernanceAssignmentRole,
} from "../../types";

const ROLE_OPTIONS: Array<{ value: GovernanceAssignmentRole; label: string }> =
  [
    { value: "primary_approver", label: "Primary approver" },
    { value: "backup_approver", label: "Backup approver" },
    { value: "liaison", label: "Proposal liaison" },
    { value: "technical_reviewer", label: "Technical reviewer" },
    { value: "observer", label: "Observer" },
  ];

export function GovernanceRosterPanel({
  participants,
  assignments,
  organizations,
  profiles,
  editable,
  busy,
  onSave,
  savedReceipt = 0,
}: {
  participants: CollaborationParticipant[];
  assignments: GovernanceAssignment[];
  organizations: Organization[];
  profiles: UserProfile[];
  editable: boolean;
  busy: boolean;
  savedReceipt?: number;
  onSave: (
    organizations: CollaborationOrganizationSelection[],
    assignments: Array<{
      organizationId: string;
      userId: string;
      role: GovernanceAssignmentRole;
    }>,
  ) => Promise<void>;
}) {
  const [orgs, setOrgs] = React.useState<CollaborationOrganizationSelection[]>(
    [],
  );
  const [people, setPeople] = React.useState<
    Array<{
      organizationId: string;
      userId: string;
      role: GovernanceAssignmentRole;
    }>
  >([]);
  const [newOrgId, setNewOrgId] = React.useState("");
  const [newUserId, setNewUserId] = React.useState("");
  const [newRole, setNewRole] =
    React.useState<GovernanceAssignmentRole>("technical_reviewer");
  const canonical = React.useMemo(
    () => ({
      orgs: participants.map((item) => ({
        orgId: item.orgId,
        participationRole: item.participationRole,
        staffingEnabled: item.staffingEnabled,
        approvalPolicy: item.approvalPolicy,
        quorumCount: item.quorumCount,
        sequence: item.sequence,
        reviewDeadlineDays: item.reviewDeadlineDays,
      })),
      people: assignments
        .filter((item) => item.role !== "delegate")
        .map((item) => ({
          organizationId: item.organizationId,
          userId: item.userId,
          role: item.role,
        })),
    }),
    [participants, assignments],
  );
  const [baseline, setBaseline] = React.useState(JSON.stringify(canonical));
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify({ orgs, people }) !== baseline;
  const latestCanonical = React.useRef(canonical);
  latestCanonical.current = canonical;
  const guard = useExplicitDraft(
    "Governance roster",
    editable && dirty,
    busy || saving,
    () => {
      setOrgs(latestCanonical.current.orgs);
      setPeople(latestCanonical.current.people);
      setBaseline(JSON.stringify(latestCanonical.current));
      setNewUserId("");
      setError("");
    },
  );
  const previousReceipt = React.useRef(savedReceipt);
  React.useEffect(() => {
    if (previousReceipt.current !== savedReceipt) {
      previousReceipt.current = savedReceipt;
      setBaseline(JSON.stringify({ orgs, people }));
      guard.markClean();
    }
  }, [savedReceipt]);
  const initialized = React.useRef(false);
  React.useEffect(() => {
    if (!initialized.current || !dirty) {
      initialized.current = true;
      setOrgs(canonical.orgs);
      setPeople(canonical.people);
      setBaseline(JSON.stringify(canonical));
    }
  }, [canonical]);
  const save = async () => {
    if (guard.pendingRef.current || busy) return;
    if (JSON.stringify(latestCanonical.current) !== baseline) {
      setError(
        "The governance roster changed. Your draft is retained. Discard it to load current assignments before saving.",
      );
      return;
    }
    guard.pendingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave(orgs, people);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Governance could not be saved.",
      );
    } finally {
      guard.pendingRef.current = false;
      setSaving(false);
    }
  };
  const selectedOrg =
    newOrgId ||
    participants.find((item) => item.participationRole !== "owner")?.orgId ||
    "";
  const candidates = profiles.filter(
    (profile) => profile.is_active && profile.org_id === selectedOrg,
  );
  const addPerson = () => {
    if (
      !selectedOrg ||
      !newUserId ||
      people.some(
        (item) =>
          item.organizationId === selectedOrg &&
          item.userId === newUserId &&
          item.role === newRole,
      )
    )
      return;
    setPeople((current) => [
      ...current,
      { organizationId: selectedOrg, userId: newUserId, role: newRole },
    ]);
    setNewUserId("");
  };
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
            <Users size={15} /> Governance roster
          </div>
          <p className="mt-1 text-[10px] text-neutral-500">
            Name accountable decision makers, backups, liaisons, technical
            reviewers, and observers. Organization authority remains the legal
            approval boundary.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            disabled={busy || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[10px] text-white disabled:opacity-40"
          >
            <Save size={12} /> Save governance
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {orgs.map((participant) => {
          const org = organizations.find(
            (item) => item.id === participant.orgId,
          );
          const required =
            participant.participationRole === "participant" ||
            participant.participationRole === "governance";
          const assigned = people.filter(
            (item) => item.organizationId === participant.orgId,
          );
          return (
            <article
              key={participant.orgId}
              className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-medium text-neutral-900">
                    {org?.name || "Organization"}
                  </div>
                  <div className="mt-0.5 text-[9px] capitalize text-neutral-400">
                    {participant.participationRole.replace("_", " ")} ·{" "}
                    {required ? "Approval required" : "Advisory visibility"}
                  </div>
                </div>
                {required && editable && (
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={participant.approvalPolicy || "one_of"}
                      onChange={(event) =>
                        setOrgs((current) =>
                          current.map((item) =>
                            item.orgId === participant.orgId
                              ? {
                                  ...item,
                                  approvalPolicy: event.target
                                    .value as CollaborationOrganizationSelection["approvalPolicy"],
                                }
                              : item,
                          ),
                        )
                      }
                      className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-[9px]"
                    >
                      <option value="one_of">One authorized signer</option>
                      <option value="all">All primary signers</option>
                      <option value="quorum">Quorum</option>
                    </select>
                    {participant.approvalPolicy === "quorum" && (
                      <input
                        type="number"
                        min={1}
                        value={participant.quorumCount || 1}
                        onChange={(event) =>
                          setOrgs((current) =>
                            current.map((item) =>
                              item.orgId === participant.orgId
                                ? {
                                    ...item,
                                    quorumCount: Math.max(
                                      1,
                                      Number(event.target.value),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-8 w-16 rounded-lg border border-neutral-200 bg-white px-2 text-[9px]"
                        title="Required signatures"
                      />
                    )}
                    <label className="flex items-center gap-1 text-[9px] text-neutral-500">
                      Stage
                      <input
                        type="number"
                        min={1}
                        value={participant.sequence || 1}
                        onChange={(event) =>
                          setOrgs((current) =>
                            current.map((item) =>
                              item.orgId === participant.orgId
                                ? {
                                    ...item,
                                    sequence: Math.max(
                                      1,
                                      Number(event.target.value),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-8 w-14 rounded-lg border border-neutral-200 bg-white px-2"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[9px] text-neutral-500">
                      Due
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={participant.reviewDeadlineDays || 5}
                        onChange={(event) =>
                          setOrgs((current) =>
                            current.map((item) =>
                              item.orgId === participant.orgId
                                ? {
                                    ...item,
                                    reviewDeadlineDays: Math.max(
                                      1,
                                      Number(event.target.value),
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-8 w-14 rounded-lg border border-neutral-200 bg-white px-2"
                      />
                      days
                    </label>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {assigned.length ? (
                  assigned.map((assignment, index) => {
                    const profile = profiles.find(
                      (item) => item.id === assignment.userId,
                    );
                    return (
                      <span
                        key={`${assignment.userId}-${assignment.role}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[9px] text-neutral-700"
                      >
                        <b>{profile?.full_name || "User"}</b> ·{" "}
                        {
                          ROLE_OPTIONS.find(
                            (item) => item.value === assignment.role,
                          )?.label
                        }
                        {editable && (
                          <button
                            type="button"
                            onClick={() =>
                              setPeople((current) =>
                                current.filter(
                                  (_, currentIndex) =>
                                    currentIndex !== people.indexOf(assignment),
                                ),
                              )
                            }
                            className="text-neutral-400 hover:text-red-600"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[9px] text-neutral-400">
                    Using organization Head/Member defaults until named people
                    are assigned.
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {editable && (
        <div className="mt-4 grid gap-2 rounded-xl border border-dashed border-neutral-300 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <select
            value={selectedOrg}
            onChange={(event) => {
              setNewOrgId(event.target.value);
              setNewUserId("");
            }}
            className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-[10px]"
          >
            <option value="">Organization</option>
            {participants.map((item) => (
              <option key={item.orgId} value={item.orgId}>
                {organizations.find((org) => org.id === item.orgId)?.name}
              </option>
            ))}
          </select>
          <select
            value={newUserId}
            onChange={(event) => setNewUserId(event.target.value)}
            className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-[10px]"
          >
            <option value="">Select active person…</option>
            {candidates.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name}
              </option>
            ))}
          </select>
          <select
            value={newRole}
            onChange={(event) =>
              setNewRole(event.target.value as GovernanceAssignmentRole)
            }
            className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-[10px]"
          >
            {ROLE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!newUserId}
            onClick={addPerson}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-primary px-3 text-[10px] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      )}
    </section>
  );
}
