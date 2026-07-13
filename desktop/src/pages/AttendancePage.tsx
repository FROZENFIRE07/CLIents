import { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../services/api';
import PageHero from '../components/PageHero';
import { useClassStore } from '../stores/useClassStore';
import { useDashboardStore } from '../stores/useDashboardStore';
import { cache } from '../services/cache';
import { syncEngine } from '../services/syncEngine';

export default function AttendancePage() {
  const { classes } = useClassStore();
  const { sessions: allSessions } = useDashboardStore();
  const [selectedClass, setSelectedClass] = useState('');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [hasData, setHasData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const mountedRef = useRef(true);
  const isCompletedSession = (status: string) => status === 'submitted' || status === 'notifications_sent';

  const getTimelineMaxDate = (items: any[]) => {
    if (items.length === 0) return 0;
    return Math.max(...items.map((item) => new Date(item.date).getTime()));
  };

  const pickNewestTimeline = (apiTimeline: any[], localTimeline: any[]) => {
    if (localTimeline.length === 0) return apiTimeline;
    if (apiTimeline.length === 0) return localTimeline;
    return getTimelineMaxDate(localTimeline) >= getTimelineMaxDate(apiTimeline)
      ? localTimeline
      : apiTimeline;
  };

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Auto-select first class
  useEffect(() => {
    if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]._id);
  }, [classes]);

  useEffect(() => {
    const unsubscribe = syncEngine.onRefresh(() => {
      setRefreshTick((value) => value + 1);
    });
    return unsubscribe;
  }, []);

  // Filter sessions from cache for selected class
  const sessions = allSessions.filter((s: any) => {
    const classId = typeof s.classId === 'object' ? s.classId?._id : s.classId;
    return classId === selectedClass;
  });
  const sessionSignature = sessions
    .map((s: any) => `${s._id}:${s.updatedAt || s.createdAt || s.date}:${s.status}`)
    .join('|');

  const localTimeline = sessions
    .filter((s: any) => isCompletedSession(s.status))
    .map((s: any) => ({
      date: s.date,
      present: s.presentCount,
      absent: s.absentCount,
      total: s.totalStudents,
      rate: s.totalStudents > 0
        ? ((s.presentCount / s.totalStudents) * 100).toFixed(1)
        : '0',
    }))
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── Offline-first: cache → render → background refresh ──
  useEffect(() => {
    if (!selectedClass) return;

    // Step 1: Instantly load cached timeline
    (async () => {
      const cached = await cache.getMeta<any[]>(`timeline_${selectedClass}`);
      if (localTimeline.length > 0 && mountedRef.current) {
        setTimeline(localTimeline);
        setHasData(true);
      } else if (cached && cached.length > 0 && mountedRef.current) {
        setTimeline(cached);
        setHasData(true);
      }
    })();

    // Step 2: Silently fetch fresh data in background
    setRefreshing(true);
    api.get(`/analytics/attendance?classId=${selectedClass}`)
      .then(({ data }) => {
        if (!mountedRef.current) return;
        const apiTimeline = data.data.timeline || [];
        const merged = pickNewestTimeline(apiTimeline, localTimeline);
        setTimeline(merged);
        setHasData(true);
        // Update cache for next time
        cache.setMeta(`timeline_${selectedClass}`, merged);
      })
      .catch(() => {
        // API failed — we already have cached data showing, so do nothing
      })
      .finally(() => { if (mountedRef.current) setRefreshing(false); });
  }, [selectedClass, refreshTick, sessionSignature]);

  const chartData = timeline.map((t: any) => ({
    date: new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    rate: parseFloat(t.rate),
    present: t.present,
    absent: t.absent,
  }));

  const avgRate = chartData.length > 0
    ? Math.round(chartData.reduce((a, c) => a + c.rate, 0) / chartData.length) : 0;

  const lowAttendanceDays = chartData.filter(d => d.rate < 75).length;

  // Bar color: high attendance = bright white, medium = dim white, low = very dim
  function barColor(rate: number) {
    if (rate >= 75) return 'rgba(255,255,255,0.85)';
    if (rate >= 50) return 'rgba(255,255,255,0.4)';
    return 'rgba(255,255,255,0.18)';
  }

  return (
    <>
      <PageHero label="Attendance" sub="Track patterns and identify trends." height={100} />

      {/* Class selector */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {classes.map((c) => (
          <button key={c._id}
            className={`btn ${selectedClass === c._id ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => setSelectedClass(c._id)}>
            {c.name}
          </button>
        ))}
        {refreshing && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
            ● Refreshing…
          </span>
        )}
      </div>

      {!hasData && !refreshing ? (
        <div className="loading-center" style={{ height: 300, color: 'var(--text-muted)' }}>
          No attendance data yet
        </div>
      ) : !hasData && refreshing ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {/* Stats strip */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Average Rate</div>
              <div className="stat-value">{avgRate}%</div>
              <div className="stat-sub" style={{ color: avgRate >= 75 ? 'rgba(255,255,255,0.5)' : 'rgba(255,180,167,0.8)' }}>
                {avgRate >= 75 ? 'Good standing' : 'Below target'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Sessions</div>
              <div className="stat-value">{sessions.length}</div>
              <div className="stat-sub">Recorded sessions</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Low Attendance Days</div>
              <div className="stat-value">{lowAttendanceDays}</div>
              <div className="stat-sub">Below 75%</div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="chart-card">
            <h3>Daily Attendance Rate</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.07)' }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{
                      background: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      fontSize: 13,
                      color: '#fff',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(val: any) => [`${val}%`, 'Attendance']}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Attendance %">
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={barColor(entry.rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="loading-center" style={{ height: 200 }}>No attendance data yet</div>
            )}
          </div>

          {/* Session history table */}
          <div className="chart-card">
            <h3>Session History</h3>
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Total</th>
                    <th>Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No sessions</td></tr>
                  ) : sessions.map((s: any) => {
                    const rate = s.totalStudents > 0 ? Math.round((s.presentCount / s.totalStudents) * 100) : 0;
                    const rateColor = rate >= 75 ? 'rgba(255,255,255,0.75)' : 'rgba(255,180,167,0.8)';
                    return (
                      <tr key={s._id}>
                        <td>{new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ color: 'rgba(255,255,255,0.75)' }}>{s.presentCount}</td>
                        <td style={{ color: 'rgba(255,255,255,0.4)' }}>{s.absentCount}</td>
                        <td>{s.totalStudents}</td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            background: rate >= 75 ? 'rgba(255,255,255,0.08)' : 'rgba(255,181,167,0.1)',
                            color: rateColor,
                          }}>
                            {rate}%
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 500,
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.45)',
                          }}>
                            {s.status}
                          </span>
                        </td>
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
