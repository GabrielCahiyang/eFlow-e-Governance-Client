import { memo } from "react";
import styles from "../LandingPage.module.scss";

interface SignalBeam {
  id: string;
  axis: "h" | "v";
  trackPct: number;
  durationSec: number;
  delaySec: number;
  reverse?: boolean;
  lengthPx: number;
}

// Staggered horizontal & vertical fiber-optic workflow streaks across the midnight-navy grid
const SIGNAL_BEAMS: SignalBeam[] = [
  { id: "h-1", axis: "h", trackPct: 18, durationSec: 7.4, delaySec: -1.2, lengthPx: 170 },
  { id: "h-2", axis: "h", trackPct: 36, durationSec: 9.2, delaySec: -5.4, reverse: true, lengthPx: 210 },
  { id: "h-3", axis: "h", trackPct: 64, durationSec: 8.1, delaySec: -3.1, lengthPx: 190 },
  { id: "h-4", axis: "h", trackPct: 82, durationSec: 6.8, delaySec: -4.6, reverse: true, lengthPx: 150 },
  { id: "v-1", axis: "v", trackPct: 14, durationSec: 8.4, delaySec: -2.0, lengthPx: 160 },
  { id: "v-2", axis: "v", trackPct: 31, durationSec: 10.2, delaySec: -6.8, reverse: true, lengthPx: 195 },
  { id: "v-3", axis: "v", trackPct: 69, durationSec: 7.6, delaySec: -1.6, lengthPx: 175 },
  { id: "v-4", axis: "v", trackPct: 86, durationSec: 9.0, delaySec: -5.0, reverse: true, lengthPx: 165 },
];

const SIGNAL_NODES: { id: string; leftPct: number; topPct: number; delaySec: number }[] = [
  { id: "n-1", leftPct: 14, topPct: 18, delaySec: 0 },
  { id: "n-2", leftPct: 86, topPct: 18, delaySec: -2.4 },
  { id: "n-3", leftPct: 31, topPct: 36, delaySec: -1.1 },
  { id: "n-4", leftPct: 69, topPct: 64, delaySec: -3.7 },
  { id: "n-5", leftPct: 14, topPct: 82, delaySec: -4.5 },
  { id: "n-6", leftPct: 86, topPct: 82, delaySec: -1.9 },
];

export const AmbientSignalGrid = memo(function AmbientSignalGrid() {
  return (
    <div className={styles.signalGridLayer} aria-hidden="true">
      {/* Subtle architectural hairline coordinate grid */}
      <div className={styles.signalGridLines} />

      {/* Traveling ice-blue light streaks along horizontal and vertical grid tracks */}
      {SIGNAL_BEAMS.map((beam) => {
        const isHorizontal = beam.axis === "h";
        const trackClass = isHorizontal
          ? styles.signalTrackH
          : styles.signalTrackV;
        const beamClass = isHorizontal
          ? beam.reverse
            ? `${styles.signalBeamH} ${styles.signalBeamHReverse}`
            : styles.signalBeamH
          : beam.reverse
            ? `${styles.signalBeamV} ${styles.signalBeamVReverse}`
            : styles.signalBeamV;

        return (
          <div
            key={beam.id}
            className={trackClass}
            style={
              isHorizontal
                ? { top: `${beam.trackPct}%` }
                : { left: `${beam.trackPct}%` }
            }
          >
            <span
              className={beamClass}
              style={{
                ...(isHorizontal
                  ? { width: `${beam.lengthPx}px` }
                  : { height: `${beam.lengthPx}px` }),
                animationDuration: `${beam.durationSec}s`,
                animationDelay: `${beam.delaySec}s`,
              }}
            />
          </div>
        );
      })}

      {/* Soft precision node pulses at key grid intersections */}
      {SIGNAL_NODES.map((node) => (
        <span
          key={node.id}
          className={styles.signalNode}
          style={{
            left: `${node.leftPct}%`,
            top: `${node.topPct}%`,
            animationDelay: `${node.delaySec}s`,
          }}
        />
      ))}
    </div>
  );
});
