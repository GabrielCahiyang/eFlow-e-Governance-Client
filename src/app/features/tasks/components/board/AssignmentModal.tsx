import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Crown, Search, X } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import type { Employee } from "../../../../services/employeeService";
import type { EmployeeNotesMap } from "../../../../services/employeeNotesService";
import { getInitials } from "./model";
import { TaskBoardDialog } from "./TaskBoardDialog";

export function AssignmentModal({
  open,
  onClose,
  employees,
  employeeNotes,
  selectedIds,
  leadId,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  employeeNotes?: EmployeeNotesMap;
  selectedIds: string[];
  leadId: string | null;
  onConfirm: (memberIds: string[], leadId: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [draftLead, setDraftLead] = useState<string | null>(leadId);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(selectedIds);
      setDraftLead(leadId);
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.jobTitle || "").toLowerCase().includes(q) ||
        (e.departmentName || "").toLowerCase().includes(q),
    );
  }, [employees, search]);

  const toggle = (id: string) => {
    setDraft((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (draftLead && !next.includes(draftLead)) setDraftLead(next[0] || null);
      return next;
    });
  };

  if (!open) return null;

  return (
    <TaskBoardDialog
      eyebrow="Team assignment"
      maxWidthClassName="max-w-[540px]"
      onClose={onClose}
      open={open}
      title="Select team members"
      footer={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {draft.length > 0
              ? `${draft.length} selected${draftLead ? ` · Lead: ${employees.find((e) => e.id === draftLead)?.name?.split(" ")[0] || ""}` : ""}`
              : "No members selected"}
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} variant="outline">Cancel</Button>
            <Button
              onClick={() => {
                onConfirm(draft, draftLead);
                onClose();
              }}
            >
              Confirm assignment
            </Button>
          </div>
        </div>
      )}
    >
      <div className="-mx-5 -mt-5 flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-5 pb-3 pt-4">
          <div className="relative flex h-[38px] items-center rounded-lg border border-input bg-background transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
            <Search size={14} className="ml-3 shrink-0 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role, or department…"
              className="h-[38px] flex-1 border-0 bg-transparent px-2 text-[12px] shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:!border-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!ring-offset-0"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="pr-2.5 text-muted-foreground hover:text-foreground"
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
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground"
                  >
                    {draftLead === id && (
                      <Crown size={10} className="text-amber-500" />
                    )}
                    {getInitials(emp.name)} · {emp.name.split(" ")[0]}
                    <button
                      onClick={() => toggle(id)}
                      className="ml-0.5 text-muted-foreground hover:text-accent-foreground"
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
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <div className="text-center text-[12px] text-neutral-400 py-10">
              No employees match "{search}"
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((emp) => {
                const selected = draft.includes(emp.id);
                const isLead = draftLead === emp.id;
                const notes = employeeNotes?.[emp.id];
                const tags = notes?.tags?.slice(0, 3) || [];
                const load = emp.currentWorkload;
                return (
                  <div
                    key={emp.id}
                    onClick={() => toggle(emp.id)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                      selected
                        ? "border border-primary/30 bg-accent"
                        : "border border-transparent bg-card hover:border-border hover:bg-muted"
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

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[12px] font-medium text-foreground">
                          {emp.name}
                        </span>
                        {isLead && (
                          <Crown
                            size={11}
                            className="text-amber-500 shrink-0"
                          />
                        )}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {emp.jobTitle}
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Workload */}
                    <div className="shrink-0 text-right">
                      <div
                        className={`text-[11px] font-semibold ${load >= 80 ? "text-red-600" : load >= 60 ? "text-amber-600" : "text-emerald-600"}`}
                      >
                        {load}%
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        workload
                      </div>
                    </div>

                    {/* Lead toggle */}
                    {selected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftLead(isLead ? null : emp.id);
                        }}
                        className={`shrink-0 p-1.5 rounded-lg transition ${
                          isLead
                            ? "bg-amber-100 text-amber-600"
                            : "text-muted-foreground hover:bg-amber-50 hover:text-amber-500"
                        }`}
                        title="Set as Team Lead"
                      >
                        <Crown size={13} />
                      </button>
                    )}

                    {/* Checkbox */}
                    <div
                      className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                        selected
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {selected && (
                        <Check
                          size={11}
                          className="text-white"
                          strokeWidth={2.5}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </TaskBoardDialog>
  );
}

// ─── Task Chat Section ──────────────────────────────────────────────
