import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';
import * as XLSX from 'xlsx';

const emptyForm = { type: 'EXPENSE', amount: '', description: '', category: '', paymentMethod: 'Tunai' };
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminFinancePage() {
  const [summary, setSummary] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const downloadExcel = () => { const rows = transactions.map((item) => ({ Tanggal: new Date(item.createdAt).toLocaleString('id-ID'), Jenis: item.type, Keterangan: item.description, Kategori: item.category || '', Nominal: item.amount, Metode: item.paymentMethod || '' })); const sheet = XLSX.utils.json_to_sheet(rows); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Keuangan'); XLSX.writeFile(book, `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.xlsx`); };

  const load = async () => {
    setLoading(true);
    try {
      const [summaryResponse, transactionResponse] = await Promise.all([apiFetch('/finance/summary'), apiFetch('/finance/transactions')]);
      const summaryData = await summaryResponse.json();
      const transactionData = await transactionResponse.json();
      if (summaryData.success) setSummary(summaryData.summary || {});
      if (transactionData.success) setTransactions(transactionData.transactions || []);
    } catch (error) { setNotice('Data keuangan gagal dimuat dari backend.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.amount || !form.description.trim()) { setNotice('Nominal dan keterangan wajib diisi.'); return; }
    if (!await confirmAction(`${editingId ? 'Perbarui' : 'Catat'} transaksi keuangan ini?`)) return;
    try {
      const response = await apiFetch(editingId ? `/finance/${editingId}` : '/finance', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Transaksi gagal disimpan.');
      setNotice(editingId ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil dicatat.'); reset(); await load();
    } catch (error) { setNotice(error.message || 'Transaksi gagal disimpan.'); }
  };

  const edit = (transaction) => { setEditingId(transaction.id); setForm({ type: transaction.type, amount: transaction.amount, description: transaction.description, category: transaction.category || '', paymentMethod: transaction.paymentMethod || 'Tunai' }); };
  const remove = async (transaction) => {
    if (!await confirmAction(`Hapus transaksi "${transaction.description}"?`)) return;
    try { const response = await apiFetch(`/finance/${transaction.id}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Transaksi gagal dihapus.'); setNotice('Transaksi berhasil dihapus.'); await load(); }
    catch (error) { setNotice(error.message || 'Transaksi gagal dihapus.'); }
  };
  const allSelected = transactions.length > 0 && transactions.every((transaction) => selectedIds.includes(transaction.id));
  const deleteSelected = async () => {
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} transaksi terpilih? Data keuangan akan dihapus permanen.`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/finance/${id}`, { method: 'DELETE' }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const count = results.filter((result) => result.status === 'fulfilled').length;
    setSelectedIds([]); setBulkDeleting(false); await load();
    setNotice(`${count} transaksi berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
  };

  return <div className="admin-shell admin-crud-shell"><AdminSidebar active="Keuangan" /><main className="admin-main">
    <header className="admin-header"><div><p className="eyebrow light">Finance management</p><h1>Keuangan & Laba</h1><p className="admin-subtitle">Catat pemasukan, pengeluaran, modal, dan pantau laba bersih toko.</p></div><div className="admin-header-actions"><button className="btn btn-secondary" onClick={downloadExcel}>Unduh Excel</button><span className="database-status ready"><i /> {loading ? 'Memuat data' : 'Terhubung ke API'}</span></div></header>
    {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <section className="metric-grid finance-metric-grid"><div className="metric-card green"><span>Pendapatan Hari Ini</span><strong>{money(summary.todaysIncome)}</strong></div><div className="metric-card orange"><span>Pengeluaran Hari Ini</span><strong>{money(summary.todaysExpense)}</strong></div><div className="metric-card blue"><span>Laba Hari Ini</span><strong>{money(summary.todaysGrossProfit)}</strong></div><div className="metric-card red"><span>Laba Bulan Ini</span><strong>{money(summary.monthGrossProfit)}</strong></div></section>
    <div className="finance-period-strip"><span>7 hari pendapatan: <b>{money(summary.weekIncome)}</b></span><span>Bulan pendapatan: <b>{money(summary.monthIncome)}</b></span><span>7 hari pengeluaran: <b>{money(summary.weekExpense)}</b></span><span>Bulan pengeluaran: <b>{money(summary.monthExpense)}</b></span><span>Total laba: <b>{money(summary.grossProfit)}</b></span><span>Total piutang: <b>{money(summary.totalDebt)}</b></span></div>
    <section className="crud-layout"><form className="crud-form-panel" onSubmit={submit}><div className="panel-heading"><div><span className="panel-kicker">{editingId ? 'Edit transaksi' : 'Catatan baru'}</span><h2>{editingId ? 'Perbarui keuangan' : 'Catat keuangan'}</h2></div>{editingId && <button type="button" className="text-button" onClick={reset}>Batal</button>}</div><label>Jenis<select name="type" value={form.type} onChange={update}><option value="INCOME">Pemasukan</option><option value="EXPENSE">Pengeluaran</option><option value="DEBT">Piutang</option></select></label><label>Nominal<CurrencyInput name="amount" value={form.amount} onValueChange={(value) => setForm((current) => ({ ...current, amount: value }))} placeholder="Rp 100.000" /></label><label>Keterangan<input name="description" value={form.description} onChange={update} placeholder="Contoh: beli stok dari grosir" /></label><label>Kategori<input name="category" value={form.category} onChange={update} placeholder="Pembelian, operasional, penjualan" /></label><label>Metode pembayaran<input name="paymentMethod" value={form.paymentMethod} onChange={update} placeholder="Tunai / Transfer" /></label><button className="btn btn-primary full">{editingId ? 'Simpan perubahan' : 'Catat transaksi'}</button></form>
    <section className="crud-table-panel"><div className="crud-toolbar"><strong>Riwayat keuangan</strong></div><BulkTableActions selectedCount={selectedIds.length} totalCount={transactions.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? transactions.map((transaction) => transaction.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} /><div className="product-table-wrap"><table className="product-table"><thead><tr><th className="bulk-check-column">Pilih</th><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th>Nominal</th><th>Aksi</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td className="bulk-check-column"><BulkRowCheckbox checked={selectedIds.includes(transaction.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, transaction.id])] : current.filter((id) => id !== transaction.id))} label="Pilih transaksi" /></td><td>{new Date(transaction.createdAt).toLocaleDateString('id-ID')}</td><td><span className={`status-chip ${transaction.type === 'INCOME' ? 'good' : 'warning'}`}>{transaction.type}</span></td><td><strong>{transaction.description}</strong><small>{transaction.category || transaction.paymentMethod || '-'}</small></td><td>{money(transaction.amount)}</td><td><div className="row-actions"><button onClick={() => edit(transaction)}>Edit</button><button onClick={() => remove(transaction)}>Hapus</button></div></td></tr>)}</tbody></table>{!loading && !transactions.length && <div className="table-empty">Belum ada transaksi keuangan.</div>}</div></section></section>
  </main></div>;
}
