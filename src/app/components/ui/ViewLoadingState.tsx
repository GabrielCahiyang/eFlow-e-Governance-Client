import type { CSSProperties } from 'react';
import { EFlowMark } from '../../../components/EFlowMark';
import './viewLoadingState.css';

type SkeletonKind = 'split' | 'settings' | 'table' | 'overview';

/** Stagger index consumed by the CSS entrance, dot wave, and chart animations. */
const stagger = (index: number) => ({ '--i': index }) as CSSProperties;

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

function WorkspaceTabs() {
  return (
    <div className="eflow-view-loading__tabs-bar">
      <span className="eflow-view-loading__tab eflow-view-loading__tab--action" />
      <span className="eflow-view-loading__tab eflow-view-loading__tab--active" />
      <span className="eflow-view-loading__tab" />
      <span className="eflow-view-loading__tab" />
    </div>
  );
}

function StatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="eflow-view-loading__cards">
      {Array.from({ length: count }, (_, index) => (
        <div className="eflow-view-loading__card" key={index} style={stagger(index)}>
          <div className="eflow-view-loading__card-head">
            <span className="eflow-view-loading__block eflow-view-loading__label" />
            <span className="eflow-view-loading__tile" />
          </div>
          <span className="eflow-view-loading__block eflow-view-loading__value" />
          <span className="eflow-view-loading__block eflow-view-loading__hint" />
        </div>
      ))}
    </div>
  );
}

function ListPanel({ count = 5, table = false }: { count?: number; table?: boolean }) {
  return (
    <div className="eflow-view-loading__panel">
      <div className="eflow-view-loading__panel-head">
        <span className="eflow-view-loading__block eflow-view-loading__panel-title" />
        <span className="eflow-view-loading__block eflow-view-loading__panel-action" />
      </div>
      <div className="eflow-view-loading__rows">
        {Array.from({ length: count }, (_, index) => (
          <div className="eflow-view-loading__row" key={index} style={stagger(index)}>
            <span className="eflow-view-loading__tile" />
            <div className="eflow-view-loading__row-label">
              <span className="eflow-view-loading__block" />
              <span className="eflow-view-loading__block eflow-view-loading__hint" />
            </div>
            {table && <span className="eflow-view-loading__block eflow-view-loading__column" />}
            <span className="eflow-view-loading__block eflow-view-loading__pill" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RoutePreview({ kind }: { kind: SkeletonKind }) {
  switch (kind) {
    case 'settings':
      return (
        <div className="eflow-view-loading__panes eflow-view-loading__panes--settings">
          <ListPanel count={6} />
          <div className="eflow-view-loading__panel">
            <span className="eflow-view-loading__block eflow-view-loading__panel-title" />
            <div className="eflow-view-loading__fields">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index}>
                  <span className="eflow-view-loading__block eflow-view-loading__label" />
                  <span className="eflow-view-loading__block eflow-view-loading__field" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case 'split':
      return (
        <div className="eflow-view-loading__panes eflow-view-loading__panes--split">
          <ListPanel count={6} />
          <div className="eflow-view-loading__panel">
            <span className="eflow-view-loading__block eflow-view-loading__panel-title" />
            <span className="eflow-view-loading__block eflow-view-loading__detail" />
            <span className="eflow-view-loading__block eflow-view-loading__detail" />
            <span className="eflow-view-loading__block eflow-view-loading__detail" />
          </div>
        </div>
      );
    case 'table':
      return (
        <>
          <StatCards count={3} />
          <ListPanel count={6} table />
        </>
      );
    case 'overview':
      return (
        <>
          <StatCards count={4} />
          <div className="eflow-view-loading__panes">
            <ListPanel count={5} />
            <div className="eflow-view-loading__panel">
              <div className="eflow-view-loading__panel-head">
                <span className="eflow-view-loading__block eflow-view-loading__panel-title" />
              </div>
              <div className="eflow-view-loading__chart">
                {[32, 54, 42, 68, 52, 86, 72].map((height, index) => (
                  <span key={index} style={{ ...stagger(index), height: `${height}%` }} />
                ))}
              </div>
            </div>
          </div>
        </>
      );
  }
}

/** Lightweight, full-stage loader matching the live eFlow workspace. */
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
        <div className="eflow-view-loading__aurora" aria-hidden="true" />
        
        {/* Topbar matching live eFlow header */}
        <header className="eflow-view-loading__brand">
          <div className="eflow-view-loading__brand-lead">
            <EFlowMark className="eflow-view-loading__mark" height={38} state="submitting" />
            <span className="eflow-view-loading__brand-divider" aria-hidden="true" />
            <span className="eflow-view-loading__brand-org" aria-hidden="true" />
          </div>
          <div className="eflow-view-loading__status-wrap">
            <span className="eflow-view-loading__status">
              Getting things done
              <span className="eflow-view-loading__dots" aria-hidden="true">
                <i style={stagger(0)} />
                <i style={stagger(1)} />
                <i style={stagger(2)} />
              </span>
            </span>
          </div>
        </header>

        {/* Luminous progress track */}
        <div className="eflow-view-loading__track" aria-hidden="true">
          <span />
        </div>

        {/* Workspace body matching live tabs and scale */}
        <div className="eflow-view-loading__skeleton" data-kind={kind} aria-hidden="true">
          <WorkspaceTabs />

          <div className="eflow-view-loading__heading">
            <div className="eflow-view-loading__heading-text">
              <span className="eflow-view-loading__block eflow-view-loading__title" />
              <span className="eflow-view-loading__block eflow-view-loading__subtitle" />
            </div>
            <span className="eflow-view-loading__block eflow-view-loading__action-btn" />
          </div>

          <div className="eflow-view-loading__filters">
            <span className="eflow-view-loading__block eflow-view-loading__search" />
            <span className="eflow-view-loading__block eflow-view-loading__filter-select" />
            <span className="eflow-view-loading__block eflow-view-loading__filter-select" />
            <span className="eflow-view-loading__block eflow-view-loading__filter-select" />
          </div>

          <RoutePreview kind={kind} />
        </div>
      </div>
    </div>
  );
}
