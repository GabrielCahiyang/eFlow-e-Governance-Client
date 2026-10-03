import type { ComponentProps } from "react";
export function WorkspaceShell({className = "", ...props}: ComponentProps<"section">) {
  return <section {...props} className={`eflow-workspace ${className}`} />;
}
