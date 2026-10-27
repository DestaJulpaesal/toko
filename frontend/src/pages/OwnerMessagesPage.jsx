import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, Clock3, Inbox, Mail, MessageCircle, RefreshCw, Search, Trash2, X } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';
import { confirmAction } from '../utils/confirmService';
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
  const [deletingId, setDeletingId] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

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
      return true;
    } catch (error) {
      setNotice(error.message || 'Pesan masuk gagal dimuat.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const visibleMessages = messages.filter((message) => {
    const matchesFilter = filter === 'all' || (filter === 'unread' ? message.status === 'NEW' : message.status !== 'NEW');
    const query = search.trim().toLocaleLowerCase('id-ID');
    const matchesSearch = !query || `${message.name} ${message.phone} ${message.message}`.toLocaleLowerCase('id-ID').includes(query);
    return matchesFilter && matchesSearch;
  });
  const unreadVisibleCount = messages.filter((message) => message.status === 'NEW').length;
  const readVisibleCount = messages.length - unreadVisibleCount;

  const markRead = async (message) => {
    if (deletingAll || deletingId || updatingId) return;
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

  const deleteMessage = async (message) => {
    if (deletingId || deletingAll || updatingId) return;
    if (!await confirmAction(`Hapus pesan dari ${message.name}? Pesan ini tidak bisa dipulihkan.`)) return;
    setDeletingId(message.id);
    setNotice('');
    try {
      const response = await apiFetch(`/site-content/messages/${message.id}`, {
        method: 'DELETE',
        silentNotify: true,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pesan gagal dihapus.');
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setTotalCount((current) => Math.max(0, current - 1));
      if (message.status === 'NEW') setUnreadCount((current) => Math.max(0, current - 1));
      const loaded = await loadMessages();
      setNotice(loaded ? 'Pesan berhasil dihapus.' : 'Pesan berhasil dihapus, tetapi daftar belum dapat dimuat ulang.');
    } catch (error) {
      setNotice(error.message || 'Pesan gagal dihapus.');
    } finally {
      setDeletingId('');
    }
  };

  const deleteAllMessages = async () => {
    if (!totalCount || deletingId || deletingAll || updatingId) return;
    if (!await confirmAction(`Hapus semua ${totalCount} pesan yang tersimpan? Tindakan ini tidak bisa dibatalkan.`, 'Hapus semua pesan')) return;
    setDeletingAll(true);
    setNotice('');
    try {
      const response = await apiFetch('/site-content/messages', {
        method: 'DELETE',
        silentNotify: true,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Semua pesan gagal dihapus.');
      setMessages([]);
      setUnreadCount(0);
      setTotalCount(0);
      setNotice(`${Number(data.deletedCount || 0)} pesan berhasil dihapus.`);
    } catch (error) {
      setNotice(error.message || 'Semua pesan gagal dihapus.');
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <AdminShell active="Pesan Masuk" mainClassName="owner-messages-page">
      <header className="admin-header account-page-header owner-messages-header">
        <div className="owner-messages-title">
          <p className="eyebrow light">PESAN DARI PELANGGAN</p>
          <h1>Pesan Masuk</h1>
          <p className="admin-subtitle">Pesan yang dikirim pelanggan dari formulir kontak website Glosir.</p>
        </div>
        <div className="owner-message-header-actions">
          <button type="button" className="btn btn-danger" onClick={deleteAllMessages} disabled={loading || !totalCount || Boolean(deletingId) || Boolean(updatingId) || deletingAll}>
            <Trash2 size={15} /> {deletingAll ? 'Menghapus semua...' : 'Hapus semua'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={loadMessages} disabled={loading || Boolean(deletingId) || Boolean(updatingId) || deletingAll}>
            <RefreshCw size={15} /> {loading ? 'Memuat...' : 'Muat ulang'}
          </button>
        </div>
      </header>

      {notice && <div className="crud-notice" role="alert">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button></div>}

      <section className="account-summary-grid owner-message-summary" aria-label="Ringkasan pesan">
        <div className="dashboard-stat-card owner-message-stat"><span className="account-stat-icon"><Mail size={16} /></span><span>Total pesan</span><strong>{totalCount}</strong><small>Pesan yang tersimpan</small></div>
        <div className="dashboard-stat-card owner-message-stat is-unread"><span className="account-stat-icon is-blue"><MessageCircle size={16} /></span><span>Belum dibaca</span><strong>{unreadCount}</strong><small>{unreadCount ? 'Perlu ditinjau' : 'Semua pesan sudah ditinjau'}</small></div>
        <div className="dashboard-stat-card owner-message-stat is-displayed"><span className="account-stat-icon is-green"><Inbox size={16} /></span><span>Pesan terbaru</span><strong>{messages.length}</strong><small>Dari maksimal 100 pesan terbaru</small></div>
      </section>

      <section className="owner-inbox-section" aria-label="Kotak masuk pelanggan">
        <div className="owner-inbox-section-heading">
          <div>
            <span className="panel-kicker">KOTAK MASUK</span>
            <h2>Pesan pelanggan</h2>
            <p>{totalCount > messages.length ? `Menampilkan ${messages.length} pesan terbaru dari ${totalCount}.` : `${totalCount} pesan tersimpan untuk ditinjau.`}</p>
          </div>
          <span className="owner-inbox-section-count"><Mail size={14} /> {unreadCount} belum dibaca</span>
        </div>
        <div className="owner-inbox-toolbar">
          <div className="owner-inbox-filters" role="group" aria-label="Filter pesan">
            <button type="button" className={filter === 'all' ? 'is-active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              Semua <span>{messages.length}</span>
            </button>
            <button type="button" className={filter === 'unread' ? 'is-active' : ''} aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
              Belum dibaca <span>{unreadVisibleCount}</span>
            </button>
            <button type="button" className={filter === 'read' ? 'is-active' : ''} aria-pressed={filter === 'read'} onClick={() => setFilter('read')}>
              <CheckCheck size={14} /> Sudah dibaca <span>{readVisibleCount}</span>
            </button>
          </div>
          <label className="owner-inbox-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, nomor, atau isi pesan" aria-label="Cari pesan" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian"><X size={15} /></button>}
          </label>
        </div>
        <div className="owner-inbox-table-panel" role="region" aria-label="Daftar pesan pelanggan" aria-busy={loading}>
        <div className="owner-inbox-table-scroll">
          <table className="owner-inbox-table">
            <caption>Pesan pelanggan, pesan terbaru ditampilkan lebih dahulu.</caption>
            <thead>
              <tr>
                <th scope="col">Pengirim</th>
                <th scope="col">Isi pesan</th>
                <th scope="col">Status</th>
                <th scope="col">Waktu diterima</th>
                <th scope="col">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {loading && !messages.length
                ? <tr><td className="owner-inbox-table-empty" colSpan="5">Memuat pesan pelanggan...</td></tr>
                : !messages.length
                  ? <tr><td className="owner-inbox-table-empty" colSpan="5"><span className="owner-inbox-empty-icon"><Mail size={23} /></span><strong>Belum ada pesan masuk</strong><span>Pesan dari formulir kontak akan muncul di sini.</span></td></tr>
                  : !visibleMessages.length
                    ? <tr><td className="owner-inbox-table-empty" colSpan="5"><span className="owner-inbox-empty-icon"><Search size={22} /></span><strong>Tidak ada pesan yang cocok</strong><span>Coba ubah kata pencarian atau filter yang dipilih.</span><button type="button" className="owner-inbox-clear-filter" onClick={() => { setSearch(''); setFilter('all'); }}>Hapus pencarian dan filter</button></td></tr>
                    : visibleMessages.map((message) => {
                      const phone = normalizeIndonesianPhone(message.phone);
                      const whatsappHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(`Halo ${message.name}, kami dari Glosir menanggapi pesan Anda.`)}` : '';
                      const isUnread = message.status === 'NEW';
                      return (
                        <tr className={isUnread ? 'is-unread' : ''} key={message.id}>
                          <td>
                            <div className="owner-inbox-table-sender">
                              <span className="owner-inbox-avatar">{(message.name || '?').slice(0, 1).toUpperCase()}</span>
                              <span><strong>{message.name}</strong>{phone ? <a href={`tel:${phone}`}>{message.phone}</a> : <small>Nomor tidak dicantumkan</small>}</span>
                            </div>
                          </td>
                          <td><p className="owner-inbox-table-message">{message.message}</p></td>
                          <td><span className={`owner-inbox-table-status ${isUnread ? 'is-unread' : 'is-read'}`}>{isUnread ? 'Belum dibaca' : 'Sudah dibaca'}</span></td>
                          <td><time className="owner-inbox-table-date" dateTime={message.createdAt}><Clock3 size={14} />{formatDateTime(message.createdAt)}</time></td>
                          <td>
                            <div className="owner-inbox-table-actions">
                              {whatsappHref && <a className="owner-inbox-table-reply" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Balas</a>}
                              {isUnread && <button type="button" className="owner-inbox-table-read" onClick={() => markRead(message)} disabled={Boolean(updatingId) || Boolean(deletingId) || deletingAll}>{updatingId === message.id ? 'Menyimpan...' : 'Tandai sudah dibaca'}</button>}
                              <button type="button" className="owner-inbox-table-delete" onClick={() => deleteMessage(message)} disabled={Boolean(deletingId) || deletingAll || Boolean(updatingId)} aria-label={`Hapus pesan dari ${message.name}`}><Trash2 size={15} /> {deletingId === message.id ? 'Menghapus...' : 'Hapus'}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </div>
        {messages.length > 0 && <div className="owner-inbox-table-footer"><span>Menampilkan {visibleMessages.length} dari {messages.length} pesan terbaru</span><span className="owner-inbox-table-hint">Geser tabel ke samping untuk melihat semua kolom.</span></div>}
        </div>
      </section>
    </AdminShell>
  );
}
