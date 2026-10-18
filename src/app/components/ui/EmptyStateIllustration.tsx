import './emptyState.css';

/** Locally served Storyset artwork. Keep the meaning in adjacent text. */
export type EmptyIllustration = 'empty' | 'search' | 'inbox' | 'projects' | 'tasks' | 'complete' | 'files' | 'chat' | 'people' | 'budget';
export type EmptyStateSize = 'page' | 'panel' | 'compact';

const styles: Record<EmptyIllustration, string> = {
  empty: 'bro', search: 'rafiki', inbox: 'pana', projects: 'amico', tasks: 'cuate',
  complete: 'rafiki', files: 'bro', chat: 'cuate', people: 'pana', budget: 'amico',
};

export function EmptyStateIllustration({ kind = 'empty', size = 'panel' }: { kind?: EmptyIllustration; size?: EmptyStateSize }) {
  const asset = `${import.meta.env.BASE_URL}illustrations/storyset/${kind}-${styles[kind]}`;
  return <span className="eflow-storyset" data-size={size}>
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet={`${asset}.still.svg`} />
      <img className="eflow-empty-illustration" data-size={size} data-illustration={kind} data-style={styles[kind]}
        src={`${asset}.svg`} width={208} height={144} alt="" aria-hidden="true" decoding="async" draggable={false} />
    </picture>
  </span>;
}
