import { useEffect, useState } from "react";
import type { GuidedTourStep } from "../types";

export interface TourTargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function resolveSelector(
  selector: string | (() => HTMLElement | null) | undefined,
): HTMLElement | null {
  if (!selector) return null;
  const element = typeof selector === "function"
    ? selector()
    : document.querySelector<HTMLElement>(selector);
  if (!element || !element.isConnected || element.closest("[hidden]")) {
    return null;
  }
  return element;
}

function toRect(element: HTMLElement): TourTargetRect {
  const rect = element.getBoundingClientRect();
  const padding = 7;
  return {
    top: Math.max(8, rect.top - padding),
    left: Math.max(8, rect.left - padding),
    width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
    height: Math.min(window.innerHeight - 16, rect.height + padding * 2),
  };
}

export function useGuidedTourTarget(step: GuidedTourStep): TourTargetRect | null {
  const [rect, setRect] = useState<TourTargetRect | null>(null);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let settleTimer = 0;
    let cleanupListeners = () => {};

    const reveal = async () => {
      await step.beforeShow?.();
      let target: HTMLElement | null = null;
      // Wait for newly navigated rails/tabs to mount before falling back to a parent container.
      const primaryAttempts = step.fallbackTarget ? 8 : 12;
      for (let attempt = 0; attempt < primaryAttempts && !target && !cancelled; attempt += 1) {
        target = resolveSelector(step.target);
        if (!target) await new Promise((resolve) => window.setTimeout(resolve, 75));
      }
      if (!target && !cancelled && step.fallbackTarget) {
        for (let attempt = 0; attempt < 4 && !target && !cancelled; attempt += 1) {
          target = resolveSelector(step.fallbackTarget);
          if (!target) await new Promise((resolve) => window.setTimeout(resolve, 60));
        }
      }
      if (cancelled) return;
      target ||= document.querySelector<HTMLElement>("[data-tour-page-content]");
      if (!target) return;

      const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const update = () => {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(() => {
          if (!cancelled && target?.isConnected) setRect(toRect(target));
        });
      };
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      update();
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center", inline: "center" });
      settleTimer = window.setTimeout(update, prefersReducedMotion ? 0 : 420);
      cleanupListeners = () => {
        window.cancelAnimationFrame(animationFrame);
        window.clearTimeout(settleTimer);
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    };

    void reveal();
    return () => {
      cancelled = true;
      cleanupListeners();
    };
  }, [step]);

  return rect;
}
