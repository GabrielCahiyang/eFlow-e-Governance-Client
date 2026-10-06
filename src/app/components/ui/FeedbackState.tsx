import type { ReactNode } from "react";
import { Button } from "./button";

/** Presentation only: feature owners retain drafts, errors and retry operations. */
export function FeedbackState({ tone = "info", title, children, onRetry, pending = false }: {
  tone?: "info" | "success" | "warning" | "error";
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  pending?: boolean;
}) {
  return <div className="eflow-feedback" data-tone={tone} role={tone === "error" ? "alert" : "status"} aria-busy={pending || undefined}>
    <strong>{title}</strong>
    {children && <div className="eflow-feedback-body">{children}</div>}
    {onRetry && <Button type="button" variant="outline" size="sm" pending={pending} onClick={onRetry}>{pending ? "Retrying…" : "Retry"}</Button>}
  </div>;
}
