/**
 * ClassroomBg
 *
 * The classroom is the building. This component is the persistent
 * ambient architecture behind every page. Its opacity and overlay
 * intensity adapt per page context.
 *
 * imageOpacity  — how visible the photo is (0–1)
 * overlayAlpha  — how dark the colour overlay is (0–1)
 *
 * Page presets:
 *   landing      →  image: 1.0   overlay: 0.52
 *   dashboard    →  image: 0.20  overlay: 0.80
 *   work pages   →  image: 0.07  overlay: 0.93
 */
import { useTimeOfDay } from '../hooks/useTimeOfDay';

interface Props {
  imageOpacity?: number;
  overlayAlpha?: number;
}

// Time-of-day overlay colour shifts — very subtle, just a tint
const TOD_TINT: Record<string, string> = {
  morning:   'rgba(12, 10, 8,',    // near black, faint warm hint
  afternoon: 'rgba(10, 10, 10,',   // pure neutral dark
  evening:   'rgba(12, 10, 8,',    // same warm hint as morning
  night:     'rgba(8, 8, 8,',      // pure dark — no blue, no tint
};

export default function ClassroomBg({
  imageOpacity = 0.07,
  overlayAlpha = 0.93,
}: Props) {
  const tod = useTimeOfDay();
  const tint = TOD_TINT[tod] ?? 'rgba(10, 10, 14,';

  return (
    <>
      {/* The classroom photograph */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          backgroundImage: 'url(/USE_THIS_FOR_CLASSROOM.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          opacity: imageOpacity,
          // Transition between pages feels like adjusting the blinds
          transition: 'opacity 0.8s ease',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* Time-of-day tinted overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          background: `${tint} ${overlayAlpha})`,
          transition: 'background 2s ease',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    </>
  );
}
