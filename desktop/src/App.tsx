import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import AmbientBackground from './components/AmbientBackground';
import TitleBar from './components/TitleBar';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import AttendancePage from './pages/AttendancePage';
import PerformancePage from './pages/PerformancePage';
import NotificationsPage from './pages/NotificationsPage';
import ExamsPage from './pages/ExamsPage';
import { syncEngine } from './services/syncEngine';
import { cache } from './services/cache';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * SyncInitializer — starts the SyncEngine when user is authenticated.
 * Sits inside BrowserRouter so it can use hooks.
 */
function SyncInitializer() {
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    if (token) {
      syncEngine.start();
    }
    return () => {
      syncEngine.stop();
    };
  }, [token]);

  // Listen for logout (localStorage clear) → wipe IndexedDB cache
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'accessToken' && !e.newValue) {
        syncEngine.stop();
        cache.clearAll();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return null;
}

// Only animate when entering from /home or /login into the layout pages.
// Sidebar-to-sidebar navigation should be instant with no animation.
function AnimatedRoutes() {
  const location = useLocation();
  const prevPathRef = React.useRef(location.pathname);
  const [animKey, setAnimKey] = React.useState(0);

  React.useEffect(() => {
    const prev = prevPathRef.current;
    const cur = location.pathname;
    prevPathRef.current = cur;

    // Determine if we're crossing a boundary that warrants animation
    const isFromOutside = prev === '/home' || prev === '/login';
    const isToLayout = cur !== '/home' && cur !== '/login';

    const isFromLayout = prev !== '/home' && prev !== '/login';
    const isToOutside = cur === '/home' || cur === '/login';

    if ((isFromOutside && isToLayout) || (isFromLayout && isToOutside)) {
      setAnimKey(k => k + 1); // trigger animation
    }
  }, [location.pathname]);

  return (
    <div className="routes-wrapper" key={animKey} style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: animKey > 0 ? 'page-enter 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' : 'none',
    }}>
      <Routes location={location}>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/home"
          element={<ProtectedRoute><LandingPage /></ProtectedRoute>}
        />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="exams" element={<ExamsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AmbientBackground masterOpacity={0.85} />
      <SyncInitializer />
      <div className="app-shell">
        <TitleBar />
        <div className="app-shell-body">
          <AnimatedRoutes />
        </div>
      </div>
    </BrowserRouter>
  );
}
