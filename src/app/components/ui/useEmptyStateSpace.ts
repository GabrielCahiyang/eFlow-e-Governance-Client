import { useLayoutEffect, useRef, useState } from 'react';

/** Fill the remaining scrollport, without imposing a viewport height on cards. */
export function useEmptyStateSpace(fill: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!fill || !element) { setHeight(undefined); return; }
    const ancestors: HTMLElement[] = [];
    let scrollport: HTMLElement | undefined;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      ancestors.push(parent);
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) { scrollport = parent; break; }
    }
    const measure = () => {
      const top = element.getBoundingClientRect().top;
      const bounds = scrollport?.getBoundingClientRect();
      const bottom = bounds ? bounds.top + scrollport!.clientTop + scrollport!.clientHeight : window.innerHeight;
      const offset = scrollport?.scrollTop ?? window.scrollY;
      const padding = ancestors.reduce((sum, parent) => sum + (parseFloat(getComputedStyle(parent).paddingBottom) || 0), 0);
      const next = Math.max(0, Math.floor(bottom - top - offset - padding));
      setHeight(previous => previous === next ? previous : next);
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    ancestors.forEach(parent => observer?.observe(parent));
    window.addEventListener('resize', measure);
    measure();
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [fill]);
  return { ref, height };
}
