import { useEffect, useState } from 'react';
import api from '../services/api';

export default function ExamsPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Create exam modal state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', date: new Date().toISOString().split('T')[0], maxMarks: '100' });

  // Load classes
  useEffect(() => {
    api.get('/classes').then(({ data }) => {
      setClasses(data.data.classes);
      if (data.data.classes.length > 0) setSelectedClass(data.data.classes[0]._id);
    });
  }, []);

  // Load exams + students when class changes
  useEffect(() => {
    if (!selectedClass) return;
    setSelectedExam(null);
    setLoading(true);
    Promise.all([
      api.get(`/exams?classId=${selectedClass}`),
      api.get(`/students?classId=${selectedClass}`),
    ]).then(([examsRes, studentsRes]) => {
      setExams(examsRes.data.data.exams || []);
      setStudents(studentsRes.data.data.students || []);
    }).finally(() => setLoading(false));
  }, [selectedClass]);

  // Load marks + absent flags when exam changes
  useEffect(() => {
    if (!selectedExam) return;
    setLoading(true);
    Promise.all([
      api.get(`/exams/${selectedExam._id}/marks`),
      api.get(`/attendance/absent-on-date?classId=${selectedClass}&date=${selectedExam.date.split('T')[0]}`),
    ]).then(([marksRes, absentRes]) => {
      const m: Record<string, string> = {};
      (marksRes.data.data.marks || []).forEach((mk: any) => {
        m[mk.studentId?._id ?? mk.studentId] = String(mk.marksObtained);
      });
      setMarks(m);
      setAbsentIds(new Set<string>(absentRes.data.data.absentStudentIds || []));
      setSaved(false);
    }).finally(() => setLoading(false));
  }, [selectedExam]);

  const handleCreateExam = async () => {
    if (!form.name || !form.subject || !form.date || !form.maxMarks) return;
    try {
      const { data } = await api.post('/exams', {
        ...form,
        classId: selectedClass,
        maxMarks: parseInt(form.maxMarks),
      });
      const created = data.data.exam;
      setExams(prev => [created, ...prev]);
      setSelectedExam(created);
      setShowCreate(false);
      setForm({ name: '', subject: '', date: new Date().toISOString().split('T')[0], maxMarks: '100' });
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to create exam');
    }
  };

  const handleSave = async () => {
    if (!selectedExam) return;
    const payload = students
      .filter(s => marks[s._id] !== undefined && marks[s._id] !== '')
      .map(s => ({ studentId: s._id, marksObtained: parseFloat(marks[s._id]) }));
    if (payload.length === 0) return;
    setSaving(true);
    try {
      await api.post(`/exams/${selectedExam._id}/marks`, { marks: payload });
      setSaved(true);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to save marks');
    } finally { setSaving(false); }
  };

  const filledCount = students.filter(s => marks[s._id] !== undefined && marks[s._id] !== '').length;

  return (
    <>
      <div className="page-header">
        <h2>Exam Marks</h2>
        <p>Create exams and record student marks</p>
      </div>

      {/* ── Class filter ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {classes.map(c => (
          <button key={c._id}
            className={`btn ${selectedClass === c._id ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => setSelectedClass(c._id)}>
            {c.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* ── Exam sidebar ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Exams
            </span>
            <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={() => setShowCreate(true)}>
              + New
            </button>
          </div>

          {exams.length === 0 && !loading && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No exams yet.<br />Create one to get started.
            </div>
          )}

          {exams.map(exam => (
            <div key={exam._id}
              onClick={() => setSelectedExam(exam)}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                marginBottom: 6,
                cursor: 'pointer',
                backgroundColor: selectedExam?._id === exam._id ? 'var(--bg-elevated)' : 'var(--bg-card)',
                border: selectedExam?._id === exam._id ? '1px solid var(--border-strong, #555)' : '1px solid var(--border)',
                transition: 'all 0.15s',
              }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{exam.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{exam.subject} · Max {exam.maxMarks}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Marks entry panel ── */}
        <div>
          {!selectedExam ? (
            <div className="chart-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Select an exam to enter marks</span>
            </div>
          ) : (
            <div className="chart-card">
              {/* Exam header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{selectedExam.name}</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {selectedExam.subject} · Max {selectedExam.maxMarks} marks ·{' '}
                    {new Date(selectedExam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  {absentIds.size > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--danger, #FF453A)', marginTop: 4 }}>
                      ⚠ {absentIds.size} student{absentIds.size > 1 ? 's' : ''} were absent on this date
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {filledCount}/{students.length} filled
                  </span>
                  {saved && <span style={{ fontSize: 13, color: 'var(--success)' }}>✓ Saved</span>}
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 20px' }}
                    onClick={handleSave}
                    disabled={saving || filledCount === 0}
                  >
                    {saving ? 'Saving…' : 'Save Marks'}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
              ) : (
                <div className="table-container" style={{ border: 'none' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 50 }}>#</th>
                        <th>Student</th>
                        <th style={{ width: 140 }}>Attendance</th>
                        <th style={{ width: 150 }}>Marks / {selectedExam.maxMarks}</th>
                        <th style={{ width: 100 }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => {
                        const isAbsent = absentIds.has(s._id);
                        const val = marks[s._id] ?? '';
                        const pct = val !== '' && selectedExam.maxMarks
                          ? Math.round((parseFloat(val) / selectedExam.maxMarks) * 100)
                          : null;
                        return (
                          <tr key={s._id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.rollNo}</td>
                            <td>
                              <div style={{ fontWeight: 500 }}>{s.fullName}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.parentName}</div>
                            </td>
                            <td>
                              {isAbsent
                                ? <span className="badge badge-danger">Absent on exam day</span>
                                : <span className="badge badge-success">Present</span>
                              }
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                max={selectedExam.maxMarks}
                                value={val}
                                onChange={e => {
                                  setSaved(false);
                                  setMarks(prev => ({ ...prev, [s._id]: e.target.value }));
                                }}
                                placeholder="—"
                                style={{
                                  width: 90,
                                  padding: '6px 10px',
                                  backgroundColor: 'var(--bg-elevated)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 6,
                                  color: 'var(--text-primary)',
                                  fontSize: 14,
                                  fontWeight: 600,
                                  textAlign: 'center',
                                  outline: 'none',
                                }}
                              />
                            </td>
                            <td>
                              {pct !== null && (
                                <span className={`badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                                  {pct}%
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Create exam modal ── */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 28, width: 420, maxWidth: '90vw',
          }}>
            <h3 style={{ margin: '0 0 20px' }}>New Exam</h3>

            <div className="form-group">
              <label>Exam Name</label>
              <input type="text" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Unit Test 1, Mid-Term" />
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input type="text" value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Mathematics, Science…" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Maximum Marks</label>
                <input type="number" value={form.maxMarks} min={1}
                  onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={handleCreateExam}
                disabled={!form.name || !form.subject}
              >
                Create Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
