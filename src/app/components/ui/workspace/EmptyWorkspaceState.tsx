import type { ReactNode } from "react";
import { EmptyState } from '../EmptyState';
import type { EmptyIllustration } from '../EmptyStateIllustration';
export function EmptyWorkspaceState({title, description, action, illustration}: {title: string; description?: string; action?: ReactNode; illustration?: EmptyIllustration | false}) {
  return <div className="eflow-empty-workspace eflow-empty-workspace--illustrated"><EmptyState title={title} description={description} action={action} illustration={illustration} size="page"/></div>;
}
