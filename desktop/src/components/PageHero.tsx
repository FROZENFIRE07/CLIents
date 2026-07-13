/**
 * PageHero
 *
 * The contextual banner that sits at the top of every work page.
 * It carries the same DNA as the landing — same typography, same atmosphere —
 * but scaled down to give context without competing with the content below.
 *
 * Dashboard:    height ~220px — greeting + name, large
 * Students:     height ~130px — "Good Morning, Administrator" + subtitle
 * Attendance:   height ~100px — just the context line + date
 * Other pages:  height ~110px — label + page description
 */
import { getGreeting } from '../hooks/useTimeOfDay';

interface Props {
  /** Page-level label shown below the greeting, e.g. "Students" */
  label: string;
  /** Optional secondary line, e.g. "Manage your institute roster." */
  sub?: string;
  /** Show full greeting + name block (Dashboard only) */
  showGreeting?: boolean;
  /** User name for greeting */
  userName?: string;
  /** Override height in px */
  height?: number;
}

export default function PageHero({
  label,
  sub,
  showGreeting = false,
  userName = 'Administrator',
  height = 120,
}: Props) {
  return (
    <div className="page-hero" style={{ height }}>
      {showGreeting ? (
        <>
          <p className="page-hero-greeting">{getGreeting()}</p>
          <h1 className="page-hero-name">{userName}</h1>
          <div className="page-hero-divider" />
          <p className="page-hero-label-large">{label}</p>
        </>
      ) : (
        <>
          <p className="page-hero-greeting">{getGreeting().replace(',', '')} — {userName}</p>
          <div className="page-hero-divider" />
          <h1 className="page-hero-label">{label}</h1>
          {sub && <p className="page-hero-sub">{sub}</p>}
        </>
      )}
    </div>
  );
}
