import { RotateCcw } from "lucide-react";
import type { UserRole } from "../../../../types";
import {
  DEFAULT_USER_DIRECTORY_FILTERS,
  hasUserDirectoryFilters,
  type UserDirectoryFilters,
  type UserDirectorySort,
  type UserDirectoryStatus,
} from "../../selectors/userDirectory";
import { ROLE_OPTIONS } from "./userManagementPrimitives";

const selectClass = "h-9 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[10.5px] text-neutral-700 outline-none transition hover:bg-white focus:border-neutral-400";

export function UserDirectoryFiltersBar({
  value,
  organizations,
  onChange,
}: {
  value: UserDirectoryFilters;
  organizations: { value: string; label: string }[];
  onChange: (next: UserDirectoryFilters) => void;
}) {
  const update = <K extends keyof UserDirectoryFilters>(key: K, nextValue: UserDirectoryFilters[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="user-directory-filters">
      <select aria-label="Filter users by organization" value={value.organizationId} onChange={(event) => update("organizationId", event.target.value)} className={`${selectClass} max-w-[200px]`}>
        <option value="all">All organizations</option>
        {organizations.map((organization) => <option key={organization.value} value={organization.value}>{organization.label}</option>)}
      </select>
      <select aria-label="Filter users by role" value={value.role} onChange={(event) => update("role", event.target.value as UserRole | "all")} className={selectClass}>
        <option value="all">All roles</option>
        {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
      </select>
      <select aria-label="Filter users by status" value={value.status} onChange={(event) => update("status", event.target.value as UserDirectoryStatus)} className={selectClass}>
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select aria-label="Sort users" value={value.sort} onChange={(event) => update("sort", event.target.value as UserDirectorySort)} className={`${selectClass} min-w-[165px]`}>
        <option value="name-asc">Name · A–Z</option>
        <option value="name-desc">Name · Z–A</option>
        <option value="organization-asc">Office · A–Z</option>
        <option value="organization-desc">Office · Z–A</option>
        <option value="workload-desc">Highest workload</option>
      </select>
      {hasUserDirectoryFilters(value) && (
        <button type="button" onClick={() => onChange(DEFAULT_USER_DIRECTORY_FILTERS)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[10px] font-medium text-neutral-600 transition hover:bg-neutral-50" title="Reset directory filters">
          <RotateCcw size={12} /> Reset
        </button>
      )}
    </div>
  );
}
