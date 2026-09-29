import { Compass, Play, Volume2, VolumeX, X } from "lucide-react";
import { createPortal } from "react-dom";
import { isTourNarrationSupported } from "../services/tourNarrationService";

export function WelcomeTourPrompt({
  roleLabel,
  voiceEnabled,
  onToggleVoice,
  onStart,
  onLater,
  nextSteps = [],
  onNextStep,
}: {
  roleLabel: string;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onStart: () => void;
  onLater: () => void;
  nextSteps?: { id: string; label: string; page: string; description: string }[];
  onNextStep?: (section: string, page: string) => void;
}) {
  const voiceSupported = isTourNarrationSupported();
  return createPortal(
    <div className="fixed inset-0 z-[290] flex animate-in items-center justify-center bg-slate-950/65 p-4 font-normal fade-in duration-300 motion-reduce:animate-none" role="dialog" aria-modal="true" aria-labelledby="welcome-tour-title">
      <section className="w-full max-w-lg animate-in overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl fade-in slide-in-from-bottom-3 zoom-in-95 duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none">
        <div className="bg-gradient-to-br from-neutral-950 via-slate-900 to-violet-950 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 animate-in items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 zoom-in-75 duration-700 motion-reduce:animate-none"><Compass size={24} /></div>
            <button type="button" onClick={onLater} aria-label="Close welcome" className="rounded-lg p-1.5 text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95 motion-reduce:transform-none"><X size={18} /></button>
          </div>
          <h2 id="welcome-tour-title" className="mt-5 text-[22px] font-semibold">Welcome to your eFlow workspace</h2>
          <p className="mt-2 text-[13.5px] leading-6 text-white/75">A short guided tour will introduce the tools available to your {roleLabel} account. The tour is instructional only and cannot change official records.</p>
        </div>
        <div className="p-5">
          {nextSteps.length > 0 && <div className="mb-4"><h3 className="text-sm font-semibold">Suggested first steps</h3><div className="mt-2 grid gap-2">{nextSteps.map((step) => <button key={step.id} type="button" onClick={() => onNextStep?.(step.id, step.page)} className="rounded-xl border border-neutral-200 p-3 text-left hover:bg-neutral-50"><span className="text-xs font-semibold">{step.label}</span><span className="mt-1 block text-xs text-neutral-500">{step.description}</span></button>)}</div></div>}
          <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-[12.5px] leading-5 text-violet-800">The screen will darken while each control is highlighted. Use Back, Next, Skip, or the keyboard at any time.</div>
          <button
            type="button"
            role="switch"
            aria-checked={voiceEnabled}
            onClick={onToggleVoice}
            disabled={!voiceSupported}
            className={`mt-3 flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none ${voiceEnabled ? "border-violet-200 bg-violet-50/70" : "border-neutral-200 bg-white"}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all duration-300 ${voiceEnabled ? "bg-violet-600 text-white shadow-md shadow-violet-200" : "bg-neutral-100 text-neutral-500"}`}>
              {voiceEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-neutral-900">AI voice guide</span>
              <span className="mt-0.5 block text-[11.5px] leading-5 text-neutral-500">{voiceSupported ? "Reads every walkthrough step aloud in English." : "Voice narration is unavailable in this browser."}</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${voiceEnabled ? "bg-violet-600" : "bg-neutral-200"}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${voiceEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </span>
          </button>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onLater} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-[12.5px] text-neutral-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-50 active:translate-y-0 motion-reduce:transform-none">Maybe later</button>
            <button type="button" onClick={onStart} className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-[12.5px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-lg active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none"><Play size={14} /> Start guided tour</button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
