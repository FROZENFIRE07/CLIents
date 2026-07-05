import { useEffect, useState } from 'react';
import { Plus, Archive } from 'lucide-react';
import api from '../services/api';

interface Student {
  _id: string;
  rollNo: string;
  fullName: string;
  parentName: string;
  parentPhone: string;
  classId: any;
  status: string;
  admissionDate: string;
}

interface ClassDoc {
  _id: string;
  name: string;
  studentCount: number;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassDoc[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ rollNo: '', fullName: '', parentName: '', parentPhone: '', classId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/classes').then(({ data }) => {
      setClasses(data.data.classes);
      if (data.data.classes.length > 0) {
        setSelectedClass(data.data.classes[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedClass) fetchStudents();
  }, [selectedClass]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/students?classId=${selectedClass}`);
      setStudents(data.data.students);
    } catch {} finally { setLoading(false); }
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      await api.post('/students', { ...form, classId: form.classId || selectedClass });
      setShowModal(false);
      setForm({ rollNo: '', fullName: '', parentName: '', parentPhone: '', classId: '' });
      fetchStudents();
    } catch {} finally { setSaving(false); }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this student?')) return;
    try {
      await api.patch(`/students/${id}/archive`);
      fetchStudents();
    } catch {}
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Students</h2>
          <p>Manage students across all classes</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...form, classId: selectedClass }); setShowModal(true); }}>
          <Plus size={18} /> Add Student
        </button>
      </div>

      {/* Class Filter */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
        {classes.map((c) => (
          <button key={c._id}
            className={`btn ${selectedClass === c._id ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => setSelectedClass(c._id)}>
            {c.name} ({c.studentCount})
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Roll</th><th>Name</th><th>Parent</th><th>Phone</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No students in this class</td></tr>
              ) : students.map((s) => (
                <tr key={s._id}>
                  <td><strong>{s.rollNo}</strong></td>
                  <td>{s.fullName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.parentName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.parentPhone}</td>
                  <td><span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: 12 }}
                      onClick={() => handleArchive(s._id)}>
                      <Archive size={14} /> Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Student</h3>
            <div className="form-group"><label>Roll Number</label>
              <input value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} placeholder="e.g. 1" /></div>
            <div className="form-group"><label>Full Name</label>
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Student name" /></div>
            <div className="form-group"><label>Parent Name</label>
              <input value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} placeholder="Parent name" /></div>
            <div className="form-group"><label>Parent Phone (with country code)</label>
              <input value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} placeholder="e.g. 919876543210" /></div>
            <div className="form-group"><label>Class</label>
              <select value={form.classId || selectedClass} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select></div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !form.rollNo || !form.fullName}>
                {saving ? 'Saving...' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
