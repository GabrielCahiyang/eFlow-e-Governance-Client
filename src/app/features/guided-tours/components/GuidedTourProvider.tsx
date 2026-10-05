import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getRoleLabel } from "../../../shared/roles";
import { getPageTourSteps, getSystemTourSteps } from "../tourCatalog";
import { getPageProgressKey, readGuidedTourProgress, writeGuidedTourProgress } from "../services/tourProgressService";
import type { GuidedTourKind, GuidedTourProgress, GuidedTourSection, GuidedTourStep } from "../types";
import { GuidedTourOverlay } from "./GuidedTourOverlay";
import { WelcomeTourPrompt } from "./WelcomeTourPrompt";
import { suggestedFirstSteps } from "../firstSteps";
import { readOnboarding, saveOnboarding } from "../../onboarding";

interface GuidedTourContextValue {
  isTourActive: boolean;
  startSystemTour: () => void;
  startPageTour: () => void;
}

const GuidedTourContext = createContext<GuidedTourContextValue | null>(null);
type BeginTour = (kind: GuidedTourKind, steps: GuidedTourStep[], startIndex?: number, section?: string, page?: string) => void;

export function GuidedTourProvider({
  children,
  userId,
  role,
  activeSection,
  activePage,
  sections,
  onNavigate,
}: {
  children: ReactNode;
  userId: string;
  role: string;
  activeSection: string;
  activePage?: string;
  sections: GuidedTourSection[];
  onNavigate: (section: string, page: string) => void;
}) {
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourKind, setTourKind] = useState<GuidedTourKind | null>(null);
  const [steps, setSteps] = useState<GuidedTourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const initializedFor = useRef("");
  const remoteReady = useRef(false);
  const remoteWrites = useRef(Promise.resolve());
  const startupState = useRef({ sections, onNavigate, begin: null as BeginTour | null });

  const updateProgress = useCallback((mutate: (current: GuidedTourProgress) => GuidedTourProgress) => {
    if (!userId) return;
    const updated = mutate(readGuidedTourProgress(userId, role));
    writeGuidedTourProgress(userId, role, updated);
    if (remoteReady.current) {
      remoteWrites.current = remoteWrites.current.then(async () => {
        await saveOnboarding({ tour_progress: updated });
      }).catch(() => { /* Local progress remains available while offline. */ });
    }
  }, [role, userId]);

  const begin = useCallback((kind: GuidedTourKind, nextSteps: GuidedTourStep[], startIndex = 0, section = activeSection, page = activePage) => {
    if (nextSteps.length === 0) return;
    const safeIndex = Math.min(Math.max(startIndex, 0), nextSteps.length - 1);
    setWelcomeOpen(false);
    setTourKind(kind);
    setSteps(nextSteps);
    setIndex(safeIndex);
    updateProgress((current) => ({ ...current, welcomed: true, activeTour: { kind, index: safeIndex, section, page } }));
  }, [activePage, activeSection, updateProgress]);

  const startSystemTour = useCallback(() => {
    begin("system", getSystemTourSteps(sections, onNavigate), 0);
  }, [begin, onNavigate, sections]);

  const startPageTour = useCallback(() => {
    begin("page", getPageTourSteps(activeSection, activePage), 0);
  }, [activePage, activeSection, begin]);

  startupState.current = { sections, onNavigate, begin };

  useEffect(() => {
    if (!userId) return;
    const identity = `${userId}:${role}`;
    if (initializedFor.current === identity) return;
    initializedFor.current = identity;
    let cancelled = false;
    let timer: number | undefined;
    void (async () => {
    let progress = readGuidedTourProgress(userId, role);
    let serverOnboarding = false;
    let needsFirstRun = false;
    try {
      const record = await readOnboarding();
      if (cancelled) return;
      serverOnboarding = role !== 'admin';
      needsFirstRun = serverOnboarding && (record.status === 'not_started' || (record.status === 'in_progress' && !record.state.completed_steps?.includes('welcome')));
      remoteReady.current = true;
      if (record.state.tour_progress && typeof record.state.tour_progress === 'object') {
        writeGuidedTourProgress(userId, role, record.state.tour_progress as GuidedTourProgress);
        progress = readGuidedTourProgress(userId, role);
      }
    } catch { remoteReady.current = false; }
    if (cancelled) return;
    setVoiceEnabled(progress.voiceEnabled);
    if (needsFirstRun) return;
    timer = window.setTimeout(() => {
      const current = startupState.current;
      if (progress.activeTour) {
        const saved = progress.activeTour;
        if (saved.kind === "page") {
          current.onNavigate(saved.section, saved.page || saved.section);
          current.begin?.("page", getPageTourSteps(saved.section, saved.page), saved.index, saved.section, saved.page);
        } else {
          current.begin?.("system", getSystemTourSteps(current.sections, current.onNavigate), saved.index, saved.section, saved.page);
        }
      } else if (!progress.welcomed && !serverOnboarding) {
        setWelcomeOpen(true);
      }
    }, 850);
    })();
    return () => { cancelled = true; window.clearTimeout(timer); initializedFor.current = ''; remoteReady.current = false; };
  }, [role, userId]);

  useEffect(() => {
    const firstRunFinished = () => { setWelcomeOpen(false); updateProgress(current => ({ ...current, welcomed: true })); };
    window.addEventListener('eflow-start-context-tour', startPageTour);
    window.addEventListener('eflow-first-run-finished', firstRunFinished);
    return () => {
      window.removeEventListener('eflow-start-context-tour', startPageTour);
      window.removeEventListener('eflow-first-run-finished', firstRunFinished);
    };
  }, [startPageTour, updateProgress]);

  const closeTour = useCallback(() => {
    setTourKind(null);
    setSteps([]);
    setIndex(0);
    updateProgress((current) => ({ ...current, dismissedTours: [...new Set([...(current.dismissedTours || []), tourKind === 'system' ? 'system' : getPageProgressKey(activeSection, activePage)])], activeTour: undefined }));
  }, [activePage, activeSection, tourKind, updateProgress]);

  const next = useCallback(() => {
    if (index < steps.length - 1) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      updateProgress((current) => current.activeTour ? { ...current, activeTour: { ...current.activeTour, index: nextIndex } } : current);
      return;
    }
    updateProgress((current) => {
      const pageKey = getPageProgressKey(activeSection, activePage);
      return {
        ...current,
        systemCompleted: current.systemCompleted || tourKind === "system",
        completedPages: tourKind === "page" && !current.completedPages.includes(pageKey) ? [...current.completedPages, pageKey] : current.completedPages,
        activeTour: undefined,
      };
    });
    setTourKind(null);
    setSteps([]);
    setIndex(0);
  }, [activePage, activeSection, index, steps.length, tourKind, updateProgress]);

  const back = useCallback(() => {
    const nextIndex = Math.max(0, index - 1);
    setIndex(nextIndex);
    updateProgress((current) => current.activeTour ? { ...current, activeTour: { ...current.activeTour, index: nextIndex } } : current);
  }, [index, updateProgress]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((current) => {
      const nextValue = !current;
      updateProgress((progress) => ({ ...progress, voiceEnabled: nextValue }));
      return nextValue;
    });
  }, [updateProgress]);

  const context = useMemo<GuidedTourContextValue>(() => ({
    isTourActive: Boolean(tourKind),
    startSystemTour,
    startPageTour,
  }), [startPageTour, startSystemTour, tourKind]);

  return (
    <GuidedTourContext.Provider value={context}>
      {children}
      {welcomeOpen && (
        <WelcomeTourPrompt
          roleLabel={getRoleLabel(role)}
          nextSteps={suggestedFirstSteps(role, sections)}
          onNextStep={(section, page) => { setWelcomeOpen(false); updateProgress((current) => ({ ...current, welcomed: true })); onNavigate(section, page); }}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoice}
          onStart={startSystemTour}
          onLater={() => {
            setWelcomeOpen(false);
            updateProgress((current) => ({ ...current, welcomed: true }));
          }}
        />
      )}
      {tourKind && steps[index] && (
        <GuidedTourOverlay
          step={steps[index]}
          index={index}
          total={steps.length}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoice}
          onBack={back}
          onNext={next}
          onSkip={closeTour}
        />
      )}
    </GuidedTourContext.Provider>
  );
}

export function useGuidedTour(): GuidedTourContextValue {
  const context = useContext(GuidedTourContext);
  if (!context) throw new Error("useGuidedTour must be used inside GuidedTourProvider");
  return context;
}
