import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { EFlowMark } from "../../components/EFlowMark";
import { phase2Request } from "../../app/shared/phase2Api";
import { LandingBoardStage } from "./components/LandingBoardStage";
import { LandingFooter } from "./components/LandingFooter";
import styles from "./LandingPage.module.scss";

const PUBLIC_BRANDING_STORAGE_KEY = "eflow.public_branding.v1";
const PRELOADER_SESSION_KEY = "eflow.landing.preloader_seen.v2";
const DEFAULT_ORG = "LEDIPO";

function readCachedOrganizationName(): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(PUBLIC_BRANDING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          login_portal_title?: string;
          organization_name?: string;
        };
        const title = parsed.login_portal_title?.trim() || parsed.organization_name?.trim();
        if (title) return title;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_ORG;
}

function shouldShowPreloaderInitially(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return window.sessionStorage.getItem(PRELOADER_SESSION_KEY) !== "1";
  } catch {
    return false;
  }
}

export interface LandingPageProps {
  onSignIn: () => void;
}

export function LandingPage({ onSignIn }: LandingPageProps) {
  const shouldReduceMotion = useReducedMotion();
  const [organizationName, setOrganizationName] = useState(readCachedOrganizationName);
  const [showPreloader, setShowPreloader] = useState(shouldShowPreloaderInitially);
  const [isLightHeader, setIsLightHeader] = useState(false);
  const [isResettingTop, setIsResettingTop] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const resetTimersRef = useRef<number[]>([]);
  const preloaderBarRef = useRef<HTMLDivElement | null>(null);
  const preloaderPctRef = useRef<HTMLSpanElement | null>(null);

  // Hide native right-side browser scrollbar ONLY while LandingPage is mounted
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "eFlow";
    }
    const cls = "eflow-landing-no-scrollbar";
    document.documentElement.classList.add(cls);
    document.body.classList.add(cls);
    return () => {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    };
  }, []);

  useEffect(() => {
    return () => {
      resetTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    let active = true;
    const syncBranding = async () => {
      try {
        const data = await phase2Request<{
          login_portal_title?: string;
          organization_name?: string;
        }>("/auth/public-branding", { method: "GET" }, true);
        const name = data?.login_portal_title?.trim() || data?.organization_name?.trim();
        if (active && name) {
          setOrganizationName(name);
        }
      } catch {
        // Offline or public branding unavailable
      }
    };
    void syncBranding();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showPreloader) return;
    if (shouldReduceMotion) {
      setShowPreloader(false);
      return;
    }

    let rafId = 0;
    let closeTimer = 0;
    const durationMs = 540;
    const start = performance.now();

    const tick = (now: number) => {
      const ratio = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - ratio, 3);
      if (preloaderBarRef.current) {
        preloaderBarRef.current.style.transform = `scaleX(${eased})`;
      }
      if (preloaderPctRef.current) {
        preloaderPctRef.current.textContent = `${Math.round(eased * 100)}%`;
      }
      if (ratio < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        try {
          window.sessionStorage.setItem(PRELOADER_SESSION_KEY, "1");
        } catch {
          // Ignore storage write errors
        }
        closeTimer = window.setTimeout(() => setShowPreloader(false), 110);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (closeTimer) window.clearTimeout(closeTimer);
    };
  }, [showPreloader, shouldReduceMotion]);

  // Unhurried fade-out -> reset behind veil -> hold until board is 100% settled -> smooth fade-in
  const handleLogoResetToTop = useCallback(() => {
    if (isResettingTop) return;
    if (window.scrollY <= 8) return;

    if (shouldReduceMotion) {
      window.scrollTo({ top: 0, behavior: "auto" });
      setResetSignal((n) => n + 1);
      return;
    }

    resetTimersRef.current.forEach((id) => window.clearTimeout(id));
    resetTimersRef.current = [];
    setIsResettingTop(true);

    // Wait for veil to cover screen cleanly before resetting scroll & board state
    const t1 = window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      setResetSignal((n) => n + 1);
      setIsLightHeader(false);
    }, 280);

    // Hold calmly so the 3D board and cards are 100% settled before revealing
    const t2 = window.setTimeout(() => {
      setIsResettingTop(false);
    }, 980);

    resetTimersRef.current.push(t1, t2);
  }, [isResettingTop, shouldReduceMotion]);

  const isCurtainActive = showPreloader || isResettingTop;

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.landingRoot}>
        {/* Fast Curtain Preloader — official EFlowMark */}
        <AnimatePresence>
          {showPreloader && (
            <motion.div
              className={styles.preloader}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
              role="status"
              aria-label="Loading eFlow"
            >
              <EFlowMark variant="white" height={54} state="submitting" ariaLabel="eFlow" />
              <div className={styles.preloaderTrack} aria-hidden="true">
                <div
                  ref={preloaderBarRef}
                  className={styles.preloaderFill}
                  style={{ transform: "scaleX(0)" }}
                />
              </div>
              <span ref={preloaderPctRef} className={`${styles.preloaderPct} ${styles.tabular}`}>
                0%
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unhurried Fade Veil when clicking top-left eFlow logo to return to top */}
        <AnimatePresence>
          {isResettingTop && (
            <motion.div
              className={styles.resetVeil}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden="true"
            >
              <motion.div
                className={styles.resetVeilInner}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <EFlowMark variant="white" height={48} state="submitting" ariaLabel="eFlow" />
                <div className={styles.preloaderTrack}>
                  <motion.div
                    className={styles.preloaderFill}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ultra-Clean Top Bar: ONLY Official Logo + Sign in */}
        <motion.header
          className={`${styles.stickyHeader} ${
            isLightHeader ? styles.headerLight : styles.headerDark
          }`}
          aria-label="Primary navigation"
          initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
          animate={
            isCurtainActive
              ? { opacity: 0, y: -10 }
              : { opacity: 1, y: 0 }
          }
          transition={{
            duration: 0.55,
            delay: isCurtainActive ? 0 : 0.14,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <button
            type="button"
            className={styles.brandButton}
            onClick={handleLogoResetToTop}
            aria-label="eFlow — return to top"
          >
            <EFlowMark
              variant={isLightHeader ? "default" : "white"}
              height={30}
              ariaLabel="eFlow"
            />
          </button>

          <button type="button" className={styles.signInButton} onClick={onSignIn}>
            <span>Sign in</span>
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </motion.header>

        <motion.main
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={isCurtainActive ? { opacity: 0 } : { opacity: 1 }}
          transition={{
            duration: 0.62,
            delay: isCurtainActive ? 0 : 0.12,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <LandingBoardStage
            organizationName={organizationName}
            resetSignal={resetSignal}
            isRevealReady={!isCurtainActive}
            onThemeChange={setIsLightHeader}
          />
        </motion.main>

        <LandingFooter organizationName={organizationName} />
      </div>
    </MotionConfig>
  );
}

export default LandingPage;
