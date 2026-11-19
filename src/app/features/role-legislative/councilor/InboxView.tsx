import * as Carbon from "@carbon/icons-react";
import * as Lucide from "lucide-react";
import { formatManilaWeekdayDate } from "../../../shared/calendarDisplay";
import type { TaskCard } from "./councilorData";
import { mockCouncilor, priorityConfig } from "./councilorData";

export function InboxView({
  tasks,
  onTaskTap,
}: {
  tasks: TaskCard[];
  onTaskTap: (task: TaskCard) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full">
            <Lucide.Tablet size={14} className="text-indigo-500" />
            <span className="text-[11px] font-normal text-indigo-600">
              iPad Tablet Mode — Councilor View Only
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-normal text-neutral-400">
            <Carbon.Time size={12} />
            {formatManilaWeekdayDate(new Date())}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-[24px] font-normal text-neutral-900">
            {mockCouncilor.name}'s Desk
          </h1>
          <p className="text-[13px] font-normal text-neutral-500 mt-0.5">
            {mockCouncilor.title}
          </p>
        </div>

        {/* Pending Badge */}
        {tasks.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl mb-5 w-fit">
            <div className="size-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[13px] font-normal text-orange-700">
              {tasks.length} Pending Action{tasks.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Inbox Zero */}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
              <Lucide.CheckCircle size={40} className="text-emerald-400" />
            </div>
            <p className="text-[18px] font-normal text-neutral-700">
              Inbox Zero
            </p>
            <p className="text-[14px] font-normal text-neutral-400 mt-1">
              All actions completed. You're up to date.
            </p>
          </div>
        )}

        {/* Task Cards */}
        <div className="flex flex-col gap-3">
          {tasks.map((task) => {
            const config = priorityConfig[task.priority];
            return (
              <button
                key={task.id}
                onClick={() => onTaskTap(task)}
                className={`w-full text-left p-5 rounded-2xl border ${config.border} ${config.bg} cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.005] active:scale-[0.998] group`}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-1 size-3 rounded-full ${config.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[11px] font-normal ${config.text} px-2 py-0.5 rounded-full bg-white/60`}>
                        {task.type}
                      </span>
                      {task.timeInfo && (
                        <span className="text-[11px] font-normal text-red-600 flex items-center gap-1">
                          <Lucide.Clock size={10} />
                          {task.timeInfo}
                        </span>
                      )}
                    </div>
                    <p className="text-[15px] font-normal text-neutral-900">
                      {task.title}
                    </p>
                    <p className="text-[12px] font-normal text-neutral-500 mt-1">
                      {task.subtitle}
                    </p>
                  </div>
                  <Carbon.ChevronRight size={18} className="text-neutral-300 group-hover:text-neutral-500 mt-3 shrink-0 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== FOCUS READER ====================
