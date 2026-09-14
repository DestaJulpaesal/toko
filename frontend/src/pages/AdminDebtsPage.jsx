import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminDebtsPage() {
  const [debts, setDebts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [status, setStatus] = useState('OPEN');
  const [payment, setPayment] = useState(null);
  const [notice, setNotice] = useState('');
  const load = async () => {
    const [debtResponse, accountResponse] = await Promise.all([apiFetch(`/debts?status=${status}`), apiFetch('/finance/accounts')]);
    const debtData = await debtResponse.json(); const accountData = await accountResponse.json();
    if (debtData.success) setDebts(debtData.data || debtData.debts || []);
    if (accountData.success) setAccounts(accountData.data || accountData.accounts || []);
  };
  useEffect(() => { load(); }, [status]);
  const pay = async (event) => {
    event.preventDefault();
    const response = await apiFetch(`/debts/${payment.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(payment.amount), accountId: payment.accountId }) });
    const data = await response.json();
    if (!response.ok || !data.success) { setNotice(data.message || 'Pembayaran gagal.'); return; }
    setPayment(null); setNotice('Pembayaran piutang berhasil dicatat.'); await load();
  };
  return <div className="admin-shell admin-crud-shell"><AdminSidebar active="Piutang" /><main className="admin-main"><header className="admin-header"><div><p className="eyebrow light">Receivables</p><h1>Piutang Customer</h1><p className="admin-subtitle">Kelola cicilan dan penerimaan piutang dari database.</p></div></header>
    {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <div className="crud-toolbar"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="OPEN">Terbuka</option><option value="OVERDUE">Jatuh tempo</option><option value="PAID">Lunas</option><option value="ALL">Semua</option></select></label></div>
    <section className="crud-table-panel"><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Customer</th><th>Jatuh tempo</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{debts.map((debt) => <tr key={debt.id}><td><strong>{debt.customerName || debt.customer?.name || '-'}</strong><small>{debt.description}</small></td><td>{debt.dueDate ? new Date(debt.dueDate).toLocaleDateString('id-ID') : '-'}</td><td>{money(debt.remainingAmount ?? debt.amount)}</td><td><span className={`status-chip ${debt.status === 'PAID' ? 'good' : debt.dueDate && new Date(debt.dueDate) < new Date() ? 'bad' : 'warning'}`}>{debt.status}</span></td><td>{debt.status !== 'PAID' && <button onClick={() => setPayment({ id: debt.id, amount: debt.remainingAmount ?? debt.amount, accountId: accounts[0]?.id || '' })}>Bayar</button>}</td></tr>)}</tbody></table>{!debts.length && <div className="table-empty">Belum ada piutang.</div>}</div></section>
    {payment && <div className="modal-backdrop" role="presentation"><form className="crud-form-panel" onSubmit={pay}><h2>Bayar piutang</h2><label>Nominal<CurrencyInput name="amount" value={payment.amount} onValueChange={(value) => setPayment((current) => ({ ...current, amount: value }))} /></label><label>Akun penerimaan<select value={payment.accountId} onChange={(event) => setPayment((current) => ({ ...current, accountId: event.target.value }))}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><button className="btn btn-primary">Simpan pembayaran</button><button type="button" className="btn btn-secondary" onClick={() => setPayment(null)}>Batal</button></form></div>}
  </main></div>;
}
