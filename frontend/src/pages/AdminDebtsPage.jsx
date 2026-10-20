import { useEffect, useState } from 'react';
import AdminShell from '../layouts/AdminShell';
import CurrencyInput from '../components/CurrencyInput';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminDebtsPage() {
  const [debts, setDebts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [status, setStatus] = useState('OPEN');
  const [payment, setPayment] = useState(null);
  const [notice, setNotice] = useState('');
  const [payingId, setPayingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const query = new URLSearchParams({ status, page: String(page), pageSize: '25' });
      const loadDebts = async () => {
        const response = await apiFetch(`/debts?${query}`);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Data piutang gagal dimuat.');
        const nextDebts = data.data || data.debts || [];
        setDebts(nextDebts);
        setPagination(data.pagination || { page, pageSize: 25, total: nextDebts.length, totalPages: nextDebts.length ? 1 : 0 });
        if (!nextDebts.length && page > 1) setPage((current) => current - 1);
      };
      const loadAccounts = async () => {
        const response = await apiFetch('/finance/accounts');
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Akun penerimaan gagal dimuat.');
        setAccounts(data.data || data.accounts || []);
      };
      const results = await Promise.allSettled([loadDebts(), loadAccounts()]);
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length) {
        console.error('Some receivables data failed to load:', failures.map((result) => result.reason));
        setLoadError(`Sebagian data piutang gagal dimuat (${failures.length} bagian).`);
      }
    } catch (error) {
      setLoadError(error.message || 'Data piutang gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [status, page]);
  const pay = async (event) => {
    event.preventDefault();
    if (payingId) return;
    setPayingId(payment.id);
    try {
      const response = await apiFetch(`/debts/${payment.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(payment.amount), accountId: payment.accountId }) });
      const data = await response.json();
      if (!response.ok || !data.success) { setNotice(data.message || 'Pembayaran gagal.'); return; }
      setPayment(null); setNotice('Pembayaran piutang berhasil dicatat.'); await load();
    } finally {
      setPayingId(null);
    }
  };
  return <AdminShell active="Piutang" className="admin-crud-shell"><header className="admin-header"><div><p className="eyebrow light">Receivables</p><h1>Piutang Customer</h1><p className="admin-subtitle">Kelola cicilan dan penerimaan piutang dari database.</p></div></header>
    {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    {loadError && <div className="crud-notice" role="alert">{loadError}</div>}
    <div className="crud-toolbar"><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="OPEN">Terbuka</option><option value="OVERDUE">Jatuh tempo</option><option value="PAID">Lunas</option><option value="ALL">Semua</option></select></label></div>
    <section className="crud-table-panel"><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Customer</th><th>Jatuh tempo</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{debts.map((debt) => <tr key={debt.id}><td><strong>{debt.customerName || debt.customer?.name || '-'}</strong><small>{debt.description}</small></td><td>{debt.dueDate ? new Date(debt.dueDate).toLocaleDateString('id-ID') : '-'}</td><td>{money(debt.remainingAmount ?? debt.amount)}</td><td><span className={`status-chip ${debt.status === 'PAID' ? 'good' : debt.dueDate && new Date(debt.dueDate) < new Date() ? 'bad' : 'warning'}`}>{debt.status}</span></td><td>{debt.status !== 'PAID' && <button disabled={loading || !accounts.length} onClick={() => setPayment({ id: debt.id, amount: debt.remainingAmount ?? debt.amount, accountId: accounts[0]?.id || '' })}>Bayar</button>}</td></tr>)}</tbody></table>{loading ? <div className="table-empty">Memuat piutang...</div> : !debts.length && <div className="table-empty">Belum ada piutang.</div>}</div>
      {pagination.totalPages > 1 && <div className="g-pagination" aria-label="Halaman daftar piutang"><span>Menampilkan {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total.toLocaleString('id-ID')}</span><button type="button" className="g-btn" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={loading || page <= 1}>Sebelumnya</button><button type="button" className="g-btn" onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={loading || page >= pagination.totalPages}>Berikutnya</button></div>}
    </section>
    {payment && <div className="crud-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !payingId) setPayment(null); }}><form className="crud-form-panel" onSubmit={pay}><h2>Bayar piutang</h2><label>Nominal<CurrencyInput name="amount" value={payment.amount} onValueChange={(value) => setPayment((current) => ({ ...current, amount: value }))} /></label><label>Akun penerimaan<select value={payment.accountId} onChange={(event) => setPayment((current) => ({ ...current, accountId: event.target.value }))}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><button className="btn btn-primary" disabled={Boolean(payingId)}>{payingId ? 'Menyimpan...' : 'Simpan pembayaran'}</button><button type="button" className="btn btn-secondary" disabled={Boolean(payingId)} onClick={() => setPayment(null)}>Batal</button></form></div>}
  </AdminShell>;
}
