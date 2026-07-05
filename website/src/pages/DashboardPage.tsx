import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

interface DashboardData {
  totalStudents: number;
  totalSessions: number;
  attendanceRate: number;
  recentSessions: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [notifStats, setNotifStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/notifications/stats'),
    ]).then(([dashRes, notifRes]) => {
      setData(dashRes.data.data);
      setNotifStats(notifRes.data.data.stats);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  const chartData = data?.recentSessions?.map((s: any) => ({
    date: new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    rate: s.totalStudents > 0 ? Math.round((s.presentCount / s.totalStudents) * 100) : 0,
    present: s.presentCount,
    absent: s.absentCount,
  })).reverse() || [];

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of Gorade Classes management system</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Students</div>
          <div className="stat-value">{data?.totalStudents || 0}</div>
          <div className="stat-sub">Active students</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Attendance Sessions</div>
          <div className="stat-value">{data?.totalSessions || 0}</div>
          <div className="stat-sub">Total submitted</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Attendance Rate</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {data?.attendanceRate || 0}%
          </div>
          <div className="stat-sub">Last 7 sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Notifications</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {notifStats?.sent || 0}
          </div>
          <div className="stat-sub">
            {notifStats?.queued > 0 && <span className="badge badge-warning" style={{ marginRight: 6 }}>{notifStats.queued} queued</span>}
            {notifStats?.failed > 0 && <span className="badge badge-danger">{notifStats.failed} failed</span>}
            {!notifStats?.queued && !notifStats?.failed && 'All delivered'}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="chart-card">
          <h3>Attendance Trend (Recent Sessions)</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#606080" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#606080" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#1E1E38', border: '1px solid #2A2A4A', borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ color: '#9090B0' }}
                />
                <Area type="monotone" dataKey="rate" stroke="#6C5CE7" strokeWidth={2}
                  fill="url(#gradRate)" name="Attendance %" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="loading-center" style={{ height: 200 }}>No data yet</div>
          )}
        </div>

        <div className="chart-card">
          <h3>Recent Sessions</h3>
          {data?.recentSessions && data.recentSessions.length > 0 ? (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr><th>Date</th><th>Class</th><th>Present</th><th>Rate</th></tr>
                </thead>
                <tbody>
                  {data.recentSessions.map((s: any, i: number) => (
                    <tr key={i}>
                      <td>{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td>{s.classId?.name || '—'}</td>
                      <td>{s.presentCount}/{s.totalStudents}</td>
                      <td>
                        <span className={`badge ${(s.presentCount / s.totalStudents) >= 0.75 ? 'badge-success' : 'badge-danger'}`}>
                          {s.totalStudents > 0 ? Math.round((s.presentCount / s.totalStudents) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="loading-center" style={{ height: 200 }}>No sessions yet</div>
          )}
        </div>
      </div>
    </>
  );
}
