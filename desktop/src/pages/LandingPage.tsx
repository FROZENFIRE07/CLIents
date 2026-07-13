import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  BookOpen,
  Users,
  ClipboardList,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { useDashboardStore } from '../stores/useDashboardStore';
import { useClassStore } from '../stores/useClassStore';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  if (h < 21) return 'Good Evening,';
  return 'Good Night,';
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDay(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}

export default function LandingPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const today = new Date();

  // ── Read from stores (IndexedDB cache) — instant, no API calls ──
  const { analytics, notifStats } = useDashboardStore();
  const { classes } = useClassStore();

  const glance = {
    classesToday: analytics?.totalSessions ?? classes.length,
    attendancePending: analytics?.pendingAttendance ?? 0,
    examsUpcoming: analytics?.upcomingExams ?? 0,
    unreadMessages: notifStats?.queued ?? 0,
  };

  return (
    <div className="landing-root">


      {/* ── Hero Content ── */}
      <main className="landing-main">
        {/* Left: Greeting + CTA */}
        <section className="landing-hero">
          <div className="landing-greeting">{getGreeting()}</div>
          <h1 className="landing-name">{user.name || 'Administrator'}</h1>
          <div className="landing-divider" />
          <p className="landing-tagline">Let's get today's school running.</p>

          <div className="landing-cta-row">
            <button
              className="landing-cta-btn"
              onClick={() => navigate('/')}
              id="landing-start-today"
            >
              <span className="landing-cta-icon">
                <ArrowRight size={18} strokeWidth={2.5} />
              </span>
              <span className="landing-cta-label">Start Today</span>
            </button>
            <button
              className="landing-enter-btn"
              onClick={() => navigate('/')}
              id="landing-enter-dashboard"
            >
              Enter Dashboard&nbsp;<ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Quote */}
          <div className="landing-quote">
            <span className="landing-quote-mark">"</span>
            <span className="landing-quote-text">
              Consistency is the key<br />to student success.
            </span>
          </div>
        </section>

        {/* Right: Today at a Glance */}
        <aside className="landing-glance">
          <p className="glance-title">TODAY AT A GLANCE</p>

          <div className="glance-date-block">
            <CalendarDays size={16} strokeWidth={1.8} style={{ opacity: 0.6 }} />
            <div>
              <div className="glance-date-main">{formatDate(today)}</div>
              <div className="glance-date-day">{formatDay(today)}</div>
            </div>
          </div>

          <div className="glance-divider" />

          <div className="glance-row">
            <div className="glance-row-left">
              <BookOpen size={16} strokeWidth={1.8} />
              <div>
                <div className="glance-row-label">Classes Today</div>
                <div className="glance-row-sub">{glance.classesToday} Classes Scheduled</div>
              </div>
            </div>
            <span className="glance-count">{glance.classesToday}</span>
          </div>

          <div className="glance-row">
            <div className="glance-row-left">
              <Users size={16} strokeWidth={1.8} />
              <div>
                <div className="glance-row-label">Attendance</div>
                <div className="glance-row-sub">Pending for {glance.attendancePending} Classes</div>
              </div>
            </div>
            <span className="glance-count">{glance.attendancePending}</span>
          </div>

          <div className="glance-row">
            <div className="glance-row-left">
              <ClipboardList size={16} strokeWidth={1.8} />
              <div>
                <div className="glance-row-label">Exams / Tests</div>
                <div className="glance-row-sub">
                  {glance.examsUpcoming === 1 ? '1 Test Tomorrow' : `${glance.examsUpcoming} Upcoming`}
                </div>
              </div>
            </div>
            <span className="glance-count">{glance.examsUpcoming}</span>
          </div>

          <div className="glance-row">
            <div className="glance-row-left">
              <MessageSquare size={16} strokeWidth={1.8} />
              <div>
                <div className="glance-row-label">Messages</div>
                <div className="glance-row-sub">{glance.unreadMessages} Unread Messages</div>
              </div>
            </div>
            <span className="glance-count">{glance.unreadMessages}</span>
          </div>

          <button
            className="glance-schedule-btn"
            onClick={() => navigate('/')}
            id="landing-view-schedule"
          >
            View full schedule <ArrowRight size={14} strokeWidth={2} />
          </button>
        </aside>
      </main>

      {/* ── Bottom tagline ── */}
      <footer className="landing-footer">
        <div className="landing-footer-line" />
        <p className="landing-footer-text">Every class has potential. Every day is an opportunity.</p>
        <div className="landing-footer-line" />
      </footer>
    </div>
  );
}
