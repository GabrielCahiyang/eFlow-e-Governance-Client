import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crown, Search, X } from "lucide-react";
import type { Employee } from "../../../services/employeeService";
import type { DeadlineWorkload } from "../../tasks";
import type { EmployeeNotesMap } from "../../../services/employeeNotesService";
import {
  normalizeDraftAssignment,
  selectDraftAssignmentLead,
  toggleDraftAssignmentMember,
} from "../services/draftAssignment";
import { getInitials } from "./draftModel";

export function AssignmentModal({
  open,
  onClose,
  employees,
  employeeNotes,
  selectedIds,
  leadId,
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  employees: Array<Employee & { deadlineWorkload?: DeadlineWorkload }>;
  employeeNotes?: EmployeeNotesMap;
  selectedIds: string[];
  leadId: string | null;
  onConfirm: (memberIds: string[], leadId: string | null) => void;
  loading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [draftAssignment, setDraftAssignment] = useState(() =>
    normalizeDraftAssignment(selectedIds, leadId),
  );
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraftAssignment(normalizeDraftAssignment(selectedIds, leadId));
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matches = !q ? employees : employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.jobTitle || "").toLowerCase().includes(q) ||
        (e.departmentName || "").toLowerCase().includes(q),
    );
    return [...matches].sort((left, right) =>
      (left.departmentName || left.department || "").localeCompare(right.departmentName || right.department || "")
      || left.name.localeCompare(right.name));
  }, [employees, search]);

  const toggle = (id: string) => {
    setDraftAssignment((current) =>
      toggleDraftAssignmentMember(current, id),
    );
  };

  const draft = draftAssignment.memberIds;
  const draftLead = draftAssignment.leadId;
  const selectedLeader = employees.find((employee) => employee.id === draftLead);

  const confirmAssignment = () => {
    onConfirm([...draft], draftLead);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      style={{ zIndex: 11000 }}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Select Team and Leader"
        data-testid="team-assignment-dialog"
        aria-modal="true"
        className="flex max-h-[min(82dvh,780px)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "modalIn 0.18s ease" }}
      >
        <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-400 font-medium">
              Team Assignment
            </div>
            <div className="text-[16px] font-semibold text-neutral-900 mt-0.5">
              Select Team &amp; Leader
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">
              Eligible members are grouped by participating organization. Select the crown to choose the proposed Task Leader.
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 border-b border-neutral-100 shrink-0">
          <div className="relative flex items-center bg-neutral-50 border border-neutral-200 rounded-xl h-[38px] focus-within:border-neutral-400 focus-within:bg-white transition">
            <Search size={14} className="text-neutral-400 ml-3 shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role, or department…"
              className="flex-1 bg-transparent px-2 text-[12px] font-normal text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="pr-2.5 text-neutral-400 hover:text-neutral-700"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Selected chips */}
          {draft.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {draft.map((id) => {
                const emp = employees.find((e) => e.id === id);
                if (!emp) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 bg-violet-50 border border-violet-200 text-violet-700 text-[11px] font-medium px-2 py-1 rounded-full"
                  >
                    {draftLead === id && (
                      <Crown size={10} className="text-amber-500" />
                    )}
                    {getInitials(emp.name)} · {emp.name.split(" ")[0]}
                    <button
                      onClick={() => toggle(id)}
                      className="text-violet-400 hover:text-violet-700 ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="text-center text-[12px] text-neutral-400 py-10">
              Loading eligible employees…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-[12px] text-neutral-400 py-10">
              {search ? `No employees match "${search}"` : "No eligible employees are available."}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((emp) => {
                const selected = draft.includes(emp.id);
                const isLead = draftLead === emp.id;
                const notes = employeeNotes?.[emp.id];
                const tags = notes?.tags?.slice(0, 3) || [];
                const load = emp.currentWorkload;
                const index = filtered.indexOf(emp);
                const departmentLabel = emp.departmentName || emp.department || "No organization";
                const previousDepartment = index > 0 ? (filtered[index - 1].departmentName || filtered[index - 1].department || "No organization") : null;
                return (
                  <Fragment key={emp.id}>
                  {departmentLabel !== previousDepartment && (
                    <div className="sticky top-0 z-10 mt-2 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-2 py-2 backdrop-blur">
                      <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-500">{departmentLabel}</span>
                      <span className="text-[8px] uppercase text-violet-500">Participating organization</span>
                    </div>
                  )}
                  <div
                    data-testid="team-assignment-member"
                    data-employee-name={emp.name}
                    onClick={() => toggle(emp.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                      selected
                        ? "bg-violet-50 border-violet-200"
                        : "bg-white border-transparent hover:border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0 ${
                        load >= 80
                          ? "bg-red-500"
                          : load >= 60
                            ? "bg-amber-500"
                            : "bg-neutral-800"
                      }`}
                    >
                      {getInitials(emp.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-neutral-900 truncate">
                          {emp.name}
                        </span>
                        {selected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDraftAssignment((current) =>
                                selectDraftAssignmentLead(current, emp.id),
                              );
                            }}
                            className={`p-1 rounded-lg transition shrink-0 ${
                              isLead
                                ? "text-amber-500 hover:text-neutral-400"
                                : "text-neutral-300 hover:text-amber-500"
                            }`}
                            title={isLead ? "Current team leader" : "Make team leader"}
                          >
                            <Crown size={12} />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">
                        {emp.jobTitle} · {emp.departmentName || emp.department || "No Department"}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right column: workload */}
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-medium text-neutral-800">
                        {emp.deadlineWorkload?.label || `${load}/100 workload score`}
                      </div>
                      <div className="text-[9px] text-neutral-400 mt-0.5">
                        Task days + deadlines
                      </div>
                    </div>
                  </div>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between shrink-0">
          <div className="min-w-0 text-[11px] text-neutral-500">
            <div>{draft.length} member{draft.length !== 1 ? "s" : ""} selected</div>
            {selectedLeader && (
              <div className="mt-0.5 flex items-center gap-1 truncate font-medium text-amber-700">
                <Crown size={10} className="shrink-0" />
                Leader: {selectedLeader.name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12px] font-medium text-neutral-500 hover:text-neutral-700 transition"
            >
              Cancel
            </button>
            <button
              data-testid="team-assignment-confirm"
              onClick={confirmAssignment}
              className="px-4 py-2 bg-neutral-900 text-white text-[12px] font-semibold rounded-xl hover:bg-neutral-800 transition"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
