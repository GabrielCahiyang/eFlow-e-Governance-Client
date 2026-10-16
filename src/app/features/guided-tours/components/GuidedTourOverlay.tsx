import { GuidedTourCard } from "./GuidedTourCard";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGuidedTourTarget } from "../hooks/useGuidedTourTarget";
import { useGuidedTourNarration } from "../hooks/useGuidedTourNarration";
import type { GuidedTourStep } from "../types";

export function GuidedTourOverlay({
  step,
  index,
  total,
  voiceEnabled,
  onToggleVoice,
  onBack,
  onNext,
  onSkip,
}: {
  step: GuidedTourStep;
  index: number;
  total: number;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const target = useGuidedTourTarget(step);
  const { supported: voiceSupported, isSpeaking } = useGuidedTourNarration(step, voiceEnabled);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [cardHeight, setCardHeight] = useState(238);
  const [viewport, setViewport] = useState(() => ({width:window.innerWidth,height:window.innerHeight}));

  useLayoutEffect(() => {
    const measure = () => { const height = cardRef.current?.offsetHeight; if (height) setCardHeight(height); };
    const resize = () => setViewport({width:window.innerWidth,height:window.innerHeight});
    measure();
    const observer = new ResizeObserver(measure);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener('resize',resize);
    return () => { observer.disconnect(); window.removeEventListener('resize',resize); };
  }, []);


  useEffect(() => {
    nextButtonRef.current?.focus({ preventScroll: true });
    const anotherDialogOwnsFocus = () => {
      const dialog = document.activeElement?.closest('[role="dialog"], [role="alertdialog"]');
      return Boolean(dialog && dialog !== overlayRef.current);
    };
    const containFocus = () => {
      if (!anotherDialogOwnsFocus() && !overlayRef.current?.contains(document.activeElement)) nextButtonRef.current?.focus({ preventScroll: true });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (anotherDialogOwnsFocus()) return;
      if (event.key === "Tab") {
        const controls = Array.from(overlayRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (first && last && (!overlayRef.current?.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
      if (event.key === "Escape") onSkip();
      if (event.key === "ArrowRight") onNext();
      if (event.key === "ArrowLeft" && index > 0) onBack();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener('focusin',containFocus);
    return () => { window.removeEventListener("keydown", onKeyDown); document.removeEventListener('focusin',containFocus); };
  }, [index, onBack, onNext, onSkip]);

  const cardPosition = useMemo(() => {
    const width = Math.min(400, viewport.width - 32);
    if (!target) return { left: (viewport.width - width) / 2, top: Math.max(16, (viewport.height - cardHeight) / 2), width, arrow: "none" };
    const estimatedHeight = cardHeight;
    const preferredLeft = target.left + target.width / 2 - width / 2;
    const left = Math.max(16, Math.min(viewport.width - width - 16, preferredLeft));
    const roomBelow = viewport.height - (target.top + target.height);
    const roomRight = viewport.width - (target.left + target.width);
    const roomLeft = target.left;
    const topBeside = Math.max(16, Math.min(viewport.height - estimatedHeight - 16, target.top + target.height / 2 - estimatedHeight / 2));
    if (target.left < 300 && roomRight >= width + 24) return { left: target.left + target.width + 16, top: topBeside, width, arrow: "left" };
    if (roomBelow >= estimatedHeight + 22) return { left, top: target.top + target.height + 16, width, arrow: "top" };
    if (target.top >= estimatedHeight + 22) return { left, top: target.top - estimatedHeight - 16, width, arrow: "bottom" };
    if (roomRight >= width + 24) return { left: target.left + target.width + 16, top: topBeside, width, arrow: "left" };
    if (roomLeft >= width + 24) return { left: target.left - width - 16, top: topBeside, width, arrow: "right" };
    return { left: (viewport.width - width) / 2, top: Math.max(16, viewport.height / 2 - estimatedHeight / 2), width, arrow: "none" };
  }, [target, cardHeight, viewport]);

  return createPortal(
    <div ref={overlayRef} className="fixed inset-0 z-[300] animate-in fade-in duration-300 font-normal motion-reduce:animate-none" role="dialog" aria-modal="true" aria-label="Guided walkthrough">
      <div className="absolute inset-0" onClick={(event) => event.stopPropagation()} />
      {target ? (
        <div
          data-testid="guided-tour-spotlight"
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl border-2 border-white/95 shadow-[0_0_0_9999px_rgba(10,15,25,0.72),0_0_0_5px_rgba(139,92,246,0.42)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={target}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 animate-in fade-in bg-slate-950/75 duration-300 motion-reduce:animate-none" />
      )}

      <GuidedTourCard
        step={step} index={index} total={total} arrow={cardPosition.arrow}
        style={{ left: cardPosition.left, top: cardPosition.top, width: cardPosition.width }}
        voice={{ enabled: voiceEnabled, supported: voiceSupported, speaking: isSpeaking, toggle: onToggleVoice }}
        nextButtonRef={nextButtonRef} cardRef={cardRef} onBack={onBack} onNext={onNext} onSkip={onSkip}
      />
    </div>,
    document.body,
  );
}
