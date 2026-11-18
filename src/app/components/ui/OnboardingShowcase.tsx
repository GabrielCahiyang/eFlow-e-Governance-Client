import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Lock, ShieldCheck } from 'lucide-react';
import { motionTransition } from '../../shared/motion';
import './onboardingShowcase.css';

export interface ShowcaseBoardRow {
  label: string;
  badge: string;
  tone: 'ready' | 'working' | 'muted';
  icon?: 'lock' | 'initials';
  initials?: string;
}

export interface OnboardingShowcaseProps {
  scene?: 'board' | 'cascade';
  title: string;
  badgeText: string;
  userInitials: string;
  rows: ShowcaseBoardRow[];
  doneLabel?: string;
  cascadeLabel?: string;
  cascadeStatus?: string;
}

export function initialsOf(name: string, fallback = 'EF'): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Branded split-screen right showcase using eFlow's official primary-to-navy accent gradient. */
export function OnboardingShowcase({
  scene = 'board',
  title,
  badgeText,
  userInitials,
  rows,
  doneLabel = 'Done',
  cascadeLabel = 'Ready to collaborate',
  cascadeStatus = 'Ready',
}: OnboardingShowcaseProps) {
  const reduceMotion = useReducedMotion();

  const sceneVariants = reduceMotion
    ? undefined
    : {
        initial: { opacity: 0, y: 12, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -12, scale: 0.98 },
      };

  return (
    <aside className="eflow-onboarding-showcase" aria-hidden="true">
      <div className="eflow-showcase-glow eflow-showcase-glow--top" />
      <div className="eflow-showcase-glow eflow-showcase-glow--bottom" />

      <AnimatePresence mode="wait" initial={false}>
        {scene === 'board' ? (
          <motion.div
            key="showcase-board"
            className="eflow-showcase-scene"
            variants={sceneVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={motionTransition.navigation}
          >
            <div className="eflow-showcase-board">
              <div className="eflow-showcase-board-head">
                <span className="eflow-showcase-dot" />
                <span className="eflow-showcase-board-title">{title}</span>
                <span className="eflow-showcase-role-tag">{badgeText}</span>
              </div>

              <div className="eflow-showcase-board-rows">
                {rows.slice(0, 2).map((row, idx) => (
                  <div
                    key={row.label}
                    className={`eflow-showcase-board-row ${idx === 0 ? 'is-active' : ''}`}
                  >
                    <span
                      className={`eflow-showcase-avatar ${
                        row.icon === 'lock'
                          ? 'eflow-showcase-avatar--teal'
                          : 'eflow-showcase-avatar--blue'
                      }`}
                    >
                      {row.icon === 'lock' ? <Lock size={12} /> : row.initials || userInitials}
                    </span>
                    <span className="eflow-showcase-row-label">{row.label}</span>
                    <span className="eflow-showcase-bar eflow-showcase-bar--sm" />
                    <span className={`eflow-showcase-cell is-${row.tone}`}>{row.badge}</span>
                  </div>
                ))}

                <div className="eflow-showcase-board-row">
                  <span className="eflow-showcase-avatar eflow-showcase-avatar--amber">TM</span>
                  <span className="eflow-showcase-bar eflow-showcase-bar--lg" />
                  <span className="eflow-showcase-bar eflow-showcase-bar--sm" />
                  <span className="eflow-showcase-cell is-muted" />
                </div>

                <div className="eflow-showcase-board-row">
                  <span className="eflow-showcase-avatar eflow-showcase-avatar--violet">OP</span>
                  <span className="eflow-showcase-bar eflow-showcase-bar--md" />
                  <span className="eflow-showcase-bar eflow-showcase-bar--sm" />
                  <span className="eflow-showcase-cell is-muted" />
                </div>
              </div>
            </div>

            <div className="eflow-showcase-badge-card eflow-showcase-badge-card--top">
              <span className="eflow-showcase-pointer eflow-showcase-pointer--blue" />
              <div className="eflow-showcase-badge-avatar eflow-showcase-avatar--blue">
                {userInitials}
              </div>
            </div>

            <div className="eflow-showcase-badge-card eflow-showcase-badge-card--bottom">
              <span className="eflow-showcase-pointer eflow-showcase-pointer--teal" />
              <div className="eflow-showcase-badge-avatar eflow-showcase-avatar--teal">
                <ShieldCheck size={20} />
              </div>
            </div>

            <div className="eflow-showcase-done-tag">
              <span className="eflow-showcase-pointer eflow-showcase-pointer--amber" />
              <span>{doneLabel}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="showcase-cascade"
            className="eflow-showcase-cascade"
            variants={sceneVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={motionTransition.navigation}
          >
            <div className="eflow-cascade-pill is-faded-2">
              <span className="eflow-showcase-avatar eflow-showcase-avatar--amber">PM</span>
              <span className="eflow-cascade-skeleton" />
              <span className="eflow-cascade-chip is-soft-blue" />
            </div>

            <div className="eflow-cascade-pill is-faded-1">
              <span className="eflow-showcase-avatar eflow-showcase-avatar--violet">LD</span>
              <span className="eflow-cascade-skeleton is-wide" />
              <span className="eflow-cascade-chip is-soft-green" />
            </div>

            <div className="eflow-cascade-pill is-featured">
              <span className="eflow-showcase-avatar eflow-showcase-avatar--blue">
                {userInitials}
              </span>
              <span className="eflow-cascade-text">{cascadeLabel}</span>
              <span className="eflow-cascade-status">
                <Check size={12} strokeWidth={3} />
                <span>{cascadeStatus}</span>
              </span>
            </div>

            <div className="eflow-cascade-pill is-faded-1">
              <span className="eflow-showcase-avatar eflow-showcase-avatar--teal">OP</span>
              <span className="eflow-cascade-skeleton" />
              <span className="eflow-cascade-chip is-soft-amber" />
            </div>

            <div className="eflow-cascade-pill is-faded-2">
              <span className="eflow-showcase-avatar eflow-showcase-avatar--pink">FN</span>
              <span className="eflow-cascade-skeleton is-short" />
              <span className="eflow-cascade-chip is-soft-indigo" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
