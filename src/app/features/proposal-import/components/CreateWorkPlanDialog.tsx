import { useState } from "react";
import * as Icons from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { ManualPlanBuilder } from "./ManualPlanBuilder";
import ProposalImport from "./ProposalImport";

export type WorkPlanCreationMode = "manual" | "import";

interface CreateWorkPlanDialogProps {
  open: boolean;
  mode: WorkPlanCreationMode;
  onModeChange: (mode: WorkPlanCreationMode) => void;
  onClose: () => void;
}

export function CreateWorkPlanDialog({
  open,
  mode,
  onModeChange,
  onClose,
}: CreateWorkPlanDialogProps) {
  const isManual = mode === "manual";
  const [processing, setProcessing] = useState(false);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={processing}
      title="Create a work plan"
      width="max-w-5xl"
      overlayClassName="eflow-wide-work-plan-modal"
      className="overflow-hidden"
      bodyClassName="!p-0 !overflow-hidden flex min-h-0 flex-col flex-1"
    >
      {/* Main Container */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 bg-neutral-50/50 xl:grid-cols-[minmax(0,1fr)_220px]">
        {/* Left Column: Form & Tabs */}
        <div className="min-h-0 min-w-0 space-y-5 overflow-y-auto p-3 sm:p-7 lg:p-8">
          <div className="flex items-center gap-3 border-b border-neutral-200 pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              {isManual ? (
                <Icons.FileEdit size={20} />
              ) : (
                <Icons.FileUp size={20} />
              )}
            </div>
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary">
                Planning workspace
              </span>
              <p className="text-sm font-semibold text-neutral-900">
                {isManual ? "Build from scratch" : "Import a proposal"}
              </p>
            </div>
          </div>
          {/* Segmented Pill Tabs */}
          <div className="inline-flex items-center gap-1.5 p-1.5 bg-neutral-200/60 rounded-xl border border-neutral-200/80">
            <button
              type="button"
              disabled={processing}
              onClick={() => onModeChange("manual")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isManual
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-white/50"
              }`}
            >
              <Icons.FilePlus
                size={15}
                className={isManual ? "text-primary" : "text-neutral-400"}
              />
              <span>New work plan</span>
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={() => onModeChange("import")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                !isManual
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-white/50"
              }`}
            >
              <Icons.FileText
                size={15}
                className={!isManual ? "text-primary" : "text-neutral-400"}
              />
              <span>Import proposal</span>
            </button>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed max-w-xl">
            {isManual
              ? "Build a structured plan in eFlow. Your draft autosaves and becomes operational only after approval and publication."
              : "Bring a government proposal into eFlow. We will prepare an editable draft for your review before anything becomes operational."}
          </p>

          {/* Form Content */}
          <div className="min-w-0 pt-2">
            <div hidden={!isManual}>
              <ManualPlanBuilder inDialog embedded onClose={onClose} />
            </div>
            <div hidden={isManual}>
              <ProposalImport inDialog embedded onClose={onClose} onProcessingChange={setProcessing} />
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual Card */}
        <div className="hidden min-h-0 flex-col justify-between overflow-y-auto border-l border-primary/10 bg-gradient-to-br from-primary/10 via-primary/5 to-info/5 p-5 xl:flex">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-sans">
                {isManual ? "Build with structure" : "AI-Assisted Proposal"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-primary/15 text-[10.5px] font-semibold text-primary shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Draft
              </span>
            </div>

            {/* Visual Board Mockup */}
            <div className="relative py-4 flex items-center justify-center">
              <div className="w-44 bg-white/90 backdrop-blur-sm border border-primary/15 rounded-2xl p-4 shadow-lg shadow-primary/10 space-y-2.5 transform -rotate-1 hover:rotate-0 transition-transform">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="h-2 w-3/4 bg-primary/25 rounded-full" />
                <div className="h-2 w-full bg-neutral-100 rounded-full" />
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="h-6 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                    P
                  </div>
                  <div className="h-6 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                    A
                  </div>
                  <div className="h-6 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                    T
                  </div>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div className="space-y-2">
              <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                {isManual
                  ? "From idea to delivery"
                  : "A safer path from PDF to plan"}
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {isManual
                  ? "Keep programs, projects, activities, and tasks connected from the first draft."
                  : "Review the editable decomposition, scope, and assignments before requesting approval."}
              </p>
            </div>

            {/* Step list */}
            <ol className="space-y-2.5 pt-2">
              {(isManual
                ? [
                    "Set the plan scope",
                    "Organize projects and tasks",
                    "Review and publish",
                  ]
                : [
                    "Upload the proposal",
                    "Review the AI draft",
                    "Request approval",
                  ]
              ).map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-3 text-xs font-semibold text-neutral-700"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white border border-primary/20 text-primary text-[10px] font-bold shadow-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="pt-6 border-t border-primary/15 mt-6">
            <div className="flex items-start gap-2 text-[11px] text-neutral-600 leading-snug">
              <Icons.CheckCircle2
                size={15}
                className="text-primary shrink-0 mt-0.5"
              />
              <span>
                Drafts autosave · no operational work is created before approval
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
