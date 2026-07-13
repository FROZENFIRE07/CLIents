import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, TrendingUp, Bell, LogOut, ClipboardList, Home } from 'lucide-react';
import SystemStatus from './SystemStatus';
import { useClassStore } from '../stores/useClassStore';
import { useDashboardStore } from '../stores/useDashboardStore';
import { useNotificationStore } from '../stores/useNotificationStore';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Initialize global stores — they read from IndexedDB immediately
  useEffect(() => {
    const cleanups = [
      useClassStore.getState().init(),
      useDashboardStore.getState().init(),
      useNotificationStore.getState().init(),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">G</div>
          <div>
            <h1>Gorade Classes</h1>
            <span>CMS Desktop</span>
          </div>
        </div>

        <nav className="nav-links">
          <NavLink to="/home" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Home size={18} strokeWidth={1.8} /> Home
          </NavLink>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} strokeWidth={1.8} /> Dashboard
          </NavLink>
          <NavLink to="/students" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Users size={18} strokeWidth={1.8} /> Students
          </NavLink>
          <NavLink to="/attendance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <CalendarCheck size={18} strokeWidth={1.8} /> Attendance
          </NavLink>
          <NavLink to="/performance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <TrendingUp size={18} strokeWidth={1.8} /> Performance
          </NavLink>
          <NavLink to="/exams" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ClipboardList size={18} strokeWidth={1.8} /> Exams & Marks
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Bell size={18} strokeWidth={1.8} /> Notifications
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <SystemStatus />
          <div style={{ padding: '0 12px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
            {user.name || 'Admin'}
          </div>
          <button onClick={handleLogout}>
            <LogOut size={16} strokeWidth={1.8} /> Sign Out
          </button>
        </div>
      </aside>

      {/* key forces remount on route change → triggers page-enter animation */}
      <main className="main-content" key={location.pathname}>
        <Outlet />
      </main>
    </div>
  );
}
