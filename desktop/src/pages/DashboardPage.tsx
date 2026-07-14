import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Lock, ArrowRight, Clock,
  Users, ClipboardList, MessageSquare, CheckCheck,
  ChevronRight,
} from 'lucide-react';
import { useClassStore } from '../stores/useClassStore';
import { useDashboardStore } from '../stores/useDashboardStore';

/* ── helpers ─────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  if (h < 21) return 'Good Evening,';
  return 'Good Night,';
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/* ── Circular SVG ring ───────────────────── */
function RingProgress({ value, max }: { value: number; max: number }) {
  const r = 80;
  const sw = 5;
  const size = (r + sw) * 2 + 4;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#ffffff" strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  );
}

/* ── Journey Step ────────────────────────── */
function JourneyStep({
  label, sub, status, last,
}: { label: string; sub: string; status: 'done' | 'locked' | 'pending'; last?: boolean }) {
  return (
    <div className="db-journey-step">
      <div className={`db-journey-icon db-journey-icon--${status}`}>
        {status === 'done'
          ? <CheckCircle2 size={18} strokeWidth={2} />
          : <Lock size={15} strokeWidth={2} />}
      </div>
      {!last && <div className="db-journey-line" />}
      <div className="db-journey-label">{label}</div>
      <div className="db-journey-sub">{sub}</div>
    </div>
  );
}

/* ── Mini rate bar ───────────────────────── */
function RateBar({ rate }: { rate: number }) {
  const opacity = rate >= 75 ? 0.85 : rate >= 50 ? 0.45 : 0.2;
  return (
    <div className="db-rate-bar-track">
      <div
        className="db-rate-bar-fill"
        style={{ width: `${rate}%`, opacity }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════ */
export default function DashboardPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const today = new Date();

  // ── Read from stores (IndexedDB cache) — instant, no API calls ──
  const { classes: allClasses } = useClassStore();
  const { analytics: dashData, sessions, notifStats } = useDashboardStore();
  const classNameById = new Map(allClasses.map((cls: any) => [String(cls._id), cls.name]));
  const isCompletedSession = (status: string) => status === 'submitted' || status === 'notifications_sent';
  const getClassName = (classId: any) => {
    if (!classId) return '—';
    if (typeof classId === 'object') {
      return classId.name || classNameById.get(String(classId._id)) || '—';
    }
    return classNameById.get(String(classId)) || '—';
  };

  const [time, setTime] = useState(fmtTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(fmtTime(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  // Build today's attendance map from cached sessions
  const todayStr = today.toISOString().split('T')[0];
  const todayMap = new Map<string, any>();
  sessions.forEach((s: any) => {
    const sDate = s.date ? new Date(s.date).toISOString().split('T')[0] : '';
    if (sDate === todayStr && isCompletedSession(s.status)) {
      todayMap.set(String(s.classId), s);
    }
  });

  /* ── derived data ── */
  const classRows = allClasses.map((cls: any) => {
    const session = todayMap.get(String(cls._id));
    return { id: cls._id, name: cls.name, done: !!session, session };
  });

  const doneClasses    = classRows.filter(r => r.done);
  const pendingClasses = classRows.filter(r => !r.done);
  const ringDone       = doneClasses.length;
  const ringTotal      = classRows.length || 1;
  const nextPending    = pendingClasses[0];

  const attendanceDone    = ringDone > 0 && ringDone === ringTotal;
  const attendancePartial = ringDone > 0 && ringDone < ringTotal;
  const comsDone          = (notifStats?.sent ?? 0) > 0;

  // Recent submitted sessions (newest first, already sorted by store)
  const recentSessions = sessions
    .filter((s: any) => isCompletedSession(s.status))
    .slice(0, 7);

  /* ═══════════════════════════════════════════ */
  return (
    <div className="db-root">

      {/* ══ ROW 1: Greeting + Journey ══ */}
      <div className="db-top-row">

        <div className="db-greeting-block">
          <div className="db-clock">
            <Clock size={13} strokeWidth={1.8} style={{ opacity: 0.4 }} />
            <span>{time}</span>
          </div>
          <p className="db-good">{getGreeting()}</p>
          <h1 className="db-name">{user.name || 'Administrator'}</h1>
          <p className="db-date">{fmtDate(today)}</p>
          <div className="db-top-quote">
            <span className="db-top-quote-mark">"</span>
            <span className="db-top-quote-text">Every class has potential.<br />Every day is an opportunity.</span>
          </div>
        </div>

        <div className="db-card db-journey-card">
          <p className="db-card-label">Today's Journey</p>
          <div className="db-journey-track">
            <JourneyStep
              label="Attendance"
              sub={
                attendanceDone    ? `${ringDone} / ${ringTotal} Done`
                : attendancePartial ? `${ringDone} / ${ringTotal} Completed`
                : ringTotal === 0   ? 'No classes'
                : 'Not started'
              }
              status={attendanceDone ? 'done' : attendancePartial ? 'pending' : 'locked'}
            />
            <JourneyStep label="Marks" sub="Locked" status="locked" />
            <JourneyStep
              label="Communication"
              sub={comsDone ? `${notifStats?.sent ?? 0} sent` : 'Locked'}
              status={comsDone ? 'done' : 'locked'}
              last
            />
          </div>

          {/* Global stats strip inside Journey card */}
          <div className="db-journey-stats">
            <div className="db-j-stat">
              <span className="db-j-stat-val">{dashData?.totalStudents ?? 0}</span>
              <span className="db-j-stat-lbl">Total Students</span>
            </div>
            <div className="db-j-stat-div" />
            <div className="db-j-stat">
              <span className="db-j-stat-val">
                {dashData?.averageAttendance != null ? `${dashData.averageAttendance}%` : '—'}
              </span>
              <span className="db-j-stat-lbl">Avg Attendance</span>
            </div>
            <div className="db-j-stat-div" />
            <div className="db-j-stat">
              <span className="db-j-stat-val">{dashData?.totalSessions ?? 0}</span>
              <span className="db-j-stat-lbl">Total Sessions</span>
            </div>
            <div className="db-j-stat-div" />
            <div className="db-j-stat">
              <span className="db-j-stat-val">{notifStats?.sent ?? 0}</span>
              <span className="db-j-stat-lbl">Msgs Sent</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ROW 2: 3-column cards ══ */}
      <div className="db-main-row">

        {/* Col 1 — Today's Attendance Progress */}
        <div className="db-card db-progress-card">
          <p className="db-card-label">Today's Attendance Progress</p>

          <div className="db-ring-row">
            <div className="db-ring-wrap">
              <RingProgress value={ringDone} max={ringTotal} />
              <div className="db-ring-center">
                <span className="db-ring-num">{ringDone}</span>
                <span className="db-ring-denom">/ {ringTotal}</span>
                <span className="db-ring-sub">Done</span>
              </div>
            </div>

            <div className="db-session-list">
              {classRows.length === 0 && (
                <div className="db-no-sessions">No classes found</div>
              )}
              {classRows.slice(0, 5).map((row, i) => (
                <div key={i} className={`db-session-row ${row.done ? 'db-session-row--done' : ''}`}>
                  <div className={`db-session-dot ${row.done ? 'db-session-dot--done' : ''}`}>
                    {row.done && <CheckCheck size={10} strokeWidth={2.5} />}
                  </div>
                  <span className="db-session-name">{row.name}</span>
                  <span className={`db-session-status ${row.done ? 'db-session-status--done' : ''}`}>
                    {row.done ? 'Completed' : 'Pending'}
                  </span>
                  {row.session?.date
                    ? <span className="db-session-time">{fmtShortDate(row.session.date)}</span>
                    : <span className="db-session-time">—</span>}
                </div>
              ))}
            </div>
          </div>

          {/* footer */}
          <div className="db-progress-footer">
            {nextPending ? (
              <>
                <div className="db-footer-next">
                  <span className="db-footer-label">Next Pending</span>
                  <span className="db-footer-class">{nextPending.name}</span>
                </div>
                <button className="db-open-mobile" onClick={() => navigate('/attendance')}>
                  Open Attendance <ArrowRight size={13} strokeWidth={2} />
                </button>
              </>
            ) : ringTotal > 0 ? (
              <div className="db-footer-next">
                <CheckCircle2 size={14} strokeWidth={1.8} style={{ color: 'rgba(255,255,255,0.45)' }} />
                <span className="db-footer-label">All classes marked today</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Col 2 — Needs Attention */}
        <div className="db-card db-attention-card">
          <p className="db-card-label">Needs Attention</p>

          <div className="db-attention-list">
            {pendingClasses.length > 0 && (
              <button className="db-attention-row" onClick={() => navigate('/attendance')}>
                <div className="db-attention-icon"><Users size={15} strokeWidth={1.8} /></div>
                <div className="db-attention-text">
                  <span className="db-attention-title">Attendance Pending</span>
                  <span className="db-attention-sub">
                    {pendingClasses.length} {pendingClasses.length === 1 ? 'class' : 'classes'} remaining
                  </span>
                </div>
                <ChevronRight size={15} style={{ opacity: 0.35, flexShrink: 0 }} />
              </button>
            )}

            {(notifStats?.queued ?? 0) > 0 && (
              <button className="db-attention-row" onClick={() => navigate('/notifications')}>
                <div className="db-attention-icon"><MessageSquare size={15} strokeWidth={1.8} /></div>
                <div className="db-attention-text">
                  <span className="db-attention-title">Messages Queued</span>
                  <span className="db-attention-sub">{notifStats?.queued ?? 0} pending to send</span>
                </div>
                <ChevronRight size={15} style={{ opacity: 0.35, flexShrink: 0 }} />
              </button>
            )}

            {(notifStats?.failed ?? 0) > 0 && (
              <button className="db-attention-row" onClick={() => navigate('/notifications')}>
                <div className="db-attention-icon"><MessageSquare size={15} strokeWidth={1.8} /></div>
                <div className="db-attention-text">
                  <span className="db-attention-title">Failed Messages</span>
                  <span className="db-attention-sub">{notifStats?.failed ?? 0} need retry</span>
                </div>
                <ChevronRight size={15} style={{ opacity: 0.35, flexShrink: 0 }} />
              </button>
            )}

            <button className="db-attention-row" onClick={() => navigate('/exams')}>
              <div className="db-attention-icon"><ClipboardList size={15} strokeWidth={1.8} /></div>
              <div className="db-attention-text">
                <span className="db-attention-title">Exam Schedule</span>
                <span className="db-attention-sub">Review upcoming tests</span>
              </div>
              <ChevronRight size={15} style={{ opacity: 0.35, flexShrink: 0 }} />
            </button>

            {pendingClasses.length === 0 && !((notifStats?.queued ?? 0) > 0) && !((notifStats?.failed ?? 0) > 0) && (
              <div className="db-all-clear">
                <CheckCircle2 size={14} strokeWidth={1.8} style={{ opacity: 0.4 }} />
                <span>No urgent student issues</span>
              </div>
            )}
          </div>

          {/* Notification breakdown */}
          <div className="db-notif-breakdown">
            <p className="db-card-label" style={{ marginBottom: 12 }}>Notification Activity</p>
            <div className="db-notif-row">
              <span className="db-notif-label">Sent</span>
              <div className="db-notif-bar-track">
                <div className="db-notif-bar-fill db-notif-bar--sent"
                  style={{ width: `${Math.min(((notifStats?.sent ?? 0) / Math.max((notifStats?.sent ?? 0) + (notifStats?.queued ?? 0) + (notifStats?.failed ?? 0), 1)) * 100, 100)}%` }} />
              </div>
              <span className="db-notif-count">{notifStats?.sent ?? 0}</span>
            </div>
            <div className="db-notif-row">
              <span className="db-notif-label">Queued</span>
              <div className="db-notif-bar-track">
                <div className="db-notif-bar-fill db-notif-bar--queued"
                  style={{ width: `${Math.min(((notifStats?.queued ?? 0) / Math.max((notifStats?.sent ?? 0) + (notifStats?.queued ?? 0) + (notifStats?.failed ?? 0), 1)) * 100, 100)}%` }} />
              </div>
              <span className="db-notif-count">{notifStats?.queued ?? 0}</span>
            </div>
            <div className="db-notif-row">
              <span className="db-notif-label">Failed</span>
              <div className="db-notif-bar-track">
                <div className="db-notif-bar-fill db-notif-bar--failed"
                  style={{ width: `${Math.min(((notifStats?.failed ?? 0) / Math.max((notifStats?.sent ?? 0) + (notifStats?.queued ?? 0) + (notifStats?.failed ?? 0), 1)) * 100, 100)}%` }} />
              </div>
              <span className="db-notif-count">{notifStats?.failed ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Col 3 — Recent Sessions (real data from analytics/dashboard) */}
        <div className="db-card db-recent-card">
          <p className="db-card-label">Recent Sessions</p>

          {recentSessions.length === 0 ? (
            <div className="db-no-sessions" style={{ paddingTop: 24 }}>No sessions recorded yet</div>
          ) : (
            <div className="db-recent-list">
              {recentSessions.map((s: any, i: number) => {
                const rate = s.totalStudents > 0
                  ? Math.round((s.presentCount / s.totalStudents) * 100) : 0;
                return (
                  <div key={i} className="db-recent-row">
                    <div className="db-recent-meta">
                      <span className="db-recent-class">{getClassName(s.classId)}</span>
                      <span className="db-recent-date">{s.date ? fmtShortDate(s.date) : '—'}</span>
                    </div>
                    <div className="db-recent-stats">
                      <RateBar rate={rate} />
                      <div className="db-recent-numbers">
                        <span className="db-recent-rate">{rate}%</span>
                        <span className="db-recent-count">{s.presentCount}/{s.totalStudents}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button className="db-view-all-btn" onClick={() => navigate('/attendance')}>
            View all sessions <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ══ BOTTOM: Quote ══ */}
      <div className="db-bottom-bar">
        <div className="db-bottom-quote">
          <span className="db-bottom-quote-mark">"</span>
          <div>
            <p className="db-bottom-quote-text">Small steps today, stronger results tomorrow.</p>
            <div className="db-bottom-quote-line" />
          </div>
        </div>
      </div>
    </div>
  );
}
