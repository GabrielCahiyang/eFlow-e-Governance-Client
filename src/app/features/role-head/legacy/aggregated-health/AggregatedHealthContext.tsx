import { createContext, useContext, type ReactNode } from "react";
import { useAggregatedHealthController } from "./useAggregatedHealthController";

type AggregatedHealthValue = ReturnType<typeof useAggregatedHealthController>;
const AggregatedHealthContext = createContext<AggregatedHealthValue | null>(null);

export function AggregatedHealthProvider({ children }: { children: ReactNode }) {
  const value = useAggregatedHealthController();
  return <AggregatedHealthContext.Provider value={value}>{children}</AggregatedHealthContext.Provider>;
}

export function useAggregatedHealth() {
  const value = useContext(AggregatedHealthContext);
  if (!value) throw new Error("useAggregatedHealth must be used inside AggregatedHealthProvider");
  return value;
}
