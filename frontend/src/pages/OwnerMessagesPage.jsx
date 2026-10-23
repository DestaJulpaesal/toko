import { useCallback, useEffect, useState } from 'react';
import { Clock3, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';
import { normalizeIndonesianPhone } from '../utils/phoneUtils';

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia';
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function OwnerMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const [notice, setNotice] = useState('');

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/site-content/messages', { silentNotify: true });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pesan masuk gagal dimuat.');
      setMessages(data.messages || []);
      setUnreadCount(Number(data.unreadCount || 0));
      setTotalCount(Number(data.totalCount || 0));
      setNotice('');
    } catch (error) {
      setNotice(error.message || 'Pesan masuk gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const markRead = async (message) => {
    setUpdatingId(message.id);
    setNotice('');
    try {
      const response = await apiFetch(`/site-content/messages/${message.id}/read`, {
        method: 'PATCH',
        silentNotify: true,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Status pesan gagal diperbarui.');
      setMessages((current) => current.map((item) => (
        item.id === message.id ? { ...item, status: 'READ' } : item
      )));
      setUnreadCount((current) => Math.max(0, current - Number(message.status === 'NEW')));
    } catch (error) {
      setNotice(error.message || 'Status pesan gagal diperbarui.');
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <AdminShell active="Pesan Masuk" mainClassName="owner-messages-page">
      <header className="admin-header account-page-header">
        <div>
          <p className="eyebrow light">PESAN DARI PELANGGAN</p>
          <h1>Pesan Masuk</h1>
          <p className="admin-subtitle">Pesan yang dikirim pelanggan dari formulir kontak website Glosir.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadMessages} disabled={loading}>
          <RefreshCw size={15} /> {loading ? 'Memuat...' : 'Muat ulang'}
        </button>
      </header>

      {notice && <div className="crud-notice" role="alert">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button></div>}

      <section className="account-summary-grid" aria-label="Ringkasan pesan">
        <div className="dashboard-stat-card"><span className="account-stat-icon"><Mail size={16} /></span><span>Total pesan</span><strong>{totalCount}</strong><small>Pesan yang tersimpan</small></div>
        <div className="dashboard-stat-card"><span className="account-stat-icon is-blue"><MessageCircle size={16} /></span><span>Belum dibaca</span><strong>{unreadCount}</strong><small>Perlu ditinjau Owner</small></div>
        <div className="dashboard-stat-card"><span className="account-stat-icon is-green"><Clock3 size={16} /></span><span>Ditampilkan</span><strong>{messages.length}</strong><small>Maksimal 100 pesan terbaru</small></div>
      </section>

      <section className="owner-inbox-list" aria-label="Daftar pesan pelanggan" aria-busy={loading}>
        {loading && !messages.length ? <div className="owner-inbox-empty" role="status">Memuat pesan pelanggan...</div>
          : !messages.length ? <div className="owner-inbox-empty"><Mail size={25} /><strong>Belum ada pesan masuk</strong><span>Pesan yang dikirim melalui formulir kontak akan muncul di sini.</span></div>
            : messages.map((message) => {
              const phone = normalizeIndonesianPhone(message.phone);
              const whatsappHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(`Halo ${message.name}, kami dari Glosir menanggapi pesan Anda.`)}` : '';
              return (
                <article className={`owner-inbox-card${message.status === 'NEW' ? ' is-unread' : ''}`} key={message.id}>
                  <div className="owner-inbox-card-top">
                    <div className="owner-inbox-sender">
                      <span className="owner-inbox-avatar">{(message.name || '?').slice(0, 1).toUpperCase()}</span>
                      <div><h2>{message.name}</h2><a href={phone ? `tel:${phone}` : undefined}>{message.phone}</a></div>
                    </div>
                    <div className="owner-inbox-meta">
                      {message.status === 'NEW' && <span className="owner-inbox-unread-badge">Belum dibaca</span>}
                      <time dateTime={message.createdAt}><Clock3 size={13} />{formatDateTime(message.createdAt)}</time>
                    </div>
                  </div>
                  <p className="owner-inbox-message">{message.message}</p>
                  <div className="owner-inbox-actions">
                    {whatsappHref && <a className="btn btn-secondary" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Balas via WhatsApp</a>}
                    {message.status === 'NEW' && <button type="button" className="btn btn-primary" onClick={() => markRead(message)} disabled={updatingId === message.id}>{updatingId === message.id ? 'Menyimpan...' : 'Tandai sudah dibaca'}</button>}
                  </div>
                </article>
              );
            })}
      </section>
    </AdminShell>
  );
}
