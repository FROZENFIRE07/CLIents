import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../services/api';

export default function AttendancePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/classes').then(({ data }) => {
      setClasses(data.data.classes);
      if (data.data.classes.length > 0) setSelectedClass(data.data.classes[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    Promise.all([
      api.get(`/analytics/attendance?classId=${selectedClass}`),
      api.get(`/attendance/sessions?classId=${selectedClass}&limit=20`),
    ]).then(([analyticsRes, sessionsRes]) => {
      setTimeline(analyticsRes.data.data.timeline || []);
      setSessions(sessionsRes.data.data.sessions || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedClass]);

  const chartData = timeline.map((t: any) => ({
    date: new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    rate: parseFloat(t.rate),
    present: t.present,
    absent: t.absent,
  }));

  const avgRate = chartData.length > 0
    ? Math.round(chartData.reduce((a, c) => a + c.rate, 0) / chartData.length) : 0;

  const lowAttendanceDays = chartData.filter(d => d.rate < 75).length;

  return (
    <>
      <div className="page-header">
        <h2>Attendance Analytics</h2>
        <p>Track attendance patterns and identify trends</p>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
        {classes.map((c) => (
          <button key={c._id}
            className={`btn ${selectedClass === c._id ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => setSelectedClass(c._id)}>
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Average Rate</div>
              <div className="stat-value" style={{ color: avgRate >= 75 ? 'var(--success)' : 'var(--danger)' }}>{avgRate}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Sessions</div>
              <div className="stat-value">{sessions.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Low Attendance Days</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{lowAttendanceDays}</div>
              <div className="stat-sub">Below 75%</div>
            </div>
          </div>

          <div className="chart-card">
            <h3>Daily Attendance Rate</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="date" stroke="#606080" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#606080" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#1E1E38', border: '1px solid #2A2A4A', borderRadius: 8, fontSize: 13 }}
                    labelStyle={{ color: '#9090B0' }}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Attendance %">
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.rate >= 75 ? '#00B894' : entry.rate >= 50 ? '#FDCB6E' : '#E17055'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="loading-center" style={{ height: 200 }}>No attendance data yet</div>
            )}
          </div>

          <div className="chart-card">
            <h3>Session History</h3>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>Date</th><th>Present</th><th>Absent</th><th>Total</th><th>Rate</th><th>Status</th></tr></thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No sessions</td></tr>
                  ) : sessions.map((s: any) => {
                    const rate = s.totalStudents > 0 ? Math.round((s.presentCount / s.totalStudents) * 100) : 0;
                    return (
                      <tr key={s._id}>
                        <td>{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ color: 'var(--success)' }}>{s.presentCount}</td>
                        <td style={{ color: 'var(--danger)' }}>{s.absentCount}</td>
                        <td>{s.totalStudents}</td>
                        <td><span className={`badge ${rate >= 75 ? 'badge-success' : 'badge-danger'}`}>{rate}%</span></td>
                        <td><span className={`badge badge-${s.status === 'submitted' ? 'primary' : s.status === 'notifications_sent' ? 'success' : 'warning'}`}>{s.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
