/**
 * AmbientBackground
 *
 * Mounted ONCE at the app root. Never unmounts. Navigation never affects it.
 *
 * Spec:
 * - All 4 images preloaded at startup. Zero network requests after mount.
 * - Two image layers (A + B) always in the DOM. Only opacity is animated.
 * - Time model uses transition windows, not hard switches.
 * - Recalculates every 60s, animates opacity over 1.5s easeInOutSine.
 * - GPU-only: opacity transitions, object-fit cover, no filter/blur.
 * - The user should never notice the moment it changed.
 */
import { useEffect, useState } from 'react';

import morningImg   from '/morning.png';
import afternoonImg from '/afternoon.png';
import eveningImg   from '/evening.png';
import nightImg     from '/Night.png';

// ─── Image sources (loaded once) ───────────────────────────────────────────
const IMAGES = {
  morning:   morningImg,
  afternoon: afternoonImg,
  evening:   eveningImg,
  night:     nightImg,
} as const;

type Period = keyof typeof IMAGES;

// ─── Time model ─────────────────────────────────────────────────────────────
// Each window: [startMinutes, endMinutes, fromPeriod, toPeriod]
// Outside windows = solid fromPeriod at opacity 1.0
interface Window {
  start: number;   // minutes since midnight
  end:   number;
  from:  Period;
  to:    Period;
}

const TRANSITION_WINDOWS: Window[] = [
  { start:  5*60+30, end:  8*60+30, from: 'night',     to: 'morning'   }, // 05:30–08:30
  { start:  8*60+30, end: 11*60+30, from: 'morning',   to: 'afternoon' }, // 08:30–11:30
  { start: 16*60+30, end: 19*60+30, from: 'afternoon', to: 'evening'   }, // 16:30–19:30
  { start: 19*60+30, end: 22*60+0,  from: 'evening',   to: 'night'     }, // 19:30–22:00
];

// Solid periods (no transition) inferred from the gaps:
// 11:30–16:30 → afternoon
// 22:00–05:30 → night

function minutesSinceMidnight(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// easeInOutSine
function ease(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

interface LayerState {
  period: Period;
  opacity: number;
}

/**
 * Calculates the two layer states for the current time.
 * Returns { layerA, layerB } where layerA is "from" and layerB is "to".
 * During a solid period, layerB opacity = 0.
 */
function calcLayers(minutes: number): { a: LayerState; b: LayerState } {
  // Check if we're inside a transition window
  for (const win of TRANSITION_WINDOWS) {
    if (minutes >= win.start && minutes < win.end) {
      const rawProgress = (minutes - win.start) / (win.end - win.start);
      const p = ease(rawProgress);
      return {
        a: { period: win.from, opacity: 1 - p },
        b: { period: win.to,   opacity: p },
      };
    }
  }

  // Solid period — determine which one
  const mins = minutes;
  let solid: Period = 'night';
  if (mins >= 8*60+30  && mins < 16*60+30) solid = 'afternoon';
  else if (mins >= 5*60+30 && mins < 8*60+30)  solid = 'morning'; // shouldn't hit (in window) but safety
  else if (mins >= 11*60+30 && mins < 16*60+30) solid = 'afternoon';
  else if (mins >= 16*60+30 && mins < 19*60+30) solid = 'afternoon'; // shouldn't hit
  else if (mins >= 19*60+30 && mins < 22*60)    solid = 'evening';   // shouldn't hit
  else solid = 'night';

  return {
    a: { period: solid, opacity: 1 },
    b: { period: solid, opacity: 0 },
  };
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface Props {
  /** Overall brightness multiplier — landing=1.0, work pages=0.4 */
  masterOpacity?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function AmbientBackground({ masterOpacity = 0.80 }: Props) {
  const [layers, setLayers] = useState(() => calcLayers(minutesSinceMidnight()));

  // Animate smoothly to new target using CSS transition
  useEffect(() => {
    const tick = () => {
      setLayers(calcLayers(minutesSinceMidnight()));
    };

    // First tick immediate
    tick();

    // Then every 60 seconds
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const TRANSITION = 'opacity 1.5s cubic-bezier(0.45, 0, 0.55, 1)';

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
    userSelect: 'none',
  };

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* Layer A — current / from */}
      <img
        key={`a-${layers.a.period}`}
        src={IMAGES[layers.a.period]}
        alt=""
        style={{
          ...baseStyle,
          opacity: layers.a.opacity * masterOpacity,
          transition: TRANSITION,
          zIndex: 1,
        }}
      />

      {/* Layer B — next / to (only rendered when transitioning) */}
      {layers.b.opacity > 0 && (
        <img
          key={`b-${layers.b.period}`}
          src={IMAGES[layers.b.period]}
          alt=""
          style={{
            ...baseStyle,
            opacity: layers.b.opacity * masterOpacity,
            transition: TRANSITION,
            zIndex: 2,
          }}
        />
      )}

      {/* Dark overlay — separates classroom from UI, keeps text readable */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 3,
          background: 'rgba(6, 6, 6, 0.42)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// Re-export period type for use in page-level opacity control
export type { Period };
