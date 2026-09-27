import * as React from "react";
import type { Organization, UserProfile } from "../../../../types";
import { ROLE_COLORS, ROLE_LABELS } from "./orgTreeModel";
import { GripVertical, Search, UsersRound } from "lucide-react";

export function UsersPanel({
  profiles,
  orgs,
  search,
  setSearch,
}: {
  profiles: UserProfile[];
  orgs: Organization[];
  search: string;
  setSearch: (v: string) => void;
}) {
  const orgMap = React.useMemo(
    () => Object.fromEntries(orgs.map((o) => [o.id, o.name])),
    [orgs]
  );

  const filtered = React.useMemo(
    () =>
      search
        ? profiles.filter(
            (p) =>
              p.full_name.toLowerCase().includes(search.toLowerCase()) ||
              p.email.toLowerCase().includes(search.toLowerCase()) ||
              p.role.toLowerCase().includes(search.toLowerCase())
          )
        : profiles,
    [profiles, search]
  );

  const unassigned = profiles.filter((p) => !p.org_id).length;
  const assigned = profiles.filter((p) => p.org_id).length;

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-neutral-200 bg-white lg:flex" aria-label="Organization members">
      <div className="p-3 border-b border-neutral-100">
        <div className="mb-2 flex items-center gap-2"><UsersRound size={15} className="text-teal-700" /><div><div className="text-[12px] font-semibold text-neutral-800">People</div><div className="text-[9.5px] text-neutral-400">Drag a person onto an organization</div></div></div>
        <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-3 text-[12px] font-normal placeholder:text-neutral-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        /></div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.map((p) => (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('userId', p.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 cursor-grab active:cursor-grabbing transition-colors border border-transparent hover:border-neutral-200"
          >
            <GripVertical size={12} className="shrink-0 text-neutral-300" />
            <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-semibold text-neutral-600">
                {p.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-neutral-900 truncate">
                {p.full_name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`px-1 py-0.5 rounded-full text-[8px] font-medium ${ROLE_COLORS[p.role] || 'bg-neutral-100 text-neutral-600'}`}
                >
                  {ROLE_LABELS[p.role] || p.role}
                </span>
                {p.org_id ? (
                  <span className="text-[9px] font-normal text-neutral-500 truncate">
                    {orgMap[p.org_id] || '—'}
                  </span>
                ) : (
                  <span className="text-[9px] font-normal text-neutral-400">Unassigned</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-[11px] text-neutral-400 text-center py-8">No users found</div>
        )}
      </div>

      <div className="border-t border-neutral-100 p-3">
        <div className="flex items-center justify-between text-[10px] font-normal text-neutral-500">
          <span>Unassigned: {unassigned}</span>
          <span>Assigned: {assigned}</span>
        </div>
      </div>
    </aside>
  );
}

// ─── Main Org Tree Builder Component ────────────────────────────
