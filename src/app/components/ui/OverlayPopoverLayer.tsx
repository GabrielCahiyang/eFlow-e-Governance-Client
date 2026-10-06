import { createContext, useContext, type ReactNode } from "react";

// CSS inheritance stops at a DOM portal. React context preserves the owning tier.
const OverlayPopoverLayer = createContext<string | undefined>(undefined);
export function ConfirmationPopoverLayer({ children }: { children: ReactNode }) {
  return <OverlayPopoverLayer.Provider value="var(--eflow-layer-confirmation-picker)">{children}</OverlayPopoverLayer.Provider>;
}
export function useOverlayPopoverLayer() { return useContext(OverlayPopoverLayer); }
