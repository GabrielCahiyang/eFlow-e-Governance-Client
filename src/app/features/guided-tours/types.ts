export type GuidedTourKind = "system" | "page";

export interface GuidedTourStep {
  id: string;
  title: string;
  description: string;
  target: string | (() => HTMLElement | null);
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
