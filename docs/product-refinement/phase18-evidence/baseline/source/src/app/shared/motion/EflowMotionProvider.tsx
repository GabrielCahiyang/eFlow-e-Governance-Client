import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

export function EflowMotionProvider({
  children,
  reducedMotion = "user",
}: {
  children: ReactNode;
  reducedMotion?: "user" | "always" | "never";
}) {
  return (
    <MotionConfig reducedMotion={reducedMotion}>
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
