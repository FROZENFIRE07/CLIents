import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, TrendingUp, Bell, LogOut, ClipboardList } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
            <span>CMS Dashboard</span>
          </div>
        </div>

        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard /> Dashboard
          </NavLink>
          <NavLink to="/students" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Users /> Students
          </NavLink>
          <NavLink to="/attendance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <CalendarCheck /> Attendance
          </NavLink>
          <NavLink to="/performance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <TrendingUp /> Performance
          </NavLink>
          <NavLink to="/exams" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ClipboardList /> Exams & Marks
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Bell /> Notifications
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding: '0 12px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
            {user.name || 'Admin'}
          </div>
          <button onClick={handleLogout}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
