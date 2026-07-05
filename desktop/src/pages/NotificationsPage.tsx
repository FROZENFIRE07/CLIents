import { useEffect, useState } from 'react';
import api from '../services/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (filter) params.set('status', filter);

      const [notifRes, statsRes] = await Promise.all([
        api.get(`/notifications?${params}`),
        api.get('/notifications/stats'),
      ]);

      setNotifications(notifRes.data.data.notifications);
      setTotalPages(notifRes.data.data.pagination.pages);
      setStats(statsRes.data.data.stats);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, filter]);

  const statusColor: Record<string, string> = {
    queued: 'badge-warning', sending: 'badge-primary', sent: 'badge-success', failed: 'badge-danger',
  };

  return (
    <>
      <div className="page-header">
        <h2>Notifications</h2>
        <p>WhatsApp notification delivery logs</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Sent</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.sent}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Queued</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.queued}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.failed}</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        {['', 'sent', 'queued', 'failed'].map((f) => (
          <button key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => { setFilter(f); setPage(1); }}>
            {f || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Student</th><th>Phone</th><th>Message</th><th>Status</th><th>Sent At</th><th>Retries</th></tr>
              </thead>
              <tbody>
                {notifications.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No notifications</td></tr>
                ) : notifications.map((n) => (
                  <tr key={n._id}>
                    <td>{n.studentId?.fullName || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{n.parentPhone}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 13 }}>
                      {n.message}
                    </td>
                    <td><span className={`badge ${statusColor[n.status] || 'badge-primary'}`}>{n.status}</span></td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {n.sentAt ? new Date(n.sentAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ color: n.retryCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{n.retryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ padding: '6px 14px' }}
                disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontSize: 14 }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-outline" style={{ padding: '6px 14px' }}
                disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
