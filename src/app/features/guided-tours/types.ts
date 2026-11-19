export type GuidedTourKind = "system" | "page";

export interface GuidedTourStep {
  id: string;
  title: string;
  description: string;
  /** Optional conversational spoken script for AI voice so it talks naturally instead of reading card text verbatim. */
  narration?: string;
  target: string | (() => HTMLElement | null);
  /** Optional fallback target used only if the primary target is collapsed or unavailable on small screens. */
  fallbackTarget?: string | (() => HTMLElement | null);
  beforeShow?: () => void | Promise<void>;
}

export interface GuidedTourProgress {
  welcomed: boolean;
  systemCompleted: boolean;
  completedPages: string[];
  voiceEnabled: boolean;
  dismissedTours?: string[];
  activeTour?: {
    kind: GuidedTourKind;
    index: number;
    section: string;
    page?: string;
  };
}

export interface GuidedTourSection {
  id: string;
  label: string;
  page: string;
}
