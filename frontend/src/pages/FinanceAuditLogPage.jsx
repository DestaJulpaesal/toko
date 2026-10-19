import { useEffect, useMemo, useState } from 'react';
import { Activity, Filter, History, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';

const ENTITY_LABELS = {
  Product: 'Produk',
  ProductVariant: 'Stok / Varian',
  Order: 'Transaksi',
  Parcel: 'Parcel',
  FinanceTransaction: 'Keuangan',
  User: 'Akun pengguna',
  Customer: 'Pelanggan',
};

const FIELD_LABELS = {
  stockQty: 'Perubahan stok',
  price: 'Perubahan harga',
  status: 'Perubahan status',
  passwordReset: 'Reset kata sandi',
  password: 'Keamanan akun',
  emailVerification: 'Verifikasi email',
  sessions: 'Sesi login',
  invitation: 'Undangan anggota',
};

function formatAuditDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Waktu tidak tersedia'
    : new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
}

function getActionLabel(row) {
  if (row.entityType === 'User' && /password/i.test(row.field || '')) return 'Perubahan keamanan akun';
  if (row.field === 'UPDATE') return 'Pembaruan data';
  if (row.field === 'CREATE') return 'Data dibuat';
  if (row.field === 'DELETE') return 'Data dihapus';
  return FIELD_LABELS[row.field] || row.field || 'Perubahan data';
}

export default function FinanceAuditLogPage() {
  const [rows, setRows] = useState([]);
  const [entityType, setEntityType] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let active = true;
    const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';

    setLoading(true);
    setError('');
    apiFetch(`/audit-logs${query}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Riwayat perubahan gagal dimuat.');
        }
        if (active) setRows(Array.isArray(result.logs) ? result.logs : []);
      })
      .catch((loadError) => {
        if (!active) return;
        console.error('Audit history failed to load:', loadError);
        setError(loadError.message || 'Riwayat perubahan gagal dimuat.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [entityType, refreshCount]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    let cutoff = null;
    if (dateRange === 'today') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRange === '7' || dateRange === '30') {
      cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - Number(dateRange));
    }

    return rows.filter((row) => {
      const createdAt = new Date(row.createdAt);
      if (cutoff && (Number.isNaN(createdAt.getTime()) || createdAt < cutoff)) return false;
      if (!term) return true;
      return [
      ENTITY_LABELS[row.entityType] || row.entityType,
      getActionLabel(row),
      row.changedBy?.name,
      row.changedBy?.email,
      row.entityType === 'User' ? '' : row.entityId,
      ].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [rows, search, dateRange]);
  const hasFilters = Boolean(entityType || dateRange !== 'all' || search.trim());

  const clearFilters = () => {
    setEntityType('');
    setDateRange('all');
    setSearch('');
  };

  return (
    <AdminShell active="Audit Keuangan" className="admin-crud-shell" mainClassName="admin-audit-page">
      <header className="admin-audit-header">
        <div className="admin-audit-title">
          <span className="admin-audit-kicker"><History size={15} /> AUDIT TRAIL</span>
          <h1>Riwayat Perubahan Penting</h1>
          <p>Lihat aktivitas penting yang terjadi pada data toko dan akun.</p>
        </div>
        <div className="admin-audit-total">
          <Activity size={18} aria-hidden="true" />
          <span><strong>{loading ? '—' : visibleRows.length}</strong> dari {rows.length} catatan</span>
        </div>
      </header>

      <section className="admin-audit-panel" aria-label="Daftar riwayat perubahan">
        <div className="admin-audit-toolbar">
          <div className="admin-audit-filters">
            <label className="admin-audit-filter">
              <Filter size={16} aria-hidden="true" />
              <span>Bagian</span>
              <select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
                <option value="">Semua bagian</option>
                {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="admin-audit-filter">
              <History size={16} aria-hidden="true" />
              <span>Periode</span>
              <select value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
                <option value="all">Semua waktu</option>
                <option value="today">Hari ini</option>
                <option value="7">7 hari terakhir</option>
                <option value="30">30 hari terakhir</option>
              </select>
            </label>
          </div>
          <label className="admin-audit-search">
            <Search size={17} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari aktivitas atau pengguna..." aria-label="Cari riwayat" />
          </label>
          <div className="admin-audit-toolbar-actions">
            {hasFilters && (
              <button className="admin-audit-clear" type="button" onClick={clearFilters}>
                <X size={15} /> Reset
              </button>
            )}
            <button className="admin-audit-refresh" type="button" onClick={() => setRefreshCount((count) => count + 1)} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> Muat ulang
            </button>
          </div>
        </div>

        {error && <div className="admin-audit-state is-error" role="alert">{error}</div>}
        {loading && <div className="admin-audit-state" role="status">Memuat riwayat perubahan...</div>}

        {!loading && !error && visibleRows.length === 0 && (
          <div className="admin-audit-empty">
            <span><ShieldCheck size={22} aria-hidden="true" /></span>
            <strong>{search ? 'Aktivitas tidak ditemukan' : 'Belum ada riwayat perubahan'}</strong>
            <p>{search ? 'Coba kata kunci atau filter yang berbeda.' : 'Perubahan penting akan tercatat dan muncul di sini.'}</p>
          </div>
        )}

        {!loading && !error && visibleRows.length > 0 && (
          <div className="admin-audit-table-wrap">
            <table className="admin-audit-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Bagian</th>
                  <th>Aktivitas</th>
                  <th>ID data</th>
                  <th>Dilakukan oleh</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="admin-audit-time">{formatAuditDate(row.createdAt)}</td>
                    <td><span className={`admin-audit-entity entity-${String(row.entityType || '').toLowerCase()}`}>{ENTITY_LABELS[row.entityType] || row.entityType}</span></td>
                    <td>
                      <span className="admin-audit-action">{getActionLabel(row)}</span>
                      {row.entityType === 'User' && /password/i.test(row.field || '') && (
                        <small className="admin-audit-sensitive"><ShieldCheck size={13} /> Detail dirahasiakan</small>
                      )}
                    </td>
                    <td className="admin-audit-id">{row.entityType === 'User' ? 'Disamarkan' : row.entityId || '—'}</td>
                    <td>
                      <span className="admin-audit-actor">{row.changedBy?.name || row.changedBy?.email || 'Pengguna sistem'}</span>
                      {row.changedBy?.name && row.changedBy?.email && <small className="admin-audit-email">{row.changedBy.email}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && visibleRows.length > 0 && (
          <p className="admin-audit-footnote">
            {hasFilters ? `Menampilkan ${visibleRows.length} dari ${rows.length} catatan yang cocok.` : `Menampilkan ${rows.length} catatan terbaru (maksimal 200).`}
          </p>
        )}
      </section>
    </AdminShell>
  );
}
