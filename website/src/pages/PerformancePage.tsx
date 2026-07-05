import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../services/api';

export default function PerformancePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [perfData, setPerfData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/classes').then(({ data }) => {
      setClasses(data.data.classes);
      if (data.data.classes.length > 0) setSelectedClass(data.data.classes[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    api.get(`/students?classId=${selectedClass}`).then(({ data }) => {
      setStudents(data.data.students);
      if (data.data.students.length > 0) setSelectedStudent(data.data.students[0]._id);
    });
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedStudent) return;
    setLoading(true);
    api.get(`/analytics/performance?studentId=${selectedStudent}`)
      .then(({ data }) => setPerfData(data.data))
      .catch(() => {}).finally(() => setLoading(false));
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
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
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
      </div>

      {loading ? (
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
      ) : (
        <div className="loading-center">Select a student to view performance</div>
      )}
    </>
  );
}
