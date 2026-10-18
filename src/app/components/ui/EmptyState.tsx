// ─── Empty State Component ───────────────────────────────────────
import React from "react";
import { EmptyStateIllustration, type EmptyIllustration, type EmptyStateSize } from './EmptyStateIllustration';
import { useEmptyStateSpace } from './useEmptyStateSpace';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: EmptyIllustration | false;
  size?: EmptyStateSize;
  fill?: boolean;
}

export function EmptyState({ icon, title, description, action, illustration, size = 'panel', fill = size === 'page' }: EmptyStateProps) {
  const space = useEmptyStateSpace(fill);
  const visual = illustration === false ? icon : illustration ? <EmptyStateIllustration kind={illustration} size={size}/> : icon ?? <EmptyStateIllustration size={size}/>;
  return (
    <div ref={space.ref} className="eflow-illustrated-empty" data-size={size} data-fill={fill || undefined} style={fill && space.height !== undefined ? { minHeight: space.height } : undefined}>
      {visual && <div>{visual}</div>}
      <div className="eflow-illustrated-empty__copy"><p className="eflow-illustrated-empty__title">{title}</p>
        {description && <p className="eflow-illustrated-empty__description">{description}</p>}
      </div>
      {action && <div className="eflow-illustrated-empty__action">{action}</div>}
    </div>
  );
}
