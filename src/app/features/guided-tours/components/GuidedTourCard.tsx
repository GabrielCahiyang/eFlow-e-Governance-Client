import { ArrowLeft, ArrowRight, AudioLines, Check, Volume2, VolumeX, X } from "lucide-react";
import type { CSSProperties, ReactNode, Ref } from "react";
import type { GuidedTourStep } from "../types";

/** The same walkthrough card can be placed over the app or inside a bounded preview. */
export function GuidedTourCard({
  step, index, total, className = "fixed", style, arrow = "none", voice,
  nextButtonRef, onBack, onNext, onSkip, footer,
}: {
  step: Pick<GuidedTourStep, "id" | "title" | "description">;
  index: number;
  total: number;
  className?: string;
  style?: CSSProperties;
  arrow?: string;
  voice?: { enabled: boolean; supported: boolean; speaking: boolean; toggle: () => void };
  nextButtonRef?: Ref<HTMLButtonElement>;
  onBack?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  footer?: ReactNode;
}) {
  return <section data-testid="guided-tour-card"
    className={`${className} max-h-[calc(100vh-32px)] animate-in overflow-visible rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] transition-all motion-reduce:animate-none motion-reduce:transition-none`}
    style={style}>
    {arrow !== "none" && <div className={`absolute h-3 w-3 rotate-45 border-neutral-200 bg-white transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
      arrow === "top" ? "-top-1.5 left-1/2 -translate-x-1/2 border-l border-t"
        : arrow === "bottom" ? "-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r"
          : arrow === "left" ? "-left-1.5 top-1/2 -translate-y-1/2 border-b border-l"
            : "-right-1.5 top-1/2 -translate-y-1/2 border-r border-t"
    }`} />}
    <div key={step.id} data-testid="guided-tour-step-content" className="relative animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out motion-reduce:animate-none">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">Step {index + 1} of {total}</span>
        <div className="flex items-center gap-1.5">
          {voice && <button type="button" role="switch" aria-checked={voice.enabled}
            aria-label={voice.enabled ? "Turn AI voice off" : "Turn AI voice on"}
            onClick={voice.toggle} disabled={!voice.supported}
            className={`group inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-lg border px-2.5 text-[11px] font-medium transition-all duration-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none ${voice.enabled ? "border-violet-200 bg-violet-50 text-violet-700" : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"}`}
            title={voice.supported ? "Read each walkthrough step aloud" : "Voice narration is unavailable in this browser"}>
            <span className="relative grid h-4 w-4 place-items-center">{voice.enabled ? voice.speaking ? <AudioLines size={14} className="animate-pulse motion-reduce:animate-none" /> : <Volume2 size={14} /> : <VolumeX size={14} />}</span>
            <span>AI voice</span><span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${voice.enabled ? "bg-violet-500" : "bg-neutral-300"}`} />
          </button>}
          {onSkip && <button type="button" onClick={onSkip} aria-label="Exit walkthrough" className="rounded-lg p-1.5 text-neutral-400 transition-all duration-200 hover:bg-neutral-100 hover:text-neutral-700 active:scale-95 motion-reduce:transform-none"><X size={17} /></button>}
        </div>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-violet-600 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      <h2 className="text-[18px] font-semibold leading-tight text-neutral-900">{step.title}</h2>
      <p className="mt-2 text-[13.5px] leading-6 text-neutral-600">{step.description}</p>
      {footer ?? <>
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-4">
          {onSkip && <button type="button" onClick={onSkip} className="px-2 py-2 text-[12.5px] text-neutral-500 transition-colors duration-200 hover:text-neutral-800">Skip tour</button>}
          <div className="flex gap-2">
            {index > 0 && onBack && <button type="button" onClick={onBack} className="inline-flex animate-in items-center gap-1.5 rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[12.5px] text-neutral-700 fade-in slide-in-from-right-1 duration-200 transition-all hover:-translate-y-0.5 hover:bg-neutral-50 active:translate-y-0 motion-reduce:animate-none motion-reduce:transform-none"><ArrowLeft size={14} /> Back</button>}
            <button ref={nextButtonRef} type="button" onClick={onNext} className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2.5 text-[12.5px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-md active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none">{index === total - 1 ? <><Check size={14} /> Finish</> : <>Next <ArrowRight size={14} /></>}</button>
          </div>
        </div>
        {onSkip && <p className="mt-3 text-[10.5px] text-neutral-400">Keyboard: ← Back · → Next · Esc Exit</p>}
      </>}
    </div>
  </section>;
}
