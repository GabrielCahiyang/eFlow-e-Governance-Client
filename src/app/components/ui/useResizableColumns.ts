import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export interface ResizableColumnSpec {
  key: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
}

function clampWidth(width: number, spec: ResizableColumnSpec): number {
  const min = spec.minWidth ?? 96;
  const max = spec.maxWidth ?? 720;
  return Math.max(min, Math.min(max, Math.round(width)));
}

/**
 * Manages user-resizable pixel widths for fixed-layout tables, supporting
 * pointer dragging, double-click width reset, and keyboard ArrowLeft/ArrowRight.
 */
export function useResizableColumns(specs: ResizableColumnSpec[]) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  const dragCleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => dragCleanup.current?.(), []);

  const specMap = useMemo(
    () => new Map(specs.map((spec) => [spec.key, spec])),
    [specs],
  );

  const resolvedWidths = useMemo(() => {
    const out: Record<string, number> = {};
    for (const spec of specs) {
      out[spec.key] =
        typeof widths[spec.key] === "number"
          ? clampWidth(widths[spec.key], spec)
          : clampWidth(spec.defaultWidth, spec);
    }
    return out;
  }, [specs, widths]);

  const totalWidth = useMemo(
    () => specs.reduce((sum, spec) => sum + (resolvedWidths[spec.key] ?? spec.defaultWidth), 0),
    [specs, resolvedWidths],
  );

  const resetColumnWidth = useCallback((key: string) => {
    setWidths((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const nudgeColumnWidth = useCallback(
    (key: string, deltaPx: number) => {
      const spec = specMap.get(key);
      if (!spec) return;
      setWidths((current) => {
        const base =
          typeof current[key] === "number" ? current[key] : spec.defaultWidth;
        return {
          ...current,
          [key]: clampWidth(base + deltaPx, spec),
        };
      });
    },
    [specMap],
  );

  const startResize = useCallback(
    (key: string, event: ReactPointerEvent<HTMLElement>) => {
      const spec = specMap.get(key);
      if (!spec) return;
      event.preventDefault();
      event.stopPropagation();
      dragCleanup.current?.();

      const startX = event.clientX;
      const startWidth = resolvedWidths[key] ?? spec.defaultWidth;

      const onMove = (moveEvent: PointerEvent) => {
        const nextWidth = clampWidth(startWidth + (moveEvent.clientX - startX), spec);
        setWidths((current) =>
          current[key] === nextWidth ? current : { ...current, [key]: nextWidth },
        );
      };

      const finish = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        dragCleanup.current = null;
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
      dragCleanup.current = finish;
    },
    [resolvedWidths, specMap],
  );

  const handleKeyResize = useCallback(
    (key: string, event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeColumnWidth(key, -20);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeColumnWidth(key, 20);
      } else if (event.key === "Home") {
        event.preventDefault();
        resetColumnWidth(key);
      }
    },
    [nudgeColumnWidth, resetColumnWidth],
  );

  const getResizeHandleProps = useCallback(
    (key: string, label: string) => {
      const spec = specMap.get(key);
      const current = resolvedWidths[key] ?? spec?.defaultWidth ?? 140;
      return {
        role: "separator" as const,
        tabIndex: 0,
        "aria-orientation": "vertical" as const,
        "aria-label": `Resize ${label} column`,
        "aria-valuemin": spec?.minWidth ?? 96,
        "aria-valuemax": spec?.maxWidth ?? 720,
        "aria-valuenow": current,
        title: "Drag to resize column · Double-click to reset",
        onPointerDown: (event: ReactPointerEvent<HTMLElement>) => startResize(key, event),
        onDoubleClick: () => resetColumnWidth(key),
        onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => handleKeyResize(key, event),
      };
    },
    [handleKeyResize, resetColumnWidth, resolvedWidths, specMap, startResize],
  );

  return {
    widths: resolvedWidths,
    totalWidth,
    getResizeHandleProps,
    resetColumnWidth,
  };
}
