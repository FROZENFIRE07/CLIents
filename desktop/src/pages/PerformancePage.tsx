import { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../services/api';
import { useClassStore } from '../stores/useClassStore';
import { useStudentStore } from '../stores/useStudentStore';
import { cache } from '../services/cache';

export default function PerformancePage() {
  const { classes } = useClassStore();
  const { students, loadByClass, init } = useStudentStore();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [perfData, setPerfData] = useState<any>(null);
  const [hasData, setHasData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Init student store refresh listener
  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, []);

  // Auto-select first class
  useEffect(() => {
    if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]._id);
  }, [classes]);

  // Load students from cache when class changes
  useEffect(() => {
    if (!selectedClass) return;
    loadByClass(selectedClass);
    setSelectedStudent('');
    setPerfData(null);
    setHasData(false);
  }, [selectedClass]);

  // Auto-select first student
  useEffect(() => {
    if (students.length > 0 && !selectedStudent) setSelectedStudent(students[0]._id);
  }, [students]);

  // ── Offline-first: cache → render → background refresh ──
  useEffect(() => {
    if (!selectedStudent) return;

    // Step 1: Instantly load cached performance data
    (async () => {
      const cached = await cache.getMeta<any>(`perf_${selectedStudent}`);
      if (cached && mountedRef.current) {
        setPerfData(cached);
        setHasData(true);
      }
    })();

    // Step 2: Silently fetch fresh data in background
    setRefreshing(true);
    api.get(`/analytics/performance?studentId=${selectedStudent}`)
      .then(({ data }) => {
        if (!mountedRef.current) return;
        setPerfData(data.data);
        setHasData(true);
        // Update cache for next time
        cache.setMeta(`perf_${selectedStudent}`, data.data);
      })
      .catch(() => {
        // API failed — cached data is already showing
      })
      .finally(() => { if (mountedRef.current) setRefreshing(false); });
  }, [selectedStudent]);

  const marksChart = perfData?.marks?.map((m: any) => ({
    exam: m.examId?.name || '?',
    score: m.marksObtained,
    max: m.examId?.maxMarks || 100,
    pct: m.examId?.maxMarks ? Math.round((m.marksObtained / m.examId.maxMarks) * 100) : 0,
  })) || [];

  const selectedStudentObj = students.find(s => s._id === selectedStudent);

  return (
    <>
      <div className="page-header">
        <h2>Performance Analytics</h2>
        <p>Track student academic performance and attendance</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>Class</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Student</label>
          <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
            {students.map(s => <option key={s._id} value={s._id}>{s.rollNo} — {s.fullName}</option>)}
          </select>
        </div>
        {refreshing && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', alignSelf: 'flex-end', marginBottom: 4 }}>
            ● Refreshing…
          </span>
        )}
      </div>

      {!hasData && !refreshing ? (
        <div className="loading-center">Select a student to view performance</div>
      ) : !hasData && refreshing ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : perfData ? (
        <>
          {/* Student summary */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Student</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{selectedStudentObj?.fullName || '—'}</div>
              <div className="stat-sub">Roll No: {selectedStudentObj?.rollNo}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Attendance</div>
              <div className="stat-value" style={{ color: parseFloat(perfData.attendance.rate) >= 75 ? 'var(--success)' : 'var(--danger)' }}>
                {perfData.attendance.rate}%
              </div>
              <div className="stat-sub">{perfData.attendance.present}/{perfData.attendance.total} days present</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Exams Taken</div>
              <div className="stat-value">{perfData.marks?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average Score</div>
              <div className="stat-value" style={{ color: 'var(--accent)' }}>
                {marksChart.length > 0 ? Math.round(marksChart.reduce((a: number, c: any) => a + c.pct, 0) / marksChart.length) : 0}%
              </div>
            </div>
          </div>

          {/* Score Trend */}
          <div className="chart-card">
            <h3>Score Trend</h3>
            {marksChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={marksChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A4A" />
                  <XAxis dataKey="exam" stroke="#606080" fontSize={12} tickLine={false} />
                  <YAxis stroke="#606080" fontSize={12} tickLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={{ background: '#1E1E38', border: '1px solid #2A2A4A', borderRadius: 8, fontSize: 13 }} />
                  <Line type="monotone" dataKey="pct" stroke="#00CEC9" strokeWidth={2} dot={{ fill: '#00CEC9', r: 4 }} name="Score %" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="loading-center" style={{ height: 200 }}>No exam data yet</div>
            )}
          </div>

          {/* Marks Table */}
          {perfData.marks?.length > 0 && (
            <div className="chart-card">
              <h3>Exam Results</h3>
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Max</th><th>Percentage</th></tr></thead>
                  <tbody>
                    {perfData.marks.map((m: any, i: number) => {
                      const pct = m.examId?.maxMarks ? Math.round((m.marksObtained / m.examId.maxMarks) * 100) : 0;
                      return (
                        <tr key={i}>
                          <td>{m.examId?.name}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{m.examId?.subject}</td>
                          <td><strong>{m.marksObtained}</strong></td>
                          <td style={{ color: 'var(--text-muted)' }}>{m.examId?.maxMarks}</td>
                          <td><span className={`badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>{pct}%</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
