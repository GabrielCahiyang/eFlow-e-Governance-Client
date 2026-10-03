import * as React from "react";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { FormField, SelectInput, TextInput } from "../../../../components/ui/FormField";
import type { Organization, UserProfile } from "../../../../types";
import { filterLeadershipCandidates, getLeadershipCandidates } from "../../selectors";

function candidateLabel(candidate: UserProfile, organizations: Organization[]) {
  const organizationName = candidate.org_name ||
    organizations.find((organization) => organization.id === candidate.org_id)?.name;
  return organizationName
    ? `${candidate.full_name} — ${organizationName}`
    : `${candidate.full_name} — Unassigned`;
}

function keepSelectedCandidate(
  candidates: UserProfile[],
  allCandidates: UserProfile[],
  selectedId: string,
) {
  if (!selectedId || candidates.some((candidate) => candidate.id === selectedId)) {
    return candidates;
  }

  const selectedCandidate = allCandidates.find((candidate) => candidate.id === selectedId);
  return selectedCandidate ? [selectedCandidate, ...candidates] : candidates;
}

export function LeadershipAssignmentFields({
  isOpen,
  orgId,
  organizations,
  profiles,
  headUserId,
  assistantHeadUserId,
  onHeadChange,
  onAssistantHeadChange,
  assistantHeadError,
  boardMode = false,
}: {
  isOpen: boolean;
  orgId?: string;
  organizations: Organization[];
  profiles: UserProfile[];
  headUserId: string;
  assistantHeadUserId: string;
  onHeadChange: (userId: string) => void;
  onAssistantHeadChange: (userId: string) => void;
  assistantHeadError?: string;
  boardMode?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const leadershipCandidates = React.useMemo(
    () => getLeadershipCandidates(profiles, organizations, orgId, boardMode),
    [boardMode, orgId, organizations, profiles],
  );
  const matchingCandidates = React.useMemo(
    () => filterLeadershipCandidates(leadershipCandidates, query, organizations),
    [leadershipCandidates, organizations, query],
  );

  React.useEffect(() => {
    setQuery("");
  }, [isOpen, orgId]);

  const optionsFor = React.useCallback(
    (selectedId: string, excludedId: string, emptyLabel: string) => {
      const candidates = keepSelectedCandidate(
        matchingCandidates,
        leadershipCandidates,
        selectedId,
      ).filter((candidate) => candidate.id !== excludedId);

      return [
        { value: "", label: emptyLabel },
        ...candidates.map((candidate) => ({
          value: candidate.id,
          label: candidateLabel(candidate, organizations),
        })),
      ];
    },
    [leadershipCandidates, matchingCandidates, organizations],
  );

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
          <ShieldCheck size={16} aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-[13px] font-semibold text-neutral-900">
            Leadership team
          </h4>
          <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">
            {boardMode
              ? "Assign secondary Board leadership without moving anyone from their home office."
              : "Only active people assigned directly to this organization can be selected. Assign a person to this office first if they are not listed."}
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="leadership-candidate-search"
          className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#676879]"
        >
          Find an eligible user
        </label>
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <TextInput
            id="leadership-candidate-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="bg-white pl-9"
            placeholder={boardMode ? "Name, email, member ID, role, or office" : "Name, email, member ID, or role"}
          />
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
          <UserRound size={13} aria-hidden="true" />
          {matchingCandidates.length} matching {matchingCandidates.length === 1 ? "user" : "users"}{!boardMode ? " in this organization" : ""}
        </p>
      </div>

      {query.trim() && matchingCandidates.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-3 py-2 text-[11px] text-neutral-500">
          No eligible users match that search. Try a name, email, office, or member ID.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={boardMode ? "Primary reviewer" : "Head"}>
          <SelectInput
            value={headUserId}
            onChange={(event) => onHeadChange(event.target.value)}
            options={optionsFor(headUserId, assistantHeadUserId, boardMode ? "No primary reviewer assigned" : "No Head assigned")}
          />
        </FormField>
        {boardMode && <FormField label="Backup reviewer" error={assistantHeadError}>
          <SelectInput
            value={assistantHeadUserId}
            onChange={(event) => onAssistantHeadChange(event.target.value)}
            options={optionsFor(assistantHeadUserId, headUserId, "No backup reviewer assigned")}
          />
        </FormField>}
      </div>
    </section>
  );
}
