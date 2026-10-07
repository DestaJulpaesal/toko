import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Clock3, ExternalLink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';
import { markNotificationsRead } from '../utils/notificationReadStore';

const typeLabels = {
  STOCK_OUT: 'Stok habis',
  STOCK_LOW: 'Stok menipis',
  NEW_ORDER: 'Pesanan baru',
  OVERDUE_DEBT: 'Piutang terlambat',
  FINANCE_APPROVAL: 'Approval keuangan',
  FINANCE_REMINDER: 'Reminder keuangan',
};

const priorityByType = {
  STOCK_OUT: ['Kritis', 'critical'],
  OVERDUE_DEBT: ['Perlu tindakan', 'warning'],
  FINANCE_APPROVAL: ['Perlu tindakan', 'warning'],
  STOCK_LOW: ['Perhatian', 'warning'],
  NEW_ORDER: ['Informasi', 'info'],
  FINANCE_REMINDER: ['Terjadwal', 'info'],
};

function formatDateTime(value) {
  if (!value) return 'Waktu tidak tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia';
  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await apiFetch('/notifications/operational', { silentNotify: true });
      const result = await response.json();
      if (result.success) {
        const notifications = result.data || [];
        setItems(notifications);
        markNotificationsRead(notifications);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const dismiss = async (item) => {
    if (!item.reminderId) return;
    try {
      await apiFetch(`/finance/reminders/${item.reminderId}/dismiss`, { method: 'PATCH', silentNotify: true });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  return (
    <AdminShell className="admin-crud-shell">
      <header className="admin-header notifications-header">
        <div>
          <p className="eyebrow light">Notification center</p>
          <h1>Notifikasi</h1>
          <p className="admin-subtitle">Hanya peringatan yang perlu tindakan. Pendapatan kasir diringkas di laporan harian.</p>
        </div>
        <button type="button" className="btn secondary" onClick={() => navigate(-1)}>Kembali</button>
      </header>

      <section className="notifications-page">
        <div className="notifications-page-heading">
          <div>
            <span className="panel-kicker">Pusat notifikasi</span>
            <strong>{items.length} notifikasi aktif</strong>
          </div>
          <div className="notifications-page-actions">
            <span className="notifications-last-updated"><Clock3 size={13} />Live · diperbarui otomatis</span>
            <button type="button" className="notifications-refresh" onClick={load} disabled={loading}>Refresh</button>
          </div>
        </div>

        {loading ? <div className="table-empty">Memuat notifikasi...</div> : items.length === 0 ? (
          <div className="notifications-empty"><CheckCircle2 size={28} /><strong>Semua aman</strong><span>Belum ada peringatan yang perlu ditangani.</span><button type="button" className="btn secondary" onClick={() => navigate('/admin')}>Lihat ringkasan pendapatan</button></div>
        ) : (
          <div className="notifications-list">
            {items.map((item) => (
              <article className={`notification-card notification-${item.type?.toLowerCase() || 'info'}`} key={item.id}>
                <div className="notification-card-icon"><Bell size={18} /></div>
                <div className="notification-card-content">
                  <div className="notification-card-meta">
                    <span className="notification-card-type">{typeLabels[item.type] || 'Notifikasi operasional'}</span>
                    <span className={`notification-priority notification-priority-${priorityByType[item.type]?.[1] || 'info'}`}>
                      {priorityByType[item.type]?.[0] || 'Informasi'}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.detail || 'Tidak ada detail tambahan.'}</p>
                  <div className="notification-card-dates">
                    <time dateTime={item.createdAt}><Clock3 size={13} />Diterima: {formatDateTime(item.createdAt)}</time>
                    {item.dueDate && <time dateTime={item.dueDate}>Jatuh tempo: {formatDateTime(item.dueDate)}</time>}
                  </div>
                </div>
                <div className="notification-card-actions">
                  {item.href && <button type="button" className="btn secondary" onClick={() => navigate(item.href)}><ExternalLink size={14} />Buka</button>}
                  {item.reminderId && <button type="button" className="notification-dismiss" onClick={() => dismiss(item)} title="Tandai selesai" aria-label="Tandai notifikasi selesai"><X size={16} /></button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
