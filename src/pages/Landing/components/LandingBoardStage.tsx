import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  LayoutGroup,
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { Check, Lock, X } from "lucide-react";
import { AmbientSignalGrid } from "./AmbientSignalGrid";
import { LightSiphonCanvas, type PointerTrackerState } from "./LightSiphonCanvas";
import styles from "../LandingPage.module.scss";

type ColumnId = "todo" | "in_progress" | "done";

interface ProjectItem {
  id: string;
  title: string;
  code: string;
  budget: number;
  budgetLabel: string;
  avatars: [string, string];
  leadName: string;
  sealedDate: string;
  hashShort: string;
  hashFull: string;
}

// Exact total: 620,000 + 840,000 + 480,000 + 310,000 + 290,000 + 460,000 = ₱3,000,000.00
const PROJECTS: ProjectItem[] = [
  {
    id: "p-1",
    title: "City Hall Solar Inspection",
    code: "LEDIPO-2026-01",
    budget: 620000,
    budgetLabel: "₱620,000.00",
    avatars: ["DG", "FB"],
    leadName: "D. Gomez",
    sealedDate: "10/14/2026",
    hashShort: "0x4c19…a83f",
    hashFull: "0x4c198b02d71ea49f03c81270b65e91d4c02fa83f",
  },
  {
    id: "p-2",
    title: "Ormoc Port Wharf Permit",
    code: "LEDIPO-2026-02",
    budget: 840000,
    budgetLabel: "₱840,000.00",
    avatars: ["JC", "AL"],
    leadName: "J. Cruz",
    sealedDate: "10/19/2026",
    hashShort: "0x8b2e…c410",
    hashFull: "0x8b2ef1904a6c73d85012e9ab4730dc18f92ec410",
  },
  {
    id: "p-3",
    title: "Budget Allocation Q3",
    code: "LEDIPO-2026-03",
    budget: 480000,
    budgetLabel: "₱480,000.00",
    avatars: ["AL", "KC"],
    leadName: "A. Lim",
    sealedDate: "10/22/2026",
    hashShort: "0x9f3a…e21c",
    hashFull: "0x9f3a64c108be2749d510a83cf6219b4708dae21c",
  },
  {
    id: "p-4",
    title: "Disaster Risk Map Update",
    code: "LEDIPO-2026-04",
    budget: 310000,
    budgetLabel: "₱310,000.00",
    avatars: ["MR", "DG"],
    leadName: "M. Reyes",
    sealedDate: "10/25/2026",
    hashShort: "0x2e7b…91d4",
    hashFull: "0x2e7b9104c58ad36e7192f04bc83a15d96e2091d4",
  },
  {
    id: "p-5",
    title: "Review Ordinance 2026-08",
    code: "LEDIPO-2026-05",
    budget: 290000,
    budgetLabel: "₱290,000.00",
    avatars: ["JC", "MR"],
    leadName: "J. Cruz",
    sealedDate: "10/08/2026",
    hashShort: "0x7a04…f58e",
    hashFull: "0x7a04d829e15cb34096fa7128d0e53bc491a2f58e",
  },
  {
    id: "p-6",
    title: "Business Permit Automation",
    code: "LEDIPO-2026-06",
    budget: 460000,
    budgetLabel: "₱460,000.00",
    avatars: ["FB", "TB"],
    leadName: "F. Bautista",
    sealedDate: "10/03/2026",
    hashShort: "0x6d91…3b7a",
    hashFull: "0x6d91c308a47ef21985b064dc73e19a82f4053b7a",
  },
];

const VERNIER_STOPS = [
  { id: "01", targetProgress: 0 },
  { id: "02", targetProgress: 0.39 },
  { id: "03", targetProgress: 0.775 },
  { id: "04", targetProgress: 0.955 },
] as const;
const VERNIER_HEIGHT_PX = 216;

// Balanced 2/2/2 starting distribution on the interactive Hero board (matches Sign-In board)
const INITIAL_HERO_MAPPING: Record<string, ColumnId> = {
  "p-1": "todo",
  "p-2": "todo",
  "p-3": "in_progress",
  "p-4": "in_progress",
  "p-5": "done",
  "p-6": "done",
};

const CARD_SLOT_SPRING = {
  type: "spring" as const,
  stiffness: 150,
  damping: 24,
  mass: 0.95,
};

// Strictly ONE single card transitions at each step during Act 2 scroll storyboard
const PHASE_COLUMNS: Record<number, Record<string, ColumnId>> = {
  0: { "p-1": "todo", "p-2": "todo", "p-3": "todo", "p-4": "todo", "p-5": "in_progress", "p-6": "done" },
  1: { "p-1": "in_progress", "p-2": "todo", "p-3": "todo", "p-4": "todo", "p-5": "in_progress", "p-6": "done" },
  2: { "p-1": "in_progress", "p-2": "todo", "p-3": "todo", "p-4": "todo", "p-5": "done", "p-6": "done" },
  3: { "p-1": "in_progress", "p-2": "in_progress", "p-3": "todo", "p-4": "todo", "p-5": "done", "p-6": "done" },
  4: { "p-1": "done", "p-2": "in_progress", "p-3": "todo", "p-4": "todo", "p-5": "done", "p-6": "done" },
  5: { "p-1": "done", "p-2": "in_progress", "p-3": "in_progress", "p-4": "todo", "p-5": "done", "p-6": "done" },
  6: { "p-1": "done", "p-2": "done", "p-3": "in_progress", "p-4": "todo", "p-5": "done", "p-6": "done" },
  7: { "p-1": "done", "p-2": "done", "p-3": "in_progress", "p-4": "in_progress", "p-5": "done", "p-6": "done" },
  8: { "p-1": "done", "p-2": "done", "p-3": "done", "p-4": "in_progress", "p-5": "done", "p-6": "done" },
  9: { "p-1": "done", "p-2": "done", "p-3": "done", "p-4": "done", "p-5": "done", "p-6": "done" },
};

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

const COL_GAP = 14;
const COL_PAD_X = 12;
const CARD_ROW_STRIDE = 72; // 64px card height + 8px vertical gap (6 cards = 424px, fits cleanly inside 492px stage)
const TOTAL_BUDGET_PHP = 3_000_000;

function formatPhp(value: number): string {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * C2-continuous smooth-ramp constant-cruise easing for auto-scrolling:
 * gentle cosine acceleration over [0, r], rock-steady linear cruise over [r, 1 - r],
 * and velvety cosine deceleration over [1 - r, 1] (zero harsh mid-scroll speed spike).
 */
function easeAutoScrollCruise(t: number, ramp = 0.12): number {
  const clamped = Math.min(1, Math.max(0, t));
  const vMax = 1 / (1 - ramp);
  if (clamped < ramp) {
    return (vMax * 0.5) * (clamped - (ramp / Math.PI) * Math.sin((Math.PI * clamped) / ramp));
  }
  if (clamped <= 1 - ramp) {
    return vMax * (clamped - ramp * 0.5);
  }
  const u = 1 - clamped;
  return 1 - (vMax * 0.5) * (u - (ramp / Math.PI) * Math.sin((Math.PI * u) / ramp));
}

export interface LandingBoardStageProps {
  organizationName: string;
  resetSignal: number;
  isRevealReady: boolean;
  onThemeChange: (isLight: boolean) => void;
}

export const LandingBoardStage = memo(function LandingBoardStage({
  organizationName,
  resetSignal,
  isRevealReady,
  onThemeChange,
}: LandingBoardStageProps) {
  const shouldReduceMotion = useReducedMotion();
  const runwayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gridStageRef = useRef<HTMLDivElement | null>(null);
  const boardSlabRef = useRef<HTMLDivElement | null>(null);
  const publicTableRef = useRef<HTMLDivElement | null>(null);

  const [gridWidth, setGridWidth] = useState<number>(948);
  const [workflowPhase, setWorkflowPhase] = useState<number>(0);
  const [idleMapping, setIdleMapping] = useState<Record<string, ColumnId>>(() => ({
    ...INITIAL_HERO_MAPPING,
  }));
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [settlingCardId, setSettlingCardId] = useState<string | null>(null);
  const [hoveredColumnId, setHoveredColumnId] = useState<ColumnId | null>(null);
  const [isAtTopIdle, setIsAtTopIdle] = useState<boolean>(true);
  const [isLight, setIsLight] = useState(false);
  const [lockShut, setLockShut] = useState(false);
  const [publicVisible, setPublicVisible] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ProjectItem | null>(null);
  const [displayedBudget, setDisplayedBudget] = useState<number>(0);
  const [activeActIndex, setActiveActIndex] = useState<number>(0);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [cursorTrailsEnabled, setCursorTrailsEnabled] = useState(true);

  // Ref mirrors eliminate stale closures & state flip-flopping inside useMotionValueEvent
  const targetPhaseRef = useRef<number>(0);
  const isAtTopIdleRef = useRef<boolean>(true);
  const idleMappingRef = useRef<Record<string, ColumnId>>(idleMapping);
  idleMappingRef.current = idleMapping;
  const lastAfkCardIdRef = useRef<string | null>(null);
  const isHoveringBoardRef = useRef<boolean>(false);
  const isDraggingCardRef = useRef<boolean>(false);
  const lastBoardDragAtRef = useRef<number>(0);
  const columnRefs = useRef<Record<ColumnId, HTMLDivElement | null>>({
    todo: null,
    in_progress: null,
    done: null,
  });
  const dragWindowCleanupRef = useRef<(() => void) | null>(null);
  const dragReleaseAnimsRef = useRef<{ stop: () => void }[]>([]);
  const isLightRef = useRef<boolean>(false);
  const lockShutRef = useRef<boolean>(false);
  const publicVisibleRef = useRef<boolean>(false);
  const activeActRef = useRef<number>(0);
  const suppressScrollSyncUntilRef = useRef<number>(0);
  const navScrollRafRef = useRef<number>(0);
  const navAbortCleanupRef = useRef<(() => void) | null>(null);
  const pointerStateRef = useRef<PointerTrackerState>({
    x: 0,
    y: 0,
    inside: false,
    lastMoveAt: 0,
    leftAt: 0,
    hasMoved: false,
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const sync = () => setIsCompactViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const staticLayout = Boolean(shouldReduceMotion) || isCompactViewport;

  // Measure the board grid's unscaled local width once (and on resize) so cards move purely in local 2D space
  useEffect(() => {
    if (staticLayout) return;
    const el = gridStageRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0) setGridWidth(el.clientWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [staticLayout]);

  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 95,
    damping: 26,
    mass: 0.65,
  });

  // Dedicated slow, weighted viscous spring for the right-edge Vernier scale
  const vernierProgress = useSpring(scrollYProgress, {
    stiffness: 32,
    damping: 24,
    mass: 1.3,
  });

  // Clean instant state + spring reset while hidden behind the top-left logo veil
  useEffect(() => {
    if (resetSignal === 0) return;
    if (navAbortCleanupRef.current) {
      navAbortCleanupRef.current();
      navAbortCleanupRef.current = null;
    }
    if (navScrollRafRef.current) {
      window.cancelAnimationFrame(navScrollRafRef.current);
      navScrollRafRef.current = 0;
    }
    suppressScrollSyncUntilRef.current = performance.now() + 700;
    smoothProgress.jump(0);
    vernierProgress.jump(0);
    targetPhaseRef.current = 0;
    isAtTopIdleRef.current = true;
    lastAfkCardIdRef.current = null;
    isLightRef.current = false;
    lockShutRef.current = false;
    publicVisibleRef.current = false;
    activeActRef.current = 0;
    setWorkflowPhase(0);
    setIdleMapping({ ...INITIAL_HERO_MAPPING });
    setDraggingCardId(null);
    setSettlingCardId(null);
    setHoveredColumnId(null);
    setIsAtTopIdle(true);
    setIsLight(false);
    setLockShut(false);
    setPublicVisible(false);
    setSelectedRecord(null);
    setActiveActIndex(0);
    setDisplayedBudget(0);
    onThemeChange(false);
  }, [resetSignal, onThemeChange, smoothProgress, vernierProgress]);

  // Random AFK shuffle across all 6 projects while parked at the Hero (pauses on hover/drag; rearranges back on scroll)
  useEffect(() => {
    if (staticLayout || !isRevealReady || !isAtTopIdle) return;
    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (scrollYProgress.get() >= 0.015) return;
      if (isDraggingCardRef.current || isHoveringBoardRef.current) return;
      if (Date.now() - lastBoardDragAtRef.current < 4500) return;

      setIdleMapping((prev) => {
        const counts: Record<ColumnId, number> = { todo: 0, in_progress: 0, done: 0 };
        PROJECTS.forEach((p) => {
          counts[prev[p.id] ?? "todo"] += 1;
        });

        // Prefer a different card than the last one moved so all 6 projects organically take turns
        const allOther = PROJECTS.filter((p) => p.id !== lastAfkCardIdRef.current);
        const balancedPool = allOther.filter((p) => counts[prev[p.id] ?? "todo"] >= 2);
        const pool = balancedPool.length > 0 ? balancedPool : allOther;
        if (pool.length === 0) return prev;

        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const currentCol = prev[chosen.id] ?? "todo";
        const candidateCols = (["todo", "in_progress", "done"] as ColumnId[]).filter(
          (col) => col !== currentCol && counts[col] < 4,
        );
        if (candidateCols.length === 0) return prev;

        const targetCol = candidateCols[Math.floor(Math.random() * candidateCols.length)];
        lastAfkCardIdRef.current = chosen.id;
        return { ...prev, [chosen.id]: targetCol };
      });
    }, 3400);
    return () => window.clearInterval(interval);
  }, [staticLayout, isRevealReady, isAtTopIdle, scrollYProgress]);

  // Single authoritative ±1 sequential pacer so cards glide smoothly 1-by-1 without rushing
  useEffect(() => {
    if (staticLayout) return;
    const timer = window.setInterval(() => {
      if (isAtTopIdleRef.current) return;
      setWorkflowPhase((current) => {
        const target = targetPhaseRef.current;
        if (current === target) return current;
        return current < target ? current + 1 : current - 1;
      });
    }, 270);
    return () => window.clearInterval(timer);
  }, [staticLayout]);

  // Smooth roll-up animation on ₱3,000,000.00 when Public View reveals
  useEffect(() => {
    if (staticLayout) {
      setDisplayedBudget(TOTAL_BUDGET_PHP);
      return;
    }
    if (!publicVisible) {
      setDisplayedBudget(0);
      return;
    }
    let rafId = 0;
    const start = performance.now();
    const duration = 760;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayedBudget(Math.round(TOTAL_BUDGET_PHP * eased));
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setDisplayedBudget(TOTAL_BUDGET_PHP);
      }
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [publicVisible, staticLayout]);

  // Cursor-reactive 3D tilt + board charge + 1-to-1 card drag offset MotionValues
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothPtrX = useSpring(pointerX, { stiffness: 90, damping: 22 });
  const smoothPtrY = useSpring(pointerY, { stiffness: 90, damping: 22 });
  const dragOffsetX = useMotionValue(0);
  const dragOffsetY = useMotionValue(0);

  // 0 = light lives in active mouse chunks, 1 = light chunks poured into board/table
  const boardCharge = useMotionValue(0);
  const siphonSweepX = useMotionValue(0);
  const siphonTableGlow = boardCharge;
  const siphonRestingVeilOpacity = useTransform(boardCharge, [0, 1], [1, 0]);
  const siphonSweepPct = useTransform(siphonSweepX, (v) => `${v}%`);

  // Gentle zero-gravity breathing float (±5px) ONLY while parked idle at top
  const idleFloatY = useMotionValue(0);
  const idleFloatTilt = useMotionValue(0);
  const idleGlowOpacity = useMotionValue(0.85);

  useAnimationFrame((time) => {
    if (staticLayout) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    // Slow living highlight sweep across the illuminated board/table surface
    if (boardCharge.get() > 0.04) {
      siphonSweepX.set(Math.sin(time / 3400) * 34);
    }

    const damp = Math.max(0, 1 - scrollYProgress.get() / 0.05);
    if (damp <= 0.001) {
      if (idleFloatY.get() !== 0) idleFloatY.set(0);
      if (idleFloatTilt.get() !== 0) idleFloatTilt.set(0);
      return;
    }
    const wave = Math.sin(time / 860);
    const cosWave = Math.cos(time / 1120);
    idleFloatY.set(wave * 5.0 * damp);
    idleFloatTilt.set(cosWave * 0.7 * damp);
    idleGlowOpacity.set(0.74 + ((wave + 1) * 0.5) * 0.26);
  });

  // Global window pointer tracking so circling across the fixed navbar or viewport edges NEVER resets the orbs
  useEffect(() => {
    if (staticLayout) return;

    const handleWindowPointerMove = (event: PointerEvent) => {
      const stageEl = stageRef.current;
      if (!stageEl) return;
      const w = stageEl.clientWidth || window.innerWidth;
      const h = stageEl.clientHeight || window.innerHeight;
      const localX = event.clientX;
      const localY = event.clientY;
      const prev = pointerStateRef.current;
      const movedEnough = !prev.hasMoved || Math.hypot(localX - prev.x, localY - prev.y) > 2.5;
      prev.x = localX;
      prev.y = localY;
      prev.inside = true;
      prev.leftAt = 0;
      prev.hasMoved = true;
      if (movedEnough) {
        prev.lastMoveAt = performance.now();
      }

      if (isDraggingCardRef.current) {
        pointerX.set(0);
        pointerY.set(0);
        return;
      }

      const rx = Math.min(1, Math.max(0, localX / Math.max(1, w)));
      const ry = Math.min(1, Math.max(0, localY / Math.max(1, h)));
      pointerX.set((rx - 0.5) * 3.5);
      pointerY.set(-(ry - 0.5) * 2.2);
    };

    const handleDocumentLeave = (event: MouseEvent) => {
      if (event.relatedTarget !== null) return;
      pointerStateRef.current.inside = false;
      pointerStateRef.current.leftAt = performance.now();
      pointerX.set(0);
      pointerY.set(0);
    };

    window.addEventListener("pointermove", handleWindowPointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleDocumentLeave);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      document.documentElement.removeEventListener("mouseleave", handleDocumentLeave);
    };
  }, [staticLayout, pointerX, pointerY]);

  useMotionValueEvent(smoothProgress, "change", (p) => {
    if (staticLayout) return;
    if (performance.now() < suppressScrollSyncUntilRef.current) return;

    const nextIdle = p < 0.02;
    if (nextIdle !== isAtTopIdleRef.current) {
      isAtTopIdleRef.current = nextIdle;
      setIsAtTopIdle(nextIdle);
      if (!nextIdle) {
        // Cancel any active Hero drag cleanly and smoothly rearrange cards back into Act 2 storyboard
        if (dragWindowCleanupRef.current) {
          dragWindowCleanupRef.current();
          dragWindowCleanupRef.current = null;
        }
        dragReleaseAnimsRef.current.forEach((a) => a.stop());
        dragReleaseAnimsRef.current = [];
        isDraggingCardRef.current = false;
        dragOffsetX.set(0);
        dragOffsetY.set(0);
        setDraggingCardId(null);
        setSettlingCardId(null);
        setHoveredColumnId(null);
        setWorkflowPhase(0);
      }
    }

    // 1-by-1 scroll checkpoints across 0.14 -> 0.62 (read solely by the ±1 pacer timer)
    let nextPhase = 0;
    if (p >= 0.62) nextPhase = 9;
    else if (p >= 0.56) nextPhase = 8;
    else if (p >= 0.5) nextPhase = 7;
    else if (p >= 0.44) nextPhase = 6;
    else if (p >= 0.38) nextPhase = 5;
    else if (p >= 0.32) nextPhase = 4;
    else if (p >= 0.26) nextPhase = 3;
    else if (p >= 0.2) nextPhase = 2;
    else if (p >= 0.14) nextPhase = 1;
    targetPhaseRef.current = nextPhase;

    const nextLight = (p >= 0.14 && p < 0.67) || p >= 0.86;
    if (nextLight !== isLightRef.current) {
      isLightRef.current = nextLight;
      setIsLight(nextLight);
      onThemeChange(nextLight);
    }

    const nextShut = p >= 0.765;
    if (nextShut !== lockShutRef.current) {
      lockShutRef.current = nextShut;
      setLockShut(nextShut);
    }

    const nextPublic = p >= 0.865;
    if (nextPublic !== publicVisibleRef.current) {
      publicVisibleRef.current = nextPublic;
      setPublicVisible(nextPublic);
      if (!nextPublic) {
        setSelectedRecord(null);
      }
    }

    const nextAct = p >= 0.85 ? 3 : p >= 0.665 ? 2 : p >= 0.13 ? 1 : 0;
    if (nextAct !== activeActRef.current) {
      activeActRef.current = nextAct;
      setActiveActIndex(nextAct);
    }
  });

  // Backdrop crossfades
  const lightBackdropOpacity = useTransform(
    smoothProgress,
    [0.11, 0.17, 0.64, 0.69, 0.83, 0.88],
    [0, 1, 1, 0, 0, 1],
  );
  const signalGridOpacity = useTransform(lightBackdropOpacity, [0, 1], [1, 0]);

  // Left Split Hero Copy fades & glides smoothly out (0.00 -> 0.10)
  const heroCopyOpacity = useTransform(smoothProgress, [0, 0.085], [1, 0]);
  const heroCopyX = useTransform(smoothProgress, [0, 0.095], [0, -54]);

  // 3D Board glides from RIGHT (+20vw) -> DEAD CENTER (0vw), then stays crisp & rock-steady during card moves!
  const boardTranslateX = useTransform(smoothProgress, [0, 0.115], ["20vw", "0vw"]);
  const boardRotateX = useTransform(
    smoothProgress,
    [0, 0.115, 0.64, 0.72],
    [4, 1.5, 1.5, 0],
  );
  const boardRotateY = useTransform(
    smoothProgress,
    [0, 0.115, 0.38, 0.64, 0.72],
    [-6.5, -1.5, 1.5, 0, 0],
  );
  const boardScale = useTransform(
    smoothProgress,
    [0, 0.115, 0.64, 0.72, 0.83],
    [0.72, 0.96, 0.96, 0.85, 0.76],
  );
  const boardOpacity = useTransform(
    smoothProgress,
    [0, 0.66, 0.72, 0.82, 0.865],
    [1, 1, 0.24, 0.12, 0],
  );

  // Specular sheen gliding across the board
  const boardSheenX = useTransform(smoothProgress, [0, 0.64], ["-60%", "65%"]);

  const combinedRotateX = useTransform([boardRotateX, smoothPtrY], ([rx, py]) =>
    staticLayout ? 0 : (rx as number) + (py as number) * (1 - Math.min(1, scrollYProgress.get() * 6)),
  );
  const combinedRotateY = useTransform([boardRotateY, smoothPtrX], ([ry, px]) =>
    staticLayout ? 0 : (ry as number) + (px as number) * (1 - Math.min(1, scrollYProgress.get() * 6)),
  );

  // Scan sweep across the board once vault lock engages
  const scanBeamY = useTransform(smoothProgress, [0.75, 0.82], ["-15%", "115%"]);
  const scanBeamOpacity = useTransform(smoothProgress, [0.74, 0.765, 0.81, 0.835], [0, 1, 1, 0]);

  // SWISS-INDUSTRIAL VAULT LOCK (0.67 -> 0.865)
  const lockOpacity = useTransform(smoothProgress, [0.67, 0.715, 0.82, 0.865], [0, 1, 1, 0]);
  const lockScale = useTransform(
    smoothProgress,
    [0.67, 0.72, 0.765, 0.785, 0.865],
    [0.8, 1, 0.985, 1.045, 1.14],
  );
  const shackleY = useTransform(smoothProgress, [0.705, 0.762], [-34, 0]);
  const shackleRotate = useTransform(smoothProgress, [0.705, 0.752], [22, 0]);
  const tumblerRotate = useTransform(smoothProgress, [0.725, 0.775], [-90, 0]);
  const bracketScale = useTransform(smoothProgress, [0.695, 0.77], [1.24, 1]);
  const bracketOpacity = useTransform(smoothProgress, [0.695, 0.745, 0.82], [0, 0.85, 0.25]);
  const lockSheenX = useTransform(smoothProgress, [0.755, 0.805], [-180, 260]);
  const ringPulseScale = useTransform(smoothProgress, [0.76, 0.83], [0.85, 1.32]);
  const ringPulseOpacity = useTransform(smoothProgress, [0.755, 0.775, 0.83], [0, 0.88, 0]);

  // Animated Public View Transparency Table (0.845 -> 1.00)
  const publicOpacity = useTransform(smoothProgress, [0.845, 0.895, 1], [0, 1, 1]);
  const publicY = useTransform(smoothProgress, [0.845, 0.905], [46, 0]);
  const publicScale = useTransform(smoothProgress, [0.845, 0.905], [0.95, 1]);

  // Vernier right-edge hairline needle position (0px -> 216px) driven by calm viscous spring
  const vernierMarkerY = useTransform(vernierProgress, [0, 1], [0, VERNIER_HEIGHT_PX]);

  const canDragCards = !staticLayout && isAtTopIdle;
  const activeMapping = staticLayout
    ? PHASE_COLUMNS[9]
    : isAtTopIdle
      ? idleMapping
      : (PHASE_COLUMNS[workflowPhase] ?? PHASE_COLUMNS[0]);

  useEffect(() => {
    return () => {
      if (navAbortCleanupRef.current) {
        navAbortCleanupRef.current();
        navAbortCleanupRef.current = null;
      }
      if (navScrollRafRef.current) {
        window.cancelAnimationFrame(navScrollRafRef.current);
      }
      if (dragWindowCleanupRef.current) {
        dragWindowCleanupRef.current();
        dragWindowCleanupRef.current = null;
      }
      dragReleaseAnimsRef.current.forEach((a) => a.stop());
      dragReleaseAnimsRef.current = [];
    };
  }, []);

  const handleCardPointerDown = (cardId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!canDragCards) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const stageEl = gridStageRef.current;
    const todoEl = columnRefs.current.todo;
    const inProgEl = columnRefs.current.in_progress;
    const doneEl = columnRefs.current.done;
    if (!stageEl || !todoEl || !inProgEl || !doneEl) return;

    event.preventDefault();
    event.stopPropagation();

    if (dragWindowCleanupRef.current) {
      dragWindowCleanupRef.current();
      dragWindowCleanupRef.current = null;
    }
    dragReleaseAnimsRef.current.forEach((a) => a.stop());
    dragReleaseAnimsRef.current = [];

    // Snapshot stage scale and column bounds ONCE on grab (1-to-1 cursor lock even at scale 0.72, zero move thrashing)
    const stageRect = stageEl.getBoundingClientRect();
    const scaleX = Math.max(0.25, stageRect.width / Math.max(1, gridWidth));
    const scaleY = Math.max(0.25, stageRect.height / 492);
    const todoRect = todoEl.getBoundingClientRect();
    const inProgRect = inProgEl.getBoundingClientRect();
    const doneRect = doneEl.getBoundingClientRect();
    const boundary1 = (todoRect.right + inProgRect.left) / 2;
    const boundary2 = (inProgRect.right + doneRect.left) / 2;

    const resolveTargetCol = (clientX: number, clientY: number): ColumnId | null => {
      if (
        clientX < todoRect.left - 80 ||
        clientX > doneRect.right + 80 ||
        clientY < stageRect.top - 90 ||
        clientY > stageRect.bottom + 90
      ) {
        return null;
      }
      if (clientX < boundary1) return "todo";
      if (clientX < boundary2) return "in_progress";
      return "done";
    };

    const grabX = event.clientX;
    const grabY = event.clientY;
    let lastHovered: ColumnId | null = idleMappingRef.current[cardId] ?? "todo";

    isDraggingCardRef.current = true;
    lastBoardDragAtRef.current = Date.now();
    dragOffsetX.set(0);
    dragOffsetY.set(0);
    setDraggingCardId(cardId);
    setSettlingCardId(cardId);
    setHoveredColumnId(lastHovered);
    pointerX.set(0);
    pointerY.set(0);

    const onMove = (e: PointerEvent) => {
      dragOffsetX.set((e.clientX - grabX) / scaleX);
      dragOffsetY.set((e.clientY - grabY) / scaleY);
      const nextCol = resolveTargetCol(e.clientX, e.clientY);
      if (nextCol !== lastHovered) {
        lastHovered = nextCol;
        setHoveredColumnId(nextCol);
      }
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };

    const onEnd = (e: PointerEvent) => {
      cleanup();
      dragWindowCleanupRef.current = null;
      isDraggingCardRef.current = false;
      lastBoardDragAtRef.current = Date.now();
      setDraggingCardId(null);
      setHoveredColumnId(null);

      const targetCol = resolveTargetCol(e.clientX, e.clientY);
      const currentCol = idleMappingRef.current[cardId] ?? "todo";
      if (targetCol && targetCol !== currentCol) {
        lastAfkCardIdRef.current = cardId;
        setIdleMapping((prev) => ({ ...prev, [cardId]: targetCol }));
      }

      // Glide inner offset back to (0, 0) using the exact same spring as outer slot -> direct drop-to-slot motion!
      const animX = animate(dragOffsetX, 0, CARD_SLOT_SPRING);
      const animY = animate(dragOffsetY, 0, CARD_SLOT_SPRING);
      dragReleaseAnimsRef.current = [animX, animY];
      void Promise.all([animX.finished, animY.finished]).then(() => {
        setSettlingCardId((curr) => (curr === cardId ? null : curr));
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    dragWindowCleanupRef.current = cleanup;
  };

  useEffect(() => {
    if (!selectedRecord) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRecord(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRecord]);

  const handleToggleCursorTrails = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextEnabled = !cursorTrailsEnabled;
    if (nextEnabled) {
      pointerStateRef.current.x = event.clientX;
      pointerStateRef.current.y = event.clientY;
      pointerStateRef.current.inside = true;
      pointerStateRef.current.leftAt = 0;
      pointerStateRef.current.hasMoved = true;
      pointerStateRef.current.lastMoveAt = performance.now();
    }
    setCursorTrailsEnabled(nextEnabled);
  };

  const handleJumpToAct = (targetProgress: number) => {
    const el = runwayRef.current;
    if (!el) return;
    const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
    const rectTop = el.getBoundingClientRect().top + window.scrollY;
    const destinationY = rectTop + scrollable * targetProgress;

    if (shouldReduceMotion) {
      window.scrollTo({ top: destinationY, behavior: "auto" });
      return;
    }

    if (navAbortCleanupRef.current) {
      navAbortCleanupRef.current();
      navAbortCleanupRef.current = null;
    }
    if (navScrollRafRef.current) {
      window.cancelAnimationFrame(navScrollRafRef.current);
      navScrollRafRef.current = 0;
    }

    const startY = window.scrollY;
    const distance = destinationY - startY;
    if (Math.abs(distance) < 4) return;

    // Steady cinema auto-scroller: ~15.5s across a full 0 -> 1 story so every beat plays out calmly
    const progressDelta = Math.abs(distance) / scrollable;
    const durationMs = Math.max(2600, Math.round(progressDelta * 15500));
    const startTime = performance.now();
    let cancelled = false;

    const cleanupListeners = () => {
      window.removeEventListener("wheel", abortOnUserScroll);
      window.removeEventListener("touchstart", abortOnUserScroll);
      window.removeEventListener("keydown", abortOnScrollKey);
    };

    const abortOnUserScroll = () => {
      cancelled = true;
      if (navScrollRafRef.current) {
        window.cancelAnimationFrame(navScrollRafRef.current);
        navScrollRafRef.current = 0;
      }
      cleanupListeners();
      navAbortCleanupRef.current = null;
    };

    const abortOnScrollKey = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === " "
      ) {
        abortOnUserScroll();
      }
    };

    window.addEventListener("wheel", abortOnUserScroll, { passive: true });
    window.addEventListener("touchstart", abortOnUserScroll, { passive: true });
    window.addEventListener("keydown", abortOnScrollKey);
    navAbortCleanupRef.current = cleanupListeners;

    const step = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = easeAutoScrollCruise(t, 0.12);
      window.scrollTo({
        top: startY + distance * eased,
        behavior: "instant" as ScrollBehavior,
      });
      if (t < 1) {
        navScrollRafRef.current = window.requestAnimationFrame(step);
      } else {
        navScrollRafRef.current = 0;
        cleanupListeners();
        navAbortCleanupRef.current = null;
      }
    };

    navScrollRafRef.current = window.requestAnimationFrame(step);
  };

  // Precompute exact local 2D (x, y) coordinates and counts for every card — ZERO FLIP / ZERO jitter!
  const { columnCounts, cardCoords, cardWidth } = useMemo(() => {
    const colWidth = Math.max(120, (gridWidth - COL_GAP * 2) / 3);
    const innerWidth = Math.max(100, colWidth - COL_PAD_X * 2);
    const counts: Record<ColumnId, number> = { todo: 0, in_progress: 0, done: 0 };
    const slotCounters: Record<ColumnId, number> = { todo: 0, in_progress: 0, done: 0 };
    const coords: Record<string, { colId: ColumnId; x: number; y: number }> = {};

    const colIndexMap: Record<ColumnId, number> = { todo: 0, in_progress: 1, done: 2 };

    PROJECTS.forEach((proj) => {
      const colId = activeMapping[proj.id] ?? "todo";
      const colIdx = colIndexMap[colId];
      const slotIdx = slotCounters[colId];
      slotCounters[colId] += 1;
      counts[colId] += 1;

      coords[proj.id] = {
        colId,
        x: colIdx * (colWidth + COL_GAP) + COL_PAD_X,
        y: slotIdx * CARD_ROW_STRIDE,
      };
    });

    return { columnCounts: counts, cardCoords: coords, cardWidth: innerWidth };
  }, [activeMapping, gridWidth]);

  return (
    <section
      id="stage-hero"
      ref={runwayRef}
      className={styles.cinemaRunway}
      aria-label="eFlow interactive workflow showcase"
    >
      {/* Razor-thin ambient scroll hairline at very top edge */}
      {!staticLayout && (
        <div className={styles.progressHairlineTrack} aria-hidden="true">
          <motion.div
            className={`${styles.progressHairlineFill} ${
              isLight ? styles.progressHairlineFillLight : ""
            }`}
            style={{ scaleX: smoothProgress }}
          />
        </div>
      )}

      <div ref={stageRef} className={styles.stickyViewport}>
        {/* Dark Midnight-Navy Backdrop */}
        <div className={styles.backdropDark} aria-hidden="true" />

        {/* Architectural Signal Grid */}
        {!staticLayout && (
          <motion.div
            className={styles.signalGridHost}
            style={{ opacity: signalGridOpacity }}
            aria-hidden="true"
          >
            <AmbientSignalGrid />
          </motion.div>
        )}

        {/* Cool Alabaster Backdrop */}
        <motion.div
          className={styles.backdropLight}
          style={{ opacity: staticLayout ? 0 : lightBackdropOpacity }}
          aria-hidden="true"
        />

        {/* Chunked Cursor ↔ Board Light Siphon Canvas */}
        <LightSiphonCanvas
          stageRef={stageRef}
          boardSlabRef={boardSlabRef}
          publicTableRef={publicTableRef}
          pointerStateRef={pointerStateRef}
          isLight={isLight}
          isRevealReady={isRevealReady}
          publicVisible={publicVisible}
          staticLayout={staticLayout}
          trailsEnabled={cursorTrailsEnabled}
          boardCharge={boardCharge}
        />

        {/* Subtle Architectural Corner Reticles */}
        <div
          className={`${styles.stageReticleFrame} ${isLight ? styles.reticleLight : ""}`}
          aria-hidden="true"
        >
          <span className={`${styles.reticleCorner} ${styles.reticleTL}`} />
          <span className={`${styles.reticleCorner} ${styles.reticleTR}`} />
          <span className={`${styles.reticleCorner} ${styles.reticleBL}`} />
          <span className={`${styles.reticleCorner} ${styles.reticleBR}`} />
        </div>

        {/* Right-Edge Swiss Vernier Scale (zero box, zero rounded corners, zero text bloat) */}
        {!staticLayout && (
          <nav
            className={`${styles.vernierRail} ${isLight ? styles.vernierLight : ""}`}
            aria-label="Scroll stage scale"
          >
            <div className={styles.vernierSpine} aria-hidden="true">
              <motion.span
                className={styles.vernierSpineFill}
                style={{ scaleY: vernierProgress }}
              />
              {/* Minor graduation ticks between major checkpoints */}
              {[1, 2, 3, 5, 6, 7, 9, 10, 11].map((slot) => (
                <span
                  key={slot}
                  className={styles.vernierMinorTick}
                  style={{ top: `${(slot / 12) * 100}%` }}
                />
              ))}
              {/* Gliding hairline needle */}
              <motion.span
                className={styles.vernierNeedle}
                style={{ y: vernierMarkerY }}
              />
            </div>

            {VERNIER_STOPS.map((stop, idx) => {
              const isActive = activeActIndex === idx;
              const topPct = (idx / (VERNIER_STOPS.length - 1)) * 100;
              return (
                <button
                  key={stop.id}
                  type="button"
                  className={`${styles.vernierStop} ${isActive ? styles.vernierStopActive : ""} ${
                    styles.tabular
                  }`}
                  style={{ top: `${topPct}%` }}
                  aria-label={`Jump to stage ${stop.id}`}
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => handleJumpToAct(stop.targetProgress)}
                >
                  <span className={styles.vernierIndex}>{stop.id}</span>
                  <motion.span
                    className={styles.vernierTick}
                    initial={false}
                    animate={{ width: isActive ? 22 : 10 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </nav>
        )}

        {/* ================================================================
            SPLIT HERO LEFT PANEL: eFlow · LEDIPO (fades out cleanly on scroll)
           ================================================================ */}
        <motion.div
          className={styles.heroSplitCopy}
          style={
            staticLayout
              ? undefined
              : {
                  opacity: heroCopyOpacity,
                  x: heroCopyX,
                }
          }
        >
          <motion.div
            className={styles.heroBrandKicker}
            initial={staticLayout ? false : { opacity: 0, y: 12 }}
            animate={isRevealReady || staticLayout ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.55, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>eFlow</span>
            <span className={styles.heroKickerDot} aria-hidden="true">·</span>
            <span className={styles.heroKickerOrg}>{organizationName}</span>
            {!staticLayout && (
              <button
                type="button"
                className={`${styles.heroStarToggle} ${
                  cursorTrailsEnabled ? styles.heroStarToggleOn : styles.heroStarToggleOff
                }`}
                style={{ pointerEvents: isAtTopIdle ? "auto" : "none" }}
                onClick={handleToggleCursorTrails}
                aria-pressed={cursorTrailsEnabled}
                aria-label={
                  cursorTrailsEnabled
                    ? "Turn off cursor star trails and return light to board"
                    : "Turn on cursor star trails"
                }
                title={
                  cursorTrailsEnabled
                    ? "Send star trails back to the board"
                    : "Enable cursor star trails"
                }
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 1.5 Q13.4 10.6 22.5 12 Q13.4 13.4 12 22.5 Q10.6 13.4 1.5 12 Q10.6 10.6 12 1.5 Z"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth={cursorTrailsEnabled ? 0.4 : 1.5}
                    fillOpacity={cursorTrailsEnabled ? 1 : 0.08}
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </motion.div>

          <motion.h1
            className={styles.heroSplitTitle}
            initial={staticLayout ? false : { opacity: 0, y: 16 }}
            animate={isRevealReady || staticLayout ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.62, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            Getting things done.
          </motion.h1>

          <motion.p
            className={styles.heroSplitSub}
            initial={staticLayout ? false : { opacity: 0, y: 14 }}
            animate={isRevealReady || staticLayout ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
            transition={{ duration: 0.62, delay: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            Transparent project delivery—track workplans and every peso spent with verifiable
            audit trails, sealed on the public record.
          </motion.p>

          <motion.div
            className={styles.heroSplitPillars}
            initial={staticLayout ? false : { opacity: 0, y: 10 }}
            animate={isRevealReady || staticLayout ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.58, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>Workplans</span>
            <span className={styles.heroPillarSep} aria-hidden="true">·</span>
            <span>Audit Trails</span>
            <span className={styles.heroPillarSep} aria-hidden="true">·</span>
            <span>Public View</span>
          </motion.div>

          {!staticLayout && (
            <motion.div
              className={styles.heroScrollCue}
              initial={{ opacity: 0 }}
              animate={isRevealReady ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.44 }}
              aria-hidden="true"
            >
              <span className={styles.heroScrollLine}>
                <span className={styles.heroScrollPulse} />
              </span>
              <span>Scroll</span>
            </motion.div>
          )}
        </motion.div>

        {/* ================================================================
            GIANT FLOATING 3D BOARD (Local-space magnetic cards — ZERO jitter!)
           ================================================================ */}
        <motion.div
          className={styles.boardStageWrap}
          style={
            staticLayout
              ? undefined
              : {
                  x: boardTranslateX,
                  rotateX: combinedRotateX,
                  rotateY: combinedRotateY,
                  scale: boardScale,
                  opacity: boardOpacity,
                  pointerEvents: publicVisible ? "none" : "auto",
                }
          }
        >
          <motion.div
            className={styles.boardFloatCarrier}
            initial={staticLayout ? false : { opacity: 0, scale: 0.97 }}
            animate={
              isRevealReady || staticLayout
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.97 }
            }
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={
              staticLayout
                ? undefined
                : {
                    y: idleFloatY,
                    rotateX: idleFloatTilt,
                  }
            }
          >
            {!isLight && (
              <motion.div
                className={styles.boardAmbientGlow}
                style={staticLayout ? undefined : { opacity: idleGlowOpacity }}
                aria-hidden="true"
              />
            )}

            {/* Absorbed Halo when cursor light siphons into the 3D board */}
            {!staticLayout && !publicVisible && (
              <motion.div
                className={`${styles.siphonBoardHalo} ${
                  isLight ? styles.siphonBoardHaloLight : ""
                }`}
                style={{ opacity: siphonTableGlow }}
                aria-hidden="true"
              />
            )}

            <div
              ref={boardSlabRef}
              className={`${styles.boardSlab} ${isLight ? styles.boardSlabLight : ""} ${
                lockShut ? styles.boardSlabSealed : ""
              }`}
              onMouseEnter={() => {
                isHoveringBoardRef.current = true;
              }}
              onMouseLeave={() => {
                isHoveringBoardRef.current = false;
              }}
            >
              {!staticLayout && !publicVisible && (
                <>
                  <motion.div
                    className={`${styles.siphonRimHighlight} ${
                      isLight ? styles.siphonRimHighlightLight : ""
                    }`}
                    style={{ opacity: siphonTableGlow }}
                    aria-hidden="true"
                  />
                  <motion.div
                    className={`${styles.siphonBorderOrbit} ${
                      isLight ? styles.siphonBorderOrbitLight : ""
                    }`}
                    style={{ opacity: siphonTableGlow }}
                    aria-hidden="true"
                  >
                    <div className={styles.siphonBorderOrbitSpinner} />
                  </motion.div>
                  <div className={styles.boardEffectsClip} aria-hidden="true">
                    <motion.div
                      className={`${styles.siphonRestingVeil} ${
                        isLight ? styles.siphonRestingVeilLight : ""
                      }`}
                      style={{ opacity: siphonRestingVeilOpacity }}
                    />
                    <motion.div
                      className={`${styles.siphonSurfaceCrown} ${
                        isLight ? styles.siphonSurfaceCrownLight : ""
                      }`}
                      style={{ opacity: siphonTableGlow }}
                    />
                    <motion.div
                      className={styles.siphonSurfaceSweep}
                      style={{ opacity: siphonTableGlow, x: siphonSweepPct }}
                    />
                    <motion.div
                      className={styles.boardSheen}
                      style={{ x: boardSheenX }}
                    />
                    <motion.div
                      className={styles.scanBeam}
                      style={{ top: scanBeamY, opacity: scanBeamOpacity }}
                    />
                  </div>
                </>
              )}

              <div className={styles.boardHeader}>
                <div className={styles.boardHeaderLeft}>
                  <span className={styles.boardSquare} aria-hidden="true" />
                  <span className={styles.boardTitle}>{organizationName} · Q3 Workplan</span>
                </div>
                <div className={styles.boardHeaderRight}>
                  <span
                    className={`${styles.boardChip} ${styles.tabular} ${
                      columnCounts.done === PROJECTS.length ? styles.boardChipSealed : ""
                    }`}
                  >
                    {columnCounts.done === PROJECTS.length
                      ? "6 / 6 Completed ✓"
                      : "FY 2026 · 6 Tasks"}
                  </span>
                </div>
              </div>

              {/* 3-Column Stage + Local-Space Animated Magnetic Cards */}
              <div ref={gridStageRef} className={styles.boardGridStage}>
                <div className={styles.boardColumns}>
                  {COLUMNS.map((col) => {
                    const count = columnCounts[col.id];
                    const isDoneCol = col.id === "done";
                    const isDropTarget = draggingCardId !== null && hoveredColumnId === col.id;
                    const staticColCards = staticLayout
                      ? PROJECTS.filter((p) => activeMapping[p.id] === col.id)
                      : [];

                    return (
                      <div
                        key={col.id}
                        ref={(el) => {
                          columnRefs.current[col.id] = el;
                        }}
                        className={`${styles.boardCol} ${
                          isDropTarget ? styles.boardColDropTarget : ""
                        }`}
                      >
                        <div className={styles.boardColHead}>
                          <span>{col.label}</span>
                          <span
                            className={`${styles.boardColCount} ${styles.tabular} ${
                              isDoneCol && count === PROJECTS.length
                                ? styles.boardColCountDone
                                : ""
                            }`}
                          >
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={count}
                                initial={staticLayout ? false : { y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={staticLayout ? undefined : { y: 10, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                              >
                                {count}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                        </div>

                        {staticLayout && (
                          <div className={styles.taskCardStaticList}>
                            {staticColCards.map((card) => (
                              <div
                                key={card.id}
                                className={`${styles.taskCard} ${styles.taskCardStatic} ${styles.taskCardDone}`}
                              >
                                <div className={styles.taskCardHead}>
                                  <span className={styles.taskTitle}>{card.title}</span>
                                  <span className={`${styles.taskBudget} ${styles.tabular}`}>
                                    {card.budgetLabel}
                                  </span>
                                </div>
                                <div className={styles.progressTrack}>
                                  <div className={styles.progressBar} style={{ width: "100%" }} />
                                </div>
                                <div className={styles.taskFoot}>
                                  <span className={`${styles.statusBadge} ${styles.badgeDone}`}>
                                    <Check size={11} aria-hidden="true" />
                                    <span>Completed</span>
                                  </span>
                                  <div className={styles.avatarStack} aria-hidden="true">
                                    <span className={styles.avatarChip}>{card.avatars[0]}</span>
                                    <span className={styles.avatarChip}>{card.avatars[1]}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Local-Space Card Layer: Cards stay permanently mounted & glide smoothly via x/y */}
                {!staticLayout && (
                  <div className={styles.boardCardsLayer}>
                    {PROJECTS.map((card) => {
                      const pos = cardCoords[card.id];
                      const isTodo = pos.colId === "todo";
                      const isProgress = pos.colId === "in_progress";
                      const isDone = pos.colId === "done";
                      const progressPct = isTodo ? 24 : isProgress ? 66 : 100;
                      const statusText = isTodo
                        ? "Queued"
                        : isProgress
                          ? "In Progress"
                          : "Completed";

                      const isThisDragging = draggingCardId === card.id;
                      const isThisSettling = settlingCardId === card.id;

                      return (
                        <motion.div
                          key={card.id}
                          className={styles.taskCardSlot}
                          style={{
                            width: cardWidth,
                            zIndex: isThisDragging ? 90 : isThisSettling ? 40 : 2,
                          }}
                          initial={false}
                          animate={{ x: pos.x, y: pos.y }}
                          transition={CARD_SLOT_SPRING}
                        >
                          <motion.div
                            className={`${styles.taskCard} ${
                              isTodo
                                ? styles.taskCardTodo
                                : isProgress
                                  ? styles.taskCardProgress
                                  : styles.taskCardDone
                            } ${canDragCards ? styles.taskCardDraggable : ""} ${
                              isThisDragging ? styles.taskCardDragging : ""
                            }`}
                            style={
                              isThisDragging || isThisSettling
                                ? { x: dragOffsetX, y: dragOffsetY }
                                : undefined
                            }
                            animate={
                              isThisDragging
                                ? { scale: 1.045, rotate: 1.3 }
                                : { scale: 1, rotate: 0 }
                            }
                            whileHover={
                              canDragCards && !isThisDragging
                                ? { scale: 1.015, y: -2 }
                                : undefined
                            }
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                            onPointerDown={(e) => handleCardPointerDown(card.id, e)}
                          >
                            <div className={styles.taskCardHead}>
                              <span className={styles.taskTitle}>{card.title}</span>
                              <div className={styles.taskHeadRight}>
                                <span className={`${styles.taskBudget} ${styles.tabular}`}>
                                  {card.budgetLabel}
                                </span>
                                {canDragCards && (
                                  <span
                                    className={styles.taskDragHandle}
                                    title="Drag to move task"
                                    aria-hidden="true"
                                  >
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                    >
                                      <circle cx="5" cy="3" r="1.5" />
                                      <circle cx="11" cy="3" r="1.5" />
                                      <circle cx="5" cy="8" r="1.5" />
                                      <circle cx="11" cy="8" r="1.5" />
                                      <circle cx="5" cy="13" r="1.5" />
                                      <circle cx="11" cy="13" r="1.5" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div
                              className={`${styles.progressTrack} ${
                                isProgress ? styles.progressTrackAmber : ""
                              }`}
                            >
                              <motion.div
                                className={`${styles.progressBar} ${
                                  isTodo
                                    ? styles.progressBarMuted
                                    : isProgress
                                      ? styles.progressBarAmber
                                      : ""
                                }`}
                                initial={false}
                                animate={{ scaleX: progressPct / 100 }}
                                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                              />
                            </div>

                            <div className={styles.taskFoot}>
                              <span
                                className={`${styles.statusBadge} ${
                                  isTodo
                                    ? styles.badgeTodo
                                    : isProgress
                                      ? styles.badgeProgress
                                      : styles.badgeDone
                                }`}
                              >
                                {isDone && (
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    aria-hidden="true"
                                  >
                                    <motion.path
                                      d="M3.2 8.4L6.6 11.8L13 4.8"
                                      stroke="currentColor"
                                      strokeWidth="2.2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      initial={{ pathLength: 0 }}
                                      animate={{ pathLength: 1 }}
                                      transition={{ duration: 0.32, ease: "easeOut" }}
                                    />
                                  </svg>
                                )}
                                <span>{statusText}</span>
                              </span>
                              <div className={styles.avatarStack} aria-hidden="true">
                                <span className={styles.avatarChip}>{card.avatars[0]}</span>
                                <span className={styles.avatarChip}>{card.avatars[1]}</span>
                              </div>
                            </div>
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ================================================================
            SWISS-INDUSTRIAL FROSTED-GLASS & STEEL VAULT LOCK (ZERO TEXT, ZERO CLIPART)
           ================================================================ */}
        <motion.div
          className={styles.lockOverlay}
          style={
            staticLayout
              ? undefined
              : {
                  opacity: lockOpacity,
                  scale: lockScale,
                }
          }
          aria-hidden="true"
        >
          <div className={styles.lockVisualWrap}>
            {!staticLayout && (
              <>
                <motion.div
                  className={styles.lockBrackets}
                  style={{ scale: bracketScale, opacity: bracketOpacity }}
                >
                  <span className={`${styles.lockBracket} ${styles.lbTL}`} />
                  <span className={`${styles.lockBracket} ${styles.lbTR}`} />
                  <span className={`${styles.lockBracket} ${styles.lbBL}`} />
                  <span className={`${styles.lockBracket} ${styles.lbBR}`} />
                </motion.div>
                <motion.div
                  className={styles.lockRingPulse}
                  style={{ scale: ringPulseScale, opacity: ringPulseOpacity }}
                />
                <motion.div
                  className={styles.lockRingOuter}
                  style={{ scale: ringPulseScale, opacity: ringPulseOpacity }}
                />
              </>
            )}

            <svg
              viewBox="0 0 280 300"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={styles.lockSvg}
            >
              <defs>
                <linearGradient id="vaultShackleMetal" x1="88" y1="30" x2="192" y2="155" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="45%" stopColor="#c9ddff" />
                  <stop offset="100%" stopColor="#637db3" />
                </linearGradient>

                <linearGradient id="vaultChassisFill" x1="48" y1="116" x2="232" y2="272" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1b2c63" stopOpacity="0.94" />
                  <stop offset="48%" stopColor="#0e1945" stopOpacity="0.96" />
                  <stop offset="100%" stopColor="#070d24" stopOpacity="0.98" />
                </linearGradient>

                <linearGradient id="vaultRimStroke" x1="48" y1="116" x2="232" y2="272" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={lockShut || staticLayout ? "0.95" : "0.55"} />
                  <stop offset="45%" stopColor="#94baff" stopOpacity={lockShut || staticLayout ? "0.7" : "0.35"} />
                  <stop offset="100%" stopColor="#2c3d6e" stopOpacity="0.65" />
                </linearGradient>

                <radialGradient id="vaultCoreWell" cx="50%" cy="42%" r="60%">
                  <stop offset="0%" stopColor="#1d3274" />
                  <stop offset="70%" stopColor="#0a1232" />
                  <stop offset="100%" stopColor="#05091a" />
                </radialGradient>

                <clipPath id="vaultBodyClip">
                  <rect x="48" y="116" width="184" height="154" rx="22" />
                </clipPath>
              </defs>

              {/* Brushed Steel Shackle */}
              <motion.g
                style={
                  staticLayout
                    ? undefined
                    : {
                        y: shackleY,
                        rotate: shackleRotate,
                        transformOrigin: "188px 132px",
                        transformBox: "view-box",
                      }
                }
              >
                <path
                  d="M92 120V82C92 55.4903 113.49 34 140 34C166.51 34 188 55.4903 188 82V162"
                  stroke="url(#vaultShackleMetal)"
                  strokeWidth="15"
                  strokeLinecap="round"
                />
                <path
                  d="M92 120V82C92 55.4903 113.49 34 140 34C166.51 34 188 55.4903 188 82V162"
                  stroke="#0a1028"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeOpacity="0.28"
                />
              </motion.g>

              {/* Recessed steel shackle socket collars */}
              <rect x="80" y="110" width="24" height="10" rx="3" fill="#233673" stroke="#94baff" strokeOpacity="0.45" strokeWidth="1" />
              <rect x="176" y="110" width="24" height="10" rx="3" fill="#233673" stroke="#94baff" strokeOpacity="0.45" strokeWidth="1" />

              {/* Frosted Smoked-Navy Architectural Vault Body */}
              <rect
                x="48"
                y="116"
                width="184"
                height="154"
                rx="22"
                fill="url(#vaultChassisFill)"
                stroke="url(#vaultRimStroke)"
                strokeWidth="2"
              />

              <line
                x1="68"
                y1="118.5"
                x2="212"
                y2="118.5"
                stroke="#ffffff"
                strokeOpacity="0.35"
                strokeWidth="1"
                strokeLinecap="round"
              />

              <g clipPath="url(#vaultBodyClip)">
                {!staticLayout && (
                  <motion.polygon
                    points="60,105 110,105 40,285 -10,285"
                    fill="#ffffff"
                    fillOpacity="0.14"
                    style={{ x: lockSheenX }}
                  />
                )}
              </g>

              {/* Micro corner precision fasteners */}
              <circle cx="64" cy="132" r="2.2" fill="#94baff" fillOpacity="0.36" />
              <circle cx="216" cy="132" r="2.2" fill="#94baff" fillOpacity="0.36" />
              <circle cx="64" cy="254" r="2.2" fill="#94baff" fillOpacity="0.36" />
              <circle cx="216" cy="254" r="2.2" fill="#94baff" fillOpacity="0.36" />

              {/* Machined Precision Rotary Tumbler Ring */}
              <circle
                cx="140"
                cy="193"
                r="44"
                fill="url(#vaultCoreWell)"
                stroke={lockShut || staticLayout ? "#94baff" : "#384d85"}
                strokeWidth="1.5"
              />
              <circle
                cx="140"
                cy="193"
                r="36"
                fill="none"
                stroke="#94baff"
                strokeOpacity={lockShut || staticLayout ? "0.62" : "0.26"}
                strokeWidth="1.5"
                strokeDasharray="2 7"
              />

              <motion.g
                style={
                  staticLayout
                    ? undefined
                    : {
                        rotate: tumblerRotate,
                        transformOrigin: "140px 193px",
                        transformBox: "view-box",
                      }
                }
              >
                <circle
                  cx="140"
                  cy="193"
                  r="24"
                  fill="#0d1844"
                  stroke={lockShut || staticLayout ? "#ffffff" : "#94baff"}
                  strokeWidth="1.6"
                  strokeOpacity={lockShut || staticLayout ? "0.95" : "0.6"}
                />
                <rect
                  x="136.5"
                  y="175"
                  width="7"
                  height="36"
                  rx="3.5"
                  fill={lockShut || staticLayout ? "#ffffff" : "#94baff"}
                />
                <circle cx="140" cy="193" r="3" fill="#00006b" />
              </motion.g>

              {/* Micro status LED */}
              <circle
                cx="140"
                cy="135"
                r="3.2"
                fill={lockShut || staticLayout ? "#ffffff" : "#4a629c"}
              />
              {(lockShut || staticLayout) && (
                <circle cx="140" cy="135" r="7.5" fill="#94baff" fillOpacity="0.28" />
              )}
            </svg>
          </div>
        </motion.div>

        {/* ================================================================
            LIVE ANIMATED PUBLIC VIEW TRANSPARENCY TABLE
           ================================================================ */}
        <motion.div
          className={styles.publicViewOverlay}
          style={
            staticLayout
              ? undefined
              : {
                  opacity: publicOpacity,
                  y: publicY,
                  scale: publicScale,
                  pointerEvents: publicVisible ? "auto" : "none",
                }
          }
        >
          <div className={styles.publicTableStageWrap}>
            {!staticLayout && publicVisible && (
              <motion.div
                className={`${styles.siphonBoardHalo} ${styles.siphonBoardHaloLight}`}
                style={{ opacity: siphonTableGlow }}
                aria-hidden="true"
              />
            )}
            <div
              ref={publicTableRef}
              className={styles.publicTableShell}
              role="region"
              aria-label="Public View transparency table"
            >
              {!staticLayout && publicVisible && (
                <>
                  <motion.div
                    className={`${styles.siphonRimHighlight} ${styles.siphonRimHighlightLight}`}
                    style={{ opacity: siphonTableGlow }}
                    aria-hidden="true"
                  />
                  <motion.div
                    className={`${styles.siphonBorderOrbit} ${styles.siphonBorderOrbitLight}`}
                    style={{ opacity: siphonTableGlow }}
                    aria-hidden="true"
                  >
                    <div className={styles.siphonBorderOrbitSpinner} />
                  </motion.div>
                  <div className={styles.boardEffectsClip} aria-hidden="true">
                    <motion.div
                      className={`${styles.siphonRestingVeil} ${styles.siphonRestingVeilLight}`}
                      style={{ opacity: siphonRestingVeilOpacity }}
                    />
                    <motion.div
                      className={`${styles.siphonSurfaceCrown} ${styles.siphonSurfaceCrownLight}`}
                      style={{ opacity: siphonTableGlow }}
                    />
                    <motion.div
                      className={styles.siphonSurfaceSweep}
                      style={{ opacity: siphonTableGlow, x: siphonSweepPct }}
                    />
                  </div>
                </>
              )}
            <div className={styles.publicHeader}>
              <div className={styles.publicHeaderLeft}>
                <span className={styles.boardSquare} aria-hidden="true" />
                <span className={styles.publicTitle}>
                  {organizationName} · Public View
                </span>
              </div>

              <div className={styles.publicHeaderStats}>
                <div className={styles.publicStat}>
                  <span className={styles.publicStatLabel}>Total Budget</span>
                  <span className={`${styles.publicStatValue} ${styles.tabular}`}>
                    {formatPhp(displayedBudget)}
                  </span>
                </div>
                <div className={styles.publicStat}>
                  <span className={styles.publicStatLabel}>Completed</span>
                  <span className={`${styles.publicStatValue} ${styles.tabular}`}>6 / 6</span>
                </div>
              </div>
            </div>

            <div className={styles.publicTableScroll}>
              <LayoutGroup id="public-table-hover">
                <table
                  className={styles.publicTable}
                  onMouseLeave={() => setHoveredRowId(null)}
                >
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Budget</th>
                      <th>Progress</th>
                      <th>Date</th>
                      <th>Record</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROJECTS.map((row, idx) => {
                      const isHovered = hoveredRowId === row.id;
                      return (
                        <motion.tr
                          key={row.id}
                          className={`${styles.publicRow} ${
                            isHovered ? styles.publicRowHovered : ""
                          }`}
                          tabIndex={0}
                          role="button"
                          aria-label={`Inspect verified record for ${row.title}`}
                          onMouseEnter={() => setHoveredRowId(row.id)}
                          onClick={() => setSelectedRecord(row)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedRecord(row);
                            }
                          }}
                          initial={staticLayout ? false : { opacity: 0, y: 16 }}
                          animate={
                            publicVisible || staticLayout
                              ? { opacity: 1, y: 0 }
                              : { opacity: 0, y: 16 }
                          }
                          transition={{
                            duration: 0.46,
                            delay: publicVisible ? 0.08 + idx * 0.075 : 0,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <td>
                            {isHovered && !staticLayout && (
                              <motion.span
                                layoutId="public-row-indicator"
                                className={styles.rowActiveBar}
                                transition={{ type: "spring", stiffness: 460, damping: 34 }}
                                aria-hidden="true"
                              />
                            )}
                            <div className={styles.rowProjectName}>{row.title}</div>
                            <div className={styles.rowProjectSub}>{row.code}</div>
                          </td>
                          <td className={`${styles.rowAmount} ${styles.tabular}`}>
                            {row.budgetLabel}
                          </td>
                          <td>
                            <div className={styles.rowProgressWrap}>
                              <div className={styles.rowProgressBarBg}>
                                <motion.div
                                  className={styles.rowProgressBarFill}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: publicVisible || staticLayout ? 1 : 0 }}
                                  transition={{
                                    duration: 0.48,
                                    delay: publicVisible ? 0.1 + idx * 0.06 : 0,
                                    ease: [0.22, 1, 0.36, 1],
                                  }}
                                  style={{ transformOrigin: "left center" }}
                                />
                              </div>
                              <span className={`${styles.rowPct} ${styles.tabular}`}>100%</span>
                            </div>
                          </td>
                          <td className={styles.tabular}>{row.sealedDate}</td>
                          <td>
                            <span className={styles.rowHash}>
                              <Lock size={11} aria-hidden="true" />
                              <span>{row.hashShort}</span>
                            </span>
                          </td>
                          <td>
                            <span className={styles.rowStatusSealed}>
                              <Check size={12} aria-hidden="true" />
                              <span>Verified</span>
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </LayoutGroup>
            </div>

            {/* Interactive Sealed Public Record Inspector (opens cleanly when clicking any row) */}
            <AnimatePresence>
              {selectedRecord && (
                <motion.div
                  className={styles.recordInspectorBackdrop}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setSelectedRecord(null)}
                >
                  <motion.div
                    className={styles.recordInspectorSheet}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Verified record ${selectedRecord.code}`}
                    initial={{ opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className={styles.recordSheetTop}>
                      <div className={styles.recordSheetStamp}>
                        <span className={styles.boardSquare} aria-hidden="true" />
                        <span>{organizationName} · VERIFIED PUBLIC RECORD</span>
                      </div>
                      <button
                        type="button"
                        className={styles.recordSheetClose}
                        onClick={() => setSelectedRecord(null)}
                        aria-label="Close verified record"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>

                    <div className={styles.recordSheetHeading}>
                      <h3 className={styles.recordSheetTitle}>{selectedRecord.title}</h3>
                      <span className={`${styles.recordSheetCode} ${styles.tabular}`}>
                        {selectedRecord.code} · Sealed {selectedRecord.sealedDate}
                      </span>
                    </div>

                    <div className={styles.recordLedgerGrid}>
                      <div className={styles.recordLedgerCell}>
                        <span className={styles.recordLedgerLabel}>Approved Budget</span>
                        <strong className={`${styles.recordLedgerVal} ${styles.tabular}`}>
                          {selectedRecord.budgetLabel}
                        </strong>
                      </div>
                      <div className={styles.recordLedgerCell}>
                        <span className={styles.recordLedgerLabel}>Liquidated Receipts</span>
                        <strong className={`${styles.recordLedgerVal} ${styles.tabular}`}>
                          {selectedRecord.budgetLabel}
                        </strong>
                      </div>
                      <div className={styles.recordLedgerCell}>
                        <span className={styles.recordLedgerLabel}>Unaccounted</span>
                        <strong className={`${styles.recordLedgerVal} ${styles.tabular}`}>
                          ₱0.00
                        </strong>
                      </div>
                    </div>

                    <div className={styles.recordGatesRow}>
                      {[
                        { step: "01", role: "Project Lead", actor: selectedRecord.leadName },
                        { step: "02", role: "Office Head", actor: "Certified" },
                        { step: "03", role: "Accounting", actor: "Settled" },
                      ].map((gate, i) => (
                        <motion.div
                          key={gate.step}
                          className={styles.recordGateStep}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.26,
                            delay: 0.06 + i * 0.065,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <div className={styles.recordGateHead}>
                            <span className={`${styles.recordGateIdx} ${styles.tabular}`}>
                              {gate.step}
                            </span>
                            <span className={styles.recordGateCheck} aria-hidden="true">
                              <Check size={11} />
                            </span>
                          </div>
                          <span className={styles.recordGateRole}>{gate.role}</span>
                          <span className={styles.recordGateActor}>{gate.actor}</span>
                        </motion.div>
                      ))}
                    </div>

                    <div className={styles.recordHashBar}>
                      <span className={styles.recordHashLabel}>
                        <Lock size={11} aria-hidden="true" />
                        <span>SHA-256 SEAL</span>
                      </span>
                      <code className={styles.recordHashFull}>{selectedRecord.hashFull}</code>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
});
