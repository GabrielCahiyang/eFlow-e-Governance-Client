import './emptyState.css';

/** Decorative, locally served unDraw artwork. Keep the meaning in adjacent text. */
export type EmptyIllustration = 'empty' | 'search' | 'inbox' | 'projects' | 'tasks' | 'complete' | 'files' | 'chat' | 'people' | 'budget';
export type EmptyStateSize = 'page' | 'panel' | 'compact';

export function EmptyStateIllustration({ kind = 'empty', size = 'panel' }: { kind?: EmptyIllustration; size?: EmptyStateSize }) {
  return <img className="eflow-empty-illustration" data-size={size} data-illustration={kind}
    src={`${import.meta.env.BASE_URL}illustrations/undraw/${kind}.svg`}
    width={208} height={144} alt="" aria-hidden="true" decoding="async" draggable={false} />;
}
