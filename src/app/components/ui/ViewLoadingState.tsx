import { EFlowMark } from '../../../components/EFlowMark';
import './viewLoadingState.css';

type SkeletonKind = 'split' | 'settings' | 'table' | 'overview';

function resolveRouteSkeletonKind(): SkeletonKind {
  if (typeof window === 'undefined') return 'overview';
  const href = `${window.location.pathname}${window.location.search}`.toLowerCase();
  if (href.includes('inbox') || href.includes('review')) return 'split';
  if (href.includes('setting')) return 'settings';
  if (
    href.includes('user') ||
    href.includes('audit') ||
    href.includes('budget') ||
    href.includes('journal') ||
    href.includes('expense') ||
    href.includes('report') ||
    href.includes('history') ||
    href.includes('deadline')
  )
    return 'table';
  return 'overview';
}

function StatCards({ count }: { count: number }) {
  return <div className="eflow-view-loading__cards">
    {Array.from({ length: count }, (_, index) => <div className="eflow-view-loading__card" key={index}>
      <div className="eflow-view-loading__card-head">
        <span className="eflow-view-loading__block eflow-view-loading__label" />
        <span className="eflow-view-loading__tile" />
      </div>
      <span className="eflow-view-loading__block eflow-view-loading__value" />
      <span className="eflow-view-loading__block eflow-view-loading__hint" />
    </div>)}
  </div>;
}

function ListPanel({ count, table = false }: { count: number; table?: boolean }) {
  return <div className="eflow-view-loading__panel">
    <span className="eflow-view-loading__block eflow-view-loading__panel-title" />
    <div className="eflow-view-loading__rows">
      {Array.from({ length: count }, (_, index) => <div className="eflow-view-loading__row" key={index}>
        <span className="eflow-view-loading__tile" />
        <div className="eflow-view-loading__row-label">
          <span className="eflow-view-loading__block" />
          <span className="eflow-view-loading__block eflow-view-loading__hint" />
        </div>
        {table && <span className="eflow-view-loading__block eflow-view-loading__column" />}
        <span className="eflow-view-loading__block eflow-view-loading__pill" />
      </div>)}
    </div>
  </div>;
}

function RoutePreview({ kind }: { kind: SkeletonKind }) {
  switch (kind) {
    case 'settings':
      return <div className="eflow-view-loading__panes eflow-view-loading__panes--settings">
        <ListPanel count={4} />
        <div className="eflow-view-loading__panel">
          <span className="eflow-view-loading__block eflow-view-loading__panel-title" />
          <div className="eflow-view-loading__fields">
            {[0, 1, 2, 3].map(index => <div key={index}>
              <span className="eflow-view-loading__block eflow-view-loading__label" />
              <span className="eflow-view-loading__block eflow-view-loading__field" />
            </div>)}
          </div>
        </div>
      </div>;
    case 'split':
      return <div className="eflow-view-loading__panes eflow-view-loading__panes--split">
        <ListPanel count={4} />
        <div className="eflow-view-loading__panel">
          <span className="eflow-view-loading__block eflow-view-loading__panel-title" />
          <span className="eflow-view-loading__block eflow-view-loading__detail" />
          <span className="eflow-view-loading__block eflow-view-loading__detail" />
        </div>
      </div>;
    case 'table':
      return <><StatCards count={3} /><ListPanel count={4} table /></>;
    case 'overview':
      return <>
        <StatCards count={4} />
        <div className="eflow-view-loading__panes">
          <ListPanel count={3} />
          <div className="eflow-view-loading__panel">
            <span className="eflow-view-loading__block eflow-view-loading__panel-title" />
            <div className="eflow-view-loading__chart">
              {[28, 46, 38, 61, 49, 78, 65].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
            </div>
          </div>
        </div>
      </>;
  }
}

/** Lightweight, shared by code-split views without importing their feature. */
export function ViewLoadingState() {
  const kind = resolveRouteSkeletonKind();
  return (
    <div
      className="eflow-view-loading"
      role="status"
      aria-label="Getting things done"
      aria-busy="true"
    >
      <div className="eflow-view-loading__frame">
        <div className="eflow-view-loading__brand">
          <EFlowMark className="eflow-view-loading__mark" height={28} />
          <span className="eflow-view-loading__status">Getting things done</span>
        </div>
        <div className="eflow-view-loading__track" aria-hidden="true"><span /></div>
        <div className="eflow-view-loading__skeleton" data-kind={kind} aria-hidden="true">
          <div className="eflow-view-loading__heading">
            <div>
              <span className="eflow-view-loading__block eflow-view-loading__title" />
              <span className="eflow-view-loading__block eflow-view-loading__subtitle" />
            </div>
            <span className="eflow-view-loading__block eflow-view-loading__filter" />
          </div>
          <RoutePreview kind={kind} />
        </div>
      </div>
    </div>
  );
}
