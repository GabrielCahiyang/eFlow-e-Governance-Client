import { useState } from "react";
import { CheckCircle2, ChevronRight, Crown, Shield, UserCheck, X } from "lucide-react";
import { Btn, PageHeader, Stat } from "./primitives";
import { ROSTER, type RosterMember } from "./TeamAssignments";

type LeaderRole = {
  id: string;
  title: string;
  responsibilities: string[];
  permissions: string[];
  assignee?: RosterMember;
};

const LEADER_ROLES: LeaderRole[] = [
  {
    id: "l1",
    title: "Site Supervisor",
    responsibilities: [
      "Approve daily photos",
      "Logbook approval",
      "Safety incident triage",
    ],
    permissions: [
      "mobile.approve_photos",
      "mobile.logbook_write",
      "mobile.incident_create",
    ],
  },
  {
    id: "l2",
    title: "QA/QC Officer",
    responsibilities: ["Material testing approval", "Inspection checklists"],
    permissions: ["mobile.qc_forms", "mobile.test_results"],
  },
  {
    id: "l3",
    title: "Safety Officer",
    responsibilities: ["Toolbox talks", "PPE audits"],
    permissions: ["mobile.safety_log", "mobile.ppe_audit"],
  },
  {
    id: "l4",
    title: "Procurement Liaison",
    responsibilities: ["Material requests", "Vendor coordination"],
    permissions: ["mobile.mr_create"],
  },
];

export function LeaderAssignments() {
  const [assignments, setAssignments] = useState<LeaderRole[]>(LEADER_ROLES);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const available = ROSTER.filter(
    (r) => !assignments.find((a) => a.assignee?.id === r.id),
  );

  const assign = (roleId: string, emp: RosterMember) => {
    setAssignments(
      assignments.map((a) => (a.id === roleId ? { ...a, assignee: emp } : a)),
    );
    setPickerOpen(null);
  };
  const unassign = (roleId: string) => {
    setAssignments(
      assignments.map((a) =>
        a.id === roleId ? { ...a, assignee: undefined } : a,
      ),
    );
  };

  return (
    <div className="p-8 min-h-full">
      <PageHeader
        title="Leader Assignments · Project Managers"
        subtitle="Tagging upgrades mobile app permissions · Eco-Park Task Force"
        actions={
          <>
            <Btn icon={<Shield size={13} />} label="Permission Matrix" />
            <Btn
              icon={<CheckCircle2 size={13} />}
              label="Publish Roles"
              variant="primary"
            />
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <Stat
          label="Leadership Slots"
          value={LEADER_ROLES.length.toString()}
          trend="Required roles"
          tone="neutral"
        />
        <Stat
          label="Filled"
          value={assignments.filter((a) => a.assignee).length.toString()}
          trend={`${LEADER_ROLES.length - assignments.filter((a) => a.assignee).length} remaining`}
          tone={assignments.every((a) => a.assignee) ? "good" : "warn"}
        />
        <Stat
          label="Permissions Elevated"
          value={assignments
            .filter((a) => a.assignee)
            .reduce((s, a) => s + a.permissions.length, 0)
            .toString()}
          trend="Mobile app scopes"
          tone="neutral"
        />
        <Stat
          label="Approval Depth"
          value="3 layers"
          trend="Laborer → Supervisor → Head"
          tone="good"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {assignments.map((role) => (
          <div
            key={role.id}
            className="bg-white border border-neutral-200 rounded-xl p-5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const emp = ROSTER.find((r) => r.id === dragId);
              if (emp) assign(role.id, emp);
              setDragId(null);
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={14} className="text-amber-600" />
                  <div className="text-[14px] font-semibold text-neutral-900">
                    {role.title}
                  </div>
                </div>
                <div className="text-[10.5px] font-normal text-neutral-500 mt-0.5">
                  {role.responsibilities.join(" · ")}
                </div>
              </div>
              <span
                className={`text-[9.5px] font-medium uppercase border rounded px-1.5 py-0.5 ${role.assignee ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-neutral-500 bg-neutral-50 border-neutral-200"}`}
              >
                {role.assignee ? "Assigned" : "Vacant"}
              </span>
            </div>

            {role.assignee ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-200 to-emerald-400 flex items-center justify-center text-[11px] font-semibold text-emerald-900">
                    {role.assignee.name
                      .split(" ")
                      .slice(-2)
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="flex-1">
                    <div className="text-[12.5px] font-medium text-neutral-900">
                      {role.assignee.name}
                    </div>
                    <div className="text-[10.5px] font-normal text-neutral-600">
                      {role.assignee.role}
                    </div>
                  </div>
                  <button
                    onClick={() => unassign(role.id)}
                    className="text-neutral-400 hover:text-red-600 p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <div className="text-[9.5px] font-medium uppercase tracking-wider text-emerald-700 mb-1.5">
                    Permissions Elevated
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <span
                        key={p}
                        className="text-[9.5px] font-mono bg-white border border-emerald-200 text-emerald-800 rounded px-1.5 py-0.5"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() =>
                  setPickerOpen(pickerOpen === role.id ? null : role.id)
                }
                className="w-full border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-lg p-6 text-center text-[12px] font-medium text-neutral-500 hover:text-neutral-700"
              >
                <UserCheck size={20} className="mx-auto mb-1.5 opacity-50" />
                Drop member here · or tap to pick
              </button>
            )}

            {pickerOpen === role.id && (
              <div className="mt-2 bg-neutral-50 border border-neutral-200 rounded-lg p-2 space-y-1 max-h-[200px] overflow-y-auto">
                {available.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => assign(role.id, e)}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-white text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] font-semibold text-neutral-700">
                      {e.name
                        .split(" ")
                        .slice(-2)
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11.5px] font-medium text-neutral-900 truncate">
                        {e.name}
                      </div>
                      <div className="text-[10px] font-normal text-neutral-500 truncate">
                        {e.role}
                      </div>
                    </div>
                    <ChevronRight size={12} className="text-neutral-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Shield size={14} className="text-amber-700 mt-0.5 shrink-0" />
        <div className="text-[11.5px] font-normal text-amber-900 leading-relaxed">
          <span className="font-medium">
            Automatic permission elevation.
          </span>{" "}
          Tagging someone as Site Supervisor instantly activates{" "}
          <span className="font-mono">mobile.approve_photos</span> on their
          device. Laborers' daily photos will now route through them first — the
          Dept. Head no longer has to triage 200 timesheet images.
        </div>
      </div>
    </div>
  );
}

// ==================== 15.2.C — CHAIN OF COMMAND ====================
