import { memo, useEffect, useRef, type RefObject } from "react";
import type { MotionValue } from "motion/react";
import styles from "../LandingPage.module.scss";

export interface PointerTrackerState {
  x: number;
  y: number;
  inside: boolean;
  lastMoveAt: number;
  leftAt: number;
  hasMoved: boolean;
}

interface LightSiphonCanvasProps {
  stageRef: RefObject<HTMLDivElement | null>;
  boardSlabRef: RefObject<HTMLDivElement | null>;
  publicTableRef: RefObject<HTMLDivElement | null>;
  pointerStateRef: RefObject<PointerTrackerState>;
  isLight: boolean;
  isRevealReady: boolean;
  publicVisible: boolean;
  staticLayout: boolean;
  trailsEnabled: boolean;
  boardCharge: MotionValue<number>;
}

interface TrailPoint {
  x: number;
  y: number;
}

interface LivingOrb {
  /** Persistent state:
   * - "cursor": physically chases & orbits the live cursor anywhere on screen (never resets!)
   * - "toBoard": peeling off into a curved arc toward the board/table on AFK
   * - "toCursor": peeling out from the lit board/table into homing pursuit of the cursor
   */
  phase: "cursor" | "toBoard" | "toCursor";
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Gentle personal orbital offset around the cursor */
  orbitAngle: number;
  orbitSpeed: number;
  orbitRx: number;
  orbitRy: number;
  orbitPhase: number;
  /** Transfer curve parameters (used only while phase === "toBoard" or "toCursor") */
  startX: number;
  startY: number;
  boardRelX: number;
  boardRelY: number;
  arcOffset: number;
  waveAmp: number;
  wavePhase: number;
  delayMs: number;
  elapsedMs: number;
  durationMs: number;
  /** Visual character */
  radius: number;
  spinAngle: number;
  spinSpeed: number;
  brightness: number;
  trail: TrailPoint[];
  absorbed: boolean;
}

interface ImpactFlare {
  x: number;
  y: number;
  ageMs: number;
  durationMs: number;
  maxRadius: number;
  alpha: number;
  angle: number;
  spinSpeed: number;
}

interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const AFK_THRESHOLD_MS = 3200;
const LEAVE_GRACE_MS = 1600;
const INITIAL_DEMO_SIPHON_DELAY_MS = 1800;

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function pickBoardAnchorRel(): { relX: number; relY: number } {
  const roll = Math.random();
  if (roll < 0.27) return { relX: randomRange(0.06, 0.94), relY: randomRange(0.0, 0.04) };
  if (roll < 0.52) return { relX: randomRange(0.0, 0.04), relY: randomRange(0.08, 0.92) };
  if (roll < 0.74) return { relX: randomRange(0.06, 0.94), relY: randomRange(0.96, 1.0) };
  if (roll < 0.9) return { relX: randomRange(0.96, 1.0), relY: randomRange(0.08, 0.92) };
  return { relX: randomRange(0.18, 0.82), relY: randomRange(0.18, 0.82) };
}

/** Pick varied organic star sizes each time (mix of tiny sparkles, medium diamond stars, and bright accent stars) */
function pickRandomStarSize(): number {
  const roll = Math.random();
  if (roll < 0.36) return randomRange(7.5, 11.0);
  if (roll < 0.8) return randomRange(11.5, 16.5);
  return randomRange(17.5, 23.0);
}

/** Pre-render a crisp 4-point concave diamond star sprite ONCE offscreen so every frame is a fast rotated drawImage() blit */
function createStarSprite(lightTheme: boolean): HTMLCanvasElement {
  const size = 96;
  const half = size / 2;
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const octx = off.getContext("2d");
  if (!octx) return off;

  // Delicate luminous halo behind the star (soft enough to keep the 4-point diamond silhouette razor-crisp)
  const glowR = half * 0.92;
  const grad = octx.createRadialGradient(half, half, 0, half, half, glowR);
  if (lightTheme) {
    grad.addColorStop(0, "rgba(255, 255, 255, 0.55)");
    grad.addColorStop(0.32, "rgba(56, 128, 232, 0.28)");
    grad.addColorStop(0.68, "rgba(0, 0, 107, 0.08)");
    grad.addColorStop(1, "rgba(0, 0, 107, 0)");
  } else {
    grad.addColorStop(0, "rgba(255, 255, 255, 0.58)");
    grad.addColorStop(0.3, "rgba(186, 220, 255, 0.3)");
    grad.addColorStop(0.65, "rgba(96, 162, 255, 0.09)");
    grad.addColorStop(1, "rgba(64, 124, 255, 0)");
  }
  octx.fillStyle = grad;
  octx.beginPath();
  octx.arc(half, half, glowR, 0, Math.PI * 2);
  octx.fill();

  const drawFourPointStar = (tipR: number, pinch: number, fillStyle: string, shadowColor?: string) => {
    octx.save();
    if (shadowColor) {
      octx.shadowBlur = 10;
      octx.shadowColor = shadowColor;
    }
    octx.fillStyle = fillStyle;
    octx.beginPath();
    octx.moveTo(half, half - tipR);
    octx.quadraticCurveTo(half + pinch, half - pinch, half + tipR, half);
    octx.quadraticCurveTo(half + pinch, half + pinch, half, half + tipR);
    octx.quadraticCurveTo(half - pinch, half + pinch, half - tipR, half);
    octx.quadraticCurveTo(half - pinch, half - pinch, half, half - tipR);
    octx.closePath();
    octx.fill();
    octx.restore();
  };

  // Sharp concave 4-point diamond star silhouette
  const starR = half * 0.72;
  const pinch = starR * 0.14;
  if (lightTheme) {
    drawFourPointStar(starR, pinch, "rgba(26, 84, 184, 0.96)", "rgba(56, 128, 232, 0.65)");
    drawFourPointStar(starR * 0.52, pinch * 0.55, "rgba(255, 255, 255, 0.96)");
  } else {
    drawFourPointStar(starR, pinch, "#ffffff", "rgba(186, 220, 255, 0.92)");
  }

  return off;
}

/** Pre-render the soft ambient cursor aura once offscreen */
function createAuraSprite(lightTheme: boolean): HTMLCanvasElement {
  const size = 256;
  const half = size / 2;
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const octx = off.getContext("2d");
  if (!octx) return off;

  const grad = octx.createRadialGradient(half, half, 0, half, half, half);
  if (lightTheme) {
    grad.addColorStop(0, "rgba(56, 128, 232, 0.18)");
    grad.addColorStop(0.38, "rgba(39, 103, 167, 0.08)");
    grad.addColorStop(1, "rgba(39, 103, 167, 0)");
  } else {
    grad.addColorStop(0, "rgba(218, 234, 255, 0.22)");
    grad.addColorStop(0.3, "rgba(148, 186, 255, 0.13)");
    grad.addColorStop(0.62, "rgba(68, 124, 240, 0.05)");
    grad.addColorStop(1, "rgba(10, 16, 40, 0)");
  }
  octx.fillStyle = grad;
  octx.fillRect(0, 0, size, size);
  return off;
}

function createOrb(
  phase: "cursor" | "toBoard" | "toCursor",
  x: number,
  y: number,
  index: number,
  total: number,
): LivingOrb {
  const anchor = pickBoardAnchorRel();
  const sign = (index % 2 === 0 ? 1 : -1) * (Math.random() < 0.25 ? -1 : 1);
  return {
    phase,
    x,
    y,
    vx: 0,
    vy: 0,
    orbitAngle: (index / Math.max(1, total)) * Math.PI * 2 + randomRange(-0.35, 0.35),
    orbitSpeed: randomRange(0.16, 0.34) * (index % 2 === 0 ? 1 : -1),
    orbitRx: randomRange(22, 62),
    orbitRy: randomRange(18, 52),
    orbitPhase: randomRange(0, Math.PI * 2),
    startX: x,
    startY: y,
    boardRelX: anchor.relX,
    boardRelY: anchor.relY,
    arcOffset: sign * randomRange(70, 200),
    waveAmp: randomRange(10, 26),
    wavePhase: randomRange(0, Math.PI * 2),
    delayMs:
      phase === "toBoard"
        ? (index / Math.max(1, total)) * 1800 + randomRange(0, 480)
        : phase === "toCursor"
          ? (index / Math.max(1, total)) * 900 + randomRange(0, 320)
          : 0,
    elapsedMs: 0,
    durationMs:
      phase === "toBoard"
        ? randomRange(2800, 4200)
        : phase === "toCursor"
          ? randomRange(1750, 2650)
          : 0,
    radius: pickRandomStarSize(),
    spinAngle: randomRange(0, Math.PI * 2),
    spinSpeed: randomRange(0.75, 2.2) * (Math.random() < 0.5 ? 1 : -1),
    brightness: randomRange(0.74, 1.0),
    trail: [{ x, y }],
    absorbed: false,
  };
}

export const LightSiphonCanvas = memo(function LightSiphonCanvas({
  stageRef,
  boardSlabRef,
  publicTableRef,
  pointerStateRef,
  isLight,
  isRevealReady,
  publicVisible,
  staticLayout,
  trailsEnabled,
  boardCharge,
}: LightSiphonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ isLight, isRevealReady, publicVisible, trailsEnabled });
  propsRef.current = { isLight, isRevealReady, publicVisible, trailsEnabled };

  useEffect(() => {
    if (staticLayout) return;
    const canvas = canvasRef.current;
    const stageEl = stageRef.current;
    if (!canvas || !stageEl) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // Pre-rendered diamond star & aura sprites (zero per-frame createRadialGradient allocations!)
    const starSpriteDark = createStarSprite(false);
    const starSpriteLight = createStarSprite(true);
    const auraSpriteDark = createAuraSprite(false);
    const auraSpriteLight = createAuraSprite(true);

    let width = stageEl.clientWidth || window.innerWidth;
    let height = stageEl.clientHeight || window.innerHeight;
    // Soft glowing light looks identical at <=1.25 DPR while cutting canvas fill-rate by 2.5-4x
    let dpr = Math.min(window.devicePixelRatio || 1, 1.25);

    let cachedBoardRect: RectBox = {
      left: width * 0.46,
      top: height * 0.2,
      width: width * 0.45,
      height: height * 0.58,
    };
    let lastRectSyncAt = 0;
    let lastPublicVisible = propsRef.current.publicVisible;

    const measureBoardRect = (now: number) => {
      lastRectSyncAt = now;
      const stageRect = stageEl.getBoundingClientRect();
      const targetEl = propsRef.current.publicVisible
        ? publicTableRef.current
        : boardSlabRef.current;
      if (targetEl) {
        const r = targetEl.getBoundingClientRect();
        if (r.width > 60 && r.height > 60) {
          cachedBoardRect = {
            left: r.left - stageRect.left,
            top: r.top - stageRect.top,
            width: r.width,
            height: r.height,
          };
          return;
        }
      }
      cachedBoardRect = {
        left: width * 0.46,
        top: height * 0.2,
        width: width * 0.45,
        height: height * 0.58,
      };
    };

    const resize = () => {
      width = stageEl.clientWidth || window.innerWidth;
      height = stageEl.clientHeight || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      measureBoardRect(performance.now());
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(stageEl);

    let cursorX = width * 0.34;
    let cursorY = height * 0.48;
    let mode: "cursor" | "board" = "cursor";
    let revealStartedAt: number | null = null;

    let cursorEnergy = 1;
    let displayCharge = 0;
    let targetCharge = 0;
    let batchTotal = 1;
    let batchCompleted = 0;
    let canvasIsClean = false;

    // Start with a persistent organic cluster of orbs around the initial hero area
    const initialCount = 9;
    let orbs: LivingOrb[] = Array.from({ length: initialCount }, (_, i) =>
      createOrb(
        "cursor",
        cursorX + randomRange(-40, 40),
        cursorY + randomRange(-40, 40),
        i,
        initialCount,
      ),
    );
    let flares: ImpactFlare[] = [];

    const sendOrbsToBoard = (now: number) => {
      measureBoardRect(now);
      // Randomize a fresh count (8..14) smoothly without teleporting existing live orbs
      const desiredCount = 8 + Math.floor(Math.random() * 7);
      const nextOrbs: LivingOrb[] = [];

      for (let i = 0; i < orbs.length; i++) {
        const orb = orbs[i];
        if (orb.absorbed) continue;
        const anchor = pickBoardAnchorRel();
        const sign = (i % 2 === 0 ? 1 : -1) * (Math.random() < 0.25 ? -1 : 1);
        orb.phase = "toBoard";
        orb.startX = orb.x;
        orb.startY = orb.y;
        orb.boardRelX = anchor.relX;
        orb.boardRelY = anchor.relY;
        orb.arcOffset = sign * randomRange(70, 200);
        orb.delayMs = (i / Math.max(1, desiredCount)) * 1800 + randomRange(0, 460);
        orb.elapsedMs = 0;
        orb.durationMs = randomRange(2800, 4200);
        orb.radius = pickRandomStarSize();
        orb.spinSpeed = randomRange(0.85, 2.35) * (Math.random() < 0.5 ? 1 : -1);
        orb.absorbed = false;
        nextOrbs.push(orb);
        if (nextOrbs.length >= desiredCount) break;
      }

      while (nextOrbs.length < desiredCount) {
        const idx = nextOrbs.length;
        const spawned = createOrb(
          "toBoard",
          cursorX + randomRange(-36, 36),
          cursorY + randomRange(-36, 36),
          idx,
          desiredCount,
        );
        nextOrbs.push(spawned);
      }

      orbs = nextOrbs;
      batchTotal = Math.max(1, orbs.length);
      batchCompleted = 0;
    };

    const recallOrbsToCursor = (now: number) => {
      measureBoardRect(now);
      const liveOrbs = orbs.filter((o) => !o.absorbed);

      // If orbs are STILL actively orbiting or flying mid-air, smoothly turn them around to hunt the cursor — NEVER reset!
      if (liveOrbs.length >= 6) {
        for (const orb of liveOrbs) {
          orb.phase = "cursor";
          orb.absorbed = false;
        }
        orbs = liveOrbs;
        batchTotal = Math.max(1, orbs.length);
        batchCompleted = orbs.length;
        return;
      }

      // Otherwise orbs were absorbed into the lit board — spawn a fresh random batch peeling smoothly out of the board!
      const desiredCount = 8 + Math.floor(Math.random() * 7);
      const nextOrbs: LivingOrb[] = [];

      // Keep any still-visible orbs without popping
      for (const orb of liveOrbs) {
        orb.phase = "cursor";
        orb.absorbed = false;
        nextOrbs.push(orb);
      }

      const toEmerge = Math.max(0, desiredCount - nextOrbs.length);
      for (let i = 0; i < toEmerge; i++) {
        const anchor = pickBoardAnchorRel();
        const sx = cachedBoardRect.left + anchor.relX * cachedBoardRect.width;
        const sy = cachedBoardRect.top + anchor.relY * cachedBoardRect.height;
        const emerged = createOrb("toCursor", sx, sy, i, toEmerge);
        emerged.boardRelX = anchor.relX;
        emerged.boardRelY = anchor.relY;
        nextOrbs.push(emerged);
      }

      orbs = nextOrbs;
      batchTotal = Math.max(1, toEmerge);
      batchCompleted = 0;
    };

    /** Draw a sleek 3-tier tapered luminous white trail (crisp & fluid, zero stepped bluntness) */
    const drawBatchedTrail = (
      trail: TrailPoint[],
      starSize: number,
      alpha: number,
      lightTheme: boolean,
    ) => {
      const len = trail.length;
      if (len < 3 || alpha <= 0.015) return;

      const split1 = Math.max(1, Math.floor(len * 0.36));
      const split2 = Math.max(split1 + 1, Math.floor(len * 0.72));
      const baseWidth = Math.min(2.6, Math.max(1.0, starSize * 0.135));
      const tailRgb = lightTheme ? "56, 128, 232" : "220, 236, 255";
      const coreRgb = lightTheme ? "34, 96, 196" : "255, 255, 255";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // 1. Faint wispy tail end
      ctx.strokeStyle = `rgba(${tailRgb}, ${alpha * (lightTheme ? 0.14 : 0.18)})`;
      ctx.lineWidth = Math.max(0.55, baseWidth * 0.42);
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i <= split1; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();

      // 2. Smooth glowing mid ribbon
      ctx.strokeStyle = `rgba(${tailRgb}, ${alpha * (lightTheme ? 0.32 : 0.44)})`;
      ctx.lineWidth = Math.max(0.85, baseWidth * 0.74);
      ctx.beginPath();
      ctx.moveTo(trail[split1].x, trail[split1].y);
      for (let i = split1 + 1; i <= split2; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();

      // 3. Crisp bright white head streak leading smoothly into the spinning star
      ctx.strokeStyle = `rgba(${coreRgb}, ${alpha * (lightTheme ? 0.56 : 0.78)})`;
      ctx.lineWidth = baseWidth;
      ctx.beginPath();
      ctx.moveTo(trail[split2].x, trail[split2].y);
      for (let i = split2 + 1; i < len; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();
    };

    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      rafId = window.requestAnimationFrame(frame);

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        lastTime = now;
        return;
      }

      const dt = Math.min(48, Math.max(4, now - lastTime));
      lastTime = now;
      const dtSec = dt / 1000;

      const {
        isLight: lightTheme,
        isRevealReady: revealed,
        publicVisible: pubVis,
        trailsEnabled: cursorEnabled,
      } = propsRef.current;
      const ptr = pointerStateRef.current;

      if (pubVis !== lastPublicVisible) {
        lastPublicVisible = pubVis;
        measureBoardRect(now);
      }

      if (revealed && revealStartedAt === null) {
        revealStartedAt = now;
      }

      // Smooth cursor target
      const desiredCursorX = ptr.hasMoved ? ptr.x : width * 0.34;
      const desiredCursorY = ptr.hasMoved ? ptr.y : height * 0.48;
      const followAlpha = 1 - Math.exp(-dt / 120);
      cursorX += (desiredCursorX - cursorX) * followAlpha;
      cursorY += (desiredCursorY - cursorY) * followAlpha;

      // Determine AFK vs active mode (when cursor trails are toggled off, lock stars to the illuminated board!)
      let desiredMode: "cursor" | "board" = "cursor";
      if (!cursorEnabled) {
        desiredMode = "board";
      } else if (revealed) {
        const sinceReveal = revealStartedAt !== null ? now - revealStartedAt : 0;
        if (!ptr.hasMoved) {
          desiredMode = sinceReveal > INITIAL_DEMO_SIPHON_DELAY_MS ? "board" : "cursor";
        } else {
          const idleMs = now - ptr.lastMoveAt;
          const leftLongEnough = !ptr.inside && ptr.leftAt > 0 && now - ptr.leftAt > LEAVE_GRACE_MS;
          desiredMode = idleMs > AFK_THRESHOLD_MS || leftLongEnough ? "board" : "cursor";
        }
      }

      if (desiredMode !== mode) {
        mode = desiredMode;
        if (mode === "board") {
          sendOrbsToBoard(now);
        } else {
          recallOrbsToCursor(now);
        }
      }

      // Refresh cached board rect at most every 260ms ONLY while orbs are actively flying to the board
      const hasBoardFlight = orbs.some((o) => !o.absorbed && o.phase === "toBoard");
      if (hasBoardFlight && now - lastRectSyncAt > 260) {
        measureBoardRect(now);
      }

      // Update orbs
      let activeToBoard = 0;
      let activeToCursor = 0;
      let chasingCursorCount = 0;

      for (const orb of orbs) {
        if (orb.absorbed) continue;

        // Continuous graceful star spin (slightly livelier while streaming across the screen)
        const spinMult = orb.phase === "cursor" ? 1 : 1.35;
        orb.spinAngle += orb.spinSpeed * spinMult * dtSec;

        if (orb.phase === "cursor") {
          // Smooth steering/spring physics: orbs genuinely track down & orbit the live mouse anywhere on screen!
          chasingCursorCount += 1;
          orb.orbitAngle += orb.orbitSpeed * dtSec;
          const personalTargetX =
            cursorX + Math.cos(orb.orbitAngle) * orb.orbitRx;
          const personalTargetY =
            cursorY + Math.sin(orb.orbitAngle * 1.12 + orb.orbitPhase) * orb.orbitRy;

          const dx = personalTargetX - orb.x;
          const dy = personalTargetY - orb.y;
          // Smooth spring acceleration + silky damping so orbs curve naturally behind wide mouse circles
          const springK = 5.4;
          const damping = Math.exp(-3.6 * dtSec);
          orb.vx = (orb.vx + dx * springK * dtSec) * damping;
          orb.vy = (orb.vy + dy * springK * dtSec) * damping;

          // Gentle max speed cap keeps motion fluid & unhurried even across huge screen sweeps
          const speed = Math.hypot(orb.vx, orb.vy);
          const maxSpeed = 620;
          if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            orb.vx *= scale;
            orb.vy *= scale;
          }

          orb.x += orb.vx * dtSec;
          orb.y += orb.vy * dtSec;

          // Keep a clean trail only while moving noticeably so circling the mouse leaves gentle ribbons
          if (speed > 26) {
            orb.trail.push({ x: orb.x, y: orb.y });
            if (orb.trail.length > 14) orb.trail.shift();
          } else if (orb.trail.length > 1) {
            orb.trail.shift();
          }
          continue;
        }

        // Transfer flights: "toBoard" or "toCursor"
        orb.elapsedMs += dt;
        if (orb.elapsedMs < orb.delayMs) {
          if (orb.phase === "toBoard") {
            // Keep drifting gently around cursor until this orb's staggered departure time
            orb.orbitAngle += orb.orbitSpeed * dtSec;
            const tx = cursorX + Math.cos(orb.orbitAngle) * orb.orbitRx;
            const ty = cursorY + Math.sin(orb.orbitAngle * 1.12 + orb.orbitPhase) * orb.orbitRy;
            const lag = 1 - Math.exp(-dt / 260);
            orb.x += (tx - orb.x) * lag;
            orb.y += (ty - orb.y) * lag;
            orb.startX = orb.x;
            orb.startY = orb.y;
          }
          continue;
        }

        const flightMs = orb.elapsedMs - orb.delayMs;
        const rawT = Math.min(1, flightMs / Math.max(1, orb.durationMs));
        const t = easeInOutCubic(rawT);

        const endX =
          orb.phase === "toBoard"
            ? cachedBoardRect.left + orb.boardRelX * cachedBoardRect.width
            : cursorX + Math.cos(orb.orbitAngle) * orb.orbitRx;
        const endY =
          orb.phase === "toBoard"
            ? cachedBoardRect.top + orb.boardRelY * cachedBoardRect.height
            : cursorY + Math.sin(orb.orbitAngle * 1.12 + orb.orbitPhase) * orb.orbitRy;

        const dx = endX - orb.startX;
        const dy = endY - orb.startY;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const perpX = -dy / dist;
        const perpY = dx / dist;

        const ctrlX = (orb.startX + endX) * 0.5 + perpX * orb.arcOffset;
        const ctrlY = (orb.startY + endY) * 0.5 + perpY * orb.arcOffset;
        const inv = 1 - t;
        const wave =
          Math.sin(rawT * Math.PI * 2 + orb.wavePhase) * orb.waveAmp * Math.sin(rawT * Math.PI);

        const nextX =
          inv * inv * orb.startX + 2 * inv * t * ctrlX + t * t * endX + perpX * wave;
        const nextY =
          inv * inv * orb.startY + 2 * inv * t * ctrlY + t * t * endY + perpY * wave;

        // Track approximate velocity so handing off from "toCursor" -> "cursor" is 100% seamless!
        orb.vx = (nextX - orb.x) / Math.max(0.004, dtSec);
        orb.vy = (nextY - orb.y) / Math.max(0.004, dtSec);
        orb.x = nextX;
        orb.y = nextY;

        orb.trail.push({ x: orb.x, y: orb.y });
        if (orb.trail.length > 16) orb.trail.shift();

        if (orb.phase === "toBoard") {
          activeToBoard += 1;
        } else {
          activeToCursor += 1;
        }

        if (rawT >= 1) {
          batchCompleted += 1;
          if (orb.phase === "toBoard") {
            orb.absorbed = true;
            flares.push({
              x: endX,
              y: endY,
              ageMs: 0,
              durationMs: 1150,
              maxRadius: randomRange(28, 48),
              alpha: 0.78,
              angle: orb.spinAngle,
              spinSpeed: orb.spinSpeed * 0.7,
            });
          } else {
            // Smoothly graduate into persistent cursor-tracking orbit (never disappears or resets!)
            orb.phase = "cursor";
            orb.vx *= 0.35;
            orb.vy *= 0.35;
          }
        }
      }

      if (mode === "board" && orbs.length > 0 && orbs.every((o) => o.absorbed)) {
        orbs = [];
      }

      // Compute continuous board charge & cursor aura energy
      if (mode === "board") {
        const ratio = Math.min(1, batchCompleted / batchTotal);
        const boost = activeToBoard > 0 ? 0.05 : 0;
        targetCharge = orbs.length === 0 ? 1 : Math.min(1, ratio * 0.95 + boost);
      } else {
        const emergedRatio = Math.min(
          1,
          (batchCompleted + activeToCursor * 0.55) / batchTotal,
        );
        targetCharge = activeToCursor === 0 && chasingCursorCount > 0 ? 0 : Math.max(0, 1 - emergedRatio);
      }

      const chargeTau = targetCharge > displayCharge ? 760 : 620;
      displayCharge += (targetCharge - displayCharge) * (1 - Math.exp(-dt / chargeTau));
      if (Math.abs(targetCharge - displayCharge) < 0.002) {
        displayCharge = targetCharge;
      }

      const desiredCursorEnergy =
        mode === "cursor" ? 1 - displayCharge * 0.65 : Math.max(0, 0.8 - displayCharge);
      cursorEnergy += (desiredCursorEnergy - cursorEnergy) * (1 - Math.exp(-dt / 520));
      if (cursorEnergy < 0.005 && desiredCursorEnergy === 0) cursorEnergy = 0;

      boardCharge.set(displayCharge);

      // Update flares
      if (flares.length > 0) {
        for (const flare of flares) {
          flare.ageMs += dt;
          flare.angle += flare.spinSpeed * dtSec;
        }
        flares = flares.filter((f) => f.ageMs < f.durationMs);
      }

      // Zero-work fast path when fully absorbed and canvas is already clean!
      if (orbs.length === 0 && flares.length === 0 && cursorEnergy <= 0.01) {
        if (!canvasIsClean) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, width, height);
          canvasIsClean = true;
        }
        return;
      }
      canvasIsClean = false;

      // ======================================================================
      // FAST SPRITE-BLIT RENDERING
      // ======================================================================
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = lightTheme ? "source-over" : "lighter";

      // 1. Soft cursor aura (single drawImage blit)
      if (cursorEnergy > 0.015) {
        const auraR = 105 + cursorEnergy * 140;
        ctx.globalAlpha = Math.min(1, cursorEnergy);
        ctx.drawImage(
          lightTheme ? auraSpriteLight : auraSpriteDark,
          cursorX - auraR,
          cursorY - auraR,
          auraR * 2,
          auraR * 2,
        );
      }

      // 2. Spinning 4-point diamond stars + sleek white comet trails
      const starSprite = lightTheme ? starSpriteLight : starSpriteDark;
      for (const orb of orbs) {
        if (orb.absorbed) continue;
        if (orb.phase === "toCursor" && orb.elapsedMs < orb.delayMs) continue;

        let alpha = orb.brightness;
        let sizeScale = 1;
        if (orb.phase === "cursor") {
          const twinkle = 0.74 + 0.26 * Math.sin(now / 1150 + orb.orbitPhase);
          alpha *= twinkle * (lightTheme ? 0.86 : 0.96);
          sizeScale = 0.92 + 0.14 * Math.sin(now / 1150 + orb.orbitPhase);
        } else {
          const flightMs = Math.max(0, orb.elapsedMs - orb.delayMs);
          const rawT = Math.min(1, flightMs / Math.max(1, orb.durationMs));
          const env =
            orb.phase === "toBoard" && orb.elapsedMs < orb.delayMs
              ? 0.88
              : Math.min(1, rawT * 5) * (1 - Math.max(0, (rawT - 0.92) / 0.08) * 0.35);
          alpha *= env;
          sizeScale = 0.92 + 0.22 * Math.sin(rawT * Math.PI);
        }

        // Sleek tapered white trail behind the star
        ctx.globalAlpha = 1;
        drawBatchedTrail(orb.trail, orb.radius * sizeScale, alpha, lightTheme);

        // Rotated crisp 4-point diamond star blit
        const drawR = orb.radius * sizeScale;
        ctx.save();
        ctx.translate(orb.x, orb.y);
        ctx.rotate(orb.spinAngle);
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(starSprite, -drawR, -drawR, drawR * 2, drawR * 2);
        ctx.restore();
      }

      // 3. Expanding diamond star absorption twinkle + light ring on board edge impact
      if (flares.length > 0) {
        ctx.globalAlpha = 1;
        for (const flare of flares) {
          const t = Math.min(1, flare.ageMs / flare.durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          const r = 6 + eased * flare.maxRadius;
          const a = (1 - eased) * flare.alpha;

          ctx.save();
          ctx.translate(flare.x, flare.y);
          ctx.rotate(flare.angle);
          ctx.globalAlpha = Math.min(1, a * 0.92);
          ctx.drawImage(starSprite, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
          ctx.restore();

          ctx.globalAlpha = 1;
          ctx.strokeStyle = lightTheme
            ? `rgba(39, 103, 167, ${a * 0.5})`
            : `rgba(216, 234, 255, ${a * 0.68})`;
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.arc(flare.x, flare.y, r * 0.76, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [staticLayout, stageRef, boardSlabRef, publicTableRef, pointerStateRef, boardCharge]);

  if (staticLayout) return null;

  return <canvas ref={canvasRef} className={styles.lightSiphonCanvas} aria-hidden="true" />;
});
