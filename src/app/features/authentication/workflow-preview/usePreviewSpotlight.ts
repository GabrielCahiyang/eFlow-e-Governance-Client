import { useLayoutEffect, useState, type RefObject } from "react";

interface Bounds { left: number; top: number; width: number; height: number }
interface SpotlightLayout { target: Bounds; card: { left: number; top: number; width: number }; arrow: string }

/** Coordinates and scrolling are scoped to the demo; the login page never moves. */
export function usePreviewSpotlight(frame: RefObject<HTMLDivElement | null>, targetId: string) {
  const [layout, setLayout] = useState<SpotlightLayout | null>(null);
  useLayoutEffect(() => {
    const root = frame.current;
    const viewport = root?.querySelector<HTMLElement>("[data-preview-viewport]");
    const target = viewport?.querySelector<HTMLElement>(`[data-preview-target="${targetId}"]`);
    const card = root?.querySelector<HTMLElement>("[data-testid='guided-tour-card']");
    const scroller = viewport?.querySelector<HTMLElement>("[data-preview-scroll]");
    if (!root || !viewport || !target || !card) { setLayout(null); return; }
    let raf = 0;
    const revealTarget = () => {
      if (!scroller) return;
      const visible = scroller.getBoundingClientRect();
      const element = target.getBoundingClientRect();
      if (element.top < visible.top + 12) scroller.scrollTop += element.top - visible.top - 12;
      else if (element.bottom > visible.bottom - 12) scroller.scrollTop += Math.min(element.bottom - visible.bottom + 12, element.top - visible.top - 12);
    };
    const measure = () => {
      const area = viewport.getBoundingClientRect();
      const outer = root.getBoundingClientRect();
      const element = target.getBoundingClientRect();
      const left = Math.max(3, Math.min(area.width - 10, element.left - area.left - 5));
      const top = Math.max(3, Math.min(area.height - 10, element.top - area.top - 5));
      const width = Math.max(0, Math.min(area.width - left - 3, element.right - area.left + 5 - left));
      const height = Math.max(0, Math.min(area.height - top - 3, element.bottom - area.top + 5 - top));
      const cardWidth = Math.max(120, Math.min(320, area.width - 24));
      const cardHeight = card.getBoundingClientRect().height;
      const gap = 16;
      const clampX = (value: number) => Math.max(12, Math.min(area.width - cardWidth - 12, value));
      const clampY = (value: number) => Math.max(12, Math.min(area.height - cardHeight - 12, value));
      let position = { left: clampX(left + width / 2 - cardWidth / 2), top: clampY(top - cardHeight - gap), width: cardWidth };
      let arrow = "none";
      if (left >= cardWidth + gap + 12) { position = { ...position, left: left - cardWidth - gap, top: clampY(top + height / 2 - cardHeight / 2) }; arrow = "right"; }
      else if (area.width - left - width >= cardWidth + gap + 12) { position = { ...position, left: left + width + gap, top: clampY(top + height / 2 - cardHeight / 2) }; arrow = "left"; }
      else if (top >= cardHeight + gap + 12) { position = { ...position, top: top - cardHeight - gap }; arrow = "bottom"; }
      else if (area.height - top - height >= cardHeight + gap + 12) { position = { ...position, top: top + height + gap }; arrow = "top"; }
      position.top += area.top - outer.top;
      setLayout({ target: { left, top, width, height }, card: position, arrow: area.width <= 640 ? "none" : arrow });
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    const resize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { revealTarget(); measure(); }); };
    revealTarget();
    measure();
    // Re-measure after the screen's entrance animation and when the preview changes size.
    const settle = window.setTimeout(() => { revealTarget(); measure(); }, 260);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : undefined;
    observer?.observe(viewport);
    observer?.observe(card);
    observer?.observe(target);
    root.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", resize);
    return () => { observer?.disconnect(); cancelAnimationFrame(raf); window.clearTimeout(settle); root.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", resize); };
  }, [frame, targetId]);
  return layout;
}
