import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/finance/approvals?status=PENDING');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Approval gagal dimuat');
      setRows(result.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch((error) => setNotice(error.message)); }, []);

  const decide = async (id, action) => {
    const reason = action === 'reject' ? window.prompt('Alasan penolakan wajib diisi') : '';
    if (action === 'reject' && !reason) return;
    const response = await apiFetch(`/finance/approvals/${id}/${action}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'Approval gagal diproses');
    setNotice(action === 'approve' ? 'Pengeluaran berhasil disetujui.' : 'Pengeluaran ditolak.');
    await load();
  };

  return (
    <div className="admin-shell admin-crud-shell finance-workspace">
      <AdminSidebar active="Approval Keuangan" />
      <main className="admin-main">
        <header className="finance-page-hero">
          <div>
            <span className="finance-kicker">Kontrol keuangan</span>
            <h1>Approval Pengeluaran</h1>
            <p>Periksa dan putuskan pengeluaran yang menunggu persetujuan.</p>
          </div>
          <div className="finance-hero-mark">✓</div>
        </header>
        {notice && <p className="notice-banner finance-notice">{notice}</p>}
        <section className="finance-summary-strip">
          <div><span>Menunggu keputusan</span><strong>{rows.length}</strong><small>pengajuan aktif</small></div>
          <div><span>Total nominal</span><strong>{money(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0))}</strong><small>yang perlu ditinjau</small></div>
          <div><span>Alur kontrol</span><strong>Owner</strong><small>persetujuan akhir</small></div>
        </section>
        <section className="finance-panel">
          <div className="finance-panel-heading">
            <div><span className="finance-kicker">Inbox keputusan</span><h2>Pengajuan menunggu approval</h2></div>
            <button type="button" className="btn btn-secondary small" onClick={() => load().catch((error) => setNotice(error.message))}>Refresh</button>
          </div>
          {loading ? <div className="finance-empty"><span className="finance-empty-icon">…</span><strong>Memuat pengajuan</strong><p>Sebentar, kami mengambil data approval terbaru.</p></div>
            : !rows.length ? <div className="finance-empty"><span className="finance-empty-icon">✓</span><strong>Semua sudah beres</strong><p>Tidak ada pengeluaran yang menunggu persetujuan.</p></div>
              : <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Pengajuan</th><th>Pengaju</th><th>Nominal</th><th>Waktu</th><th>Aksi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.description}</strong><small>{row.reason || 'Pengeluaran operasional'}</small></td><td>{row.requestedBy?.name || '—'}</td><td><strong className="finance-amount">{money(row.amount)}</strong></td><td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('id-ID') : '—'}</td><td><div className="finance-action-group"><button type="button" className="btn btn-primary small" onClick={() => decide(row.id, 'approve').catch((error) => setNotice(error.message))}>Setujui</button><button type="button" className="btn btn-danger small" onClick={() => decide(row.id, 'reject').catch((error) => setNotice(error.message))}>Tolak</button></div></td></tr>)}</tbody></table></div>}
        </section>
      </main>
    </div>
  );
}
