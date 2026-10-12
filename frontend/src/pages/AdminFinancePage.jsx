import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';
import * as XLSX from 'xlsx';
import CashflowChart from '../components/CashflowChart';
import CategoryBreakdownChart from '../components/CategoryBreakdownChart';
import AccountTransferModal from '../components/AccountTransferModal';
import ReconciliationModal from '../components/ReconciliationModal';
import BulkPasteModal from '../components/BulkPasteModal';

const emptyForm = { type: 'EXPENSE', amount: '', description: '', categoryId: '', accountId: '', paymentMethod: 'Tunai', tagIds: [], splits: [] };
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminFinancePage() {
  const [summary, setSummary] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [unifiedHistory, setUnifiedHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('SEMUA');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [tags, setTags] = useState([]);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const downloadExcel = () => { const rows = transactions.map((item) => ({ Tanggal: new Date(item.createdAt).toLocaleString('id-ID'), Jenis: item.type, Keterangan: item.description, Kategori: item.category || '', Nominal: item.amount, Metode: item.paymentMethod || '' })); const sheet = XLSX.utils.json_to_sheet(rows); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Keuangan'); XLSX.writeFile(book, `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.xlsx`); };

  const load = async () => {
    setLoading(true);
    try {
      const [summaryResponse, transactionResponse, unifiedResponse, categoryResponse, accountResponse, cashflowResponse, breakdownResponse, tagResponse] = await Promise.all([
        apiFetch('/finance/summary'), apiFetch('/finance/transactions'), apiFetch('/finance/unified-history'), apiFetch(`/finance/categories?type=${form.type}`), apiFetch('/finance/accounts'), apiFetch('/finance/cashflow?period=daily&months=1'), apiFetch('/finance/breakdown?type=EXPENSE'), apiFetch('/finance/tags'),
      ]);
      const summaryData = await summaryResponse.json();
      const transactionData = await transactionResponse.json();
      const unifiedData = await unifiedResponse.json();
      const categoryData = await categoryResponse.json();
      const accountData = await accountResponse.json();
      const cashflowData = await cashflowResponse.json();
      const breakdownData = await breakdownResponse.json();
      const tagData = await tagResponse.json();
      if (summaryData.success) setSummary(summaryData.summary || {});
      if (transactionData.success) setTransactions(transactionData.transactions || []);
      if (unifiedData.success) setUnifiedHistory(unifiedData.data || []);
      if (categoryData.success) setCategories(categoryData.data || categoryData.categories || []);
      if (accountData.success) setAccounts(accountData.data || accountData.accounts || []);
      if (cashflowData.success) setCashflow(cashflowData.data || []);
      if (breakdownData.success) setBreakdown(breakdownData.data || []);
      if (tagData.success) setTags(tagData.data || []);
    } catch (error) { setNotice('Data keuangan gagal dimuat dari backend.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [form.type]);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.amount || !form.description.trim()) { setNotice('Nominal dan keterangan wajib diisi.'); return; }
    if (!await confirmAction(`${editingId ? 'Perbarui' : 'Catat'} transaksi keuangan ini?`)) return;
    setSaving(true);
    try {
      const splitTotal = form.splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
      if (form.splits.length && Math.abs(splitTotal - Number(form.amount)) > 0.01) { setNotice('Total split transaksi harus sama dengan nominal.'); return; }
      const response = await apiFetch(editingId ? `/finance/${editingId}` : '/finance', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), category: null, splits: form.splits.length ? form.splits : undefined }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Transaksi gagal disimpan.');
      setNotice(editingId ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil dicatat.'); reset(); await load();
    } catch (error) { setNotice(error.message || 'Transaksi gagal disimpan.'); }
    finally { setSaving(false); }
  };

  const edit = (transaction) => { setEditingId(transaction.id); setForm({ type: transaction.type, amount: transaction.amount, description: transaction.description, categoryId: transaction.categoryId || '', accountId: transaction.accountId || '', paymentMethod: transaction.paymentMethod || 'Tunai', tagIds: (transaction.tags || []).map((tag) => tag.id), splits: transaction.splits || [] }); };
  const remove = async (transaction) => {
    if (deletingId) return;
    if (!await confirmAction(`Hapus transaksi "${transaction.description}"?`)) return;
    setDeletingId(transaction.id);
    try { const response = await apiFetch(`/finance/${transaction.id}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Transaksi gagal dihapus.'); setNotice('Transaksi berhasil dihapus.'); await load(); }
    catch (error) { setNotice(error.message || 'Transaksi gagal dihapus.'); }
    finally { setDeletingId(null); }
  };
  const allSelected = transactions.length > 0 && transactions.every((transaction) => selectedIds.includes(transaction.id));
  const deleteSelected = async () => {
    if (bulkDeleting) return;
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} transaksi terpilih? Data keuangan akan dihapus permanen.`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/finance/${id}`, { method: 'DELETE', silentNotify: true }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
      const count = results.filter((result) => result.status === 'fulfilled').length;
      setSelectedIds([]); await load();
      setNotice(`${count} transaksi berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
      showNotice(`${count} transaksi berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`, count < results.length ? 'error' : 'success');
    } finally { setBulkDeleting(false); }
  };

  return <div className="admin-shell admin-crud-shell"><AdminSidebar active="Keuangan" /><main className="admin-main">
    <header className="admin-header"><div><p className="eyebrow light">Finance management</p><h1>Keuangan & Laba</h1><p className="admin-subtitle">Catat pemasukan, pengeluaran, modal, dan pantau laba bersih toko.</p></div><div className="admin-header-actions"><button className="btn btn-secondary" onClick={() => setBulkPasteOpen(true)}>Paste transaksi</button><button className="btn btn-secondary" onClick={downloadExcel}>Unduh Excel</button><span className="database-status ready"><i /> {loading ? 'Memuat data' : 'Terhubung ke API'}</span></div></header>
    {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <section className="metric-grid finance-metric-grid"><div className="metric-card green"><span>Pendapatan Hari Ini</span><strong>{money(summary.todaysIncome)}</strong></div><div className="metric-card orange"><span>Pengeluaran Hari Ini</span><strong>{money(summary.todaysExpense)}</strong></div><div className="metric-card blue"><span>Laba Hari Ini</span><strong>{money(summary.todaysGrossProfit)}</strong></div><div className="metric-card red"><span>Laba Bulan Ini</span><strong>{money(summary.monthGrossProfit)}</strong></div></section>
    <section className="metric-grid">{accounts.map((account) => <div className="metric-card blue" key={account.id}><span>{account.name} · {account.type}</span><strong>{money(account.balance)}</strong></div>)}</section>
    <section className="finance-actions-panel"><div className="finance-actions-heading"><div><span className="panel-kicker">Operasional akun</span><h2>Transfer & rekonsiliasi akun</h2><p>Kelola perpindahan saldo dan pastikan uang fisik sesuai catatan sistem.</p></div><span className="finance-actions-mark">•••</span></div><div className="finance-actions-grid"><AccountTransferModal accounts={accounts} onDone={load} /><ReconciliationModal accounts={accounts} onDone={load} /></div></section>
    <div className="finance-period-strip"><span>7 hari pendapatan: <b>{money(summary.weekIncome)}</b></span><span>Bulan pendapatan: <b>{money(summary.monthIncome)}</b></span><span>7 hari pengeluaran: <b>{money(summary.weekExpense)}</b></span><span>Bulan pengeluaran: <b>{money(summary.monthExpense)}</b></span><span>Total laba: <b>{money(summary.grossProfit)}</b></span><span>Total piutang: <b>{money(summary.totalDebt)}</b></span></div>
    <section className="crud-layout"><form className="crud-form-panel" onSubmit={submit}><div className="panel-heading"><div><span className="panel-kicker">{editingId ? 'Edit transaksi' : 'Catatan baru'}</span><h2>{editingId ? 'Perbarui keuangan' : 'Catat keuangan'}</h2></div>{editingId && <button type="button" className="text-button" onClick={reset} disabled={saving}>Batal</button>}</div><label>Jenis<select name="type" value={form.type} onChange={(event) => { update(event); setForm((current) => ({ ...current, categoryId: '' })); }}><option value="INCOME">Pemasukan</option><option value="EXPENSE">Pengeluaran</option></select></label><label>Nominal<CurrencyInput name="amount" value={form.amount} onValueChange={(value) => setForm((current) => ({ ...current, amount: value }))} placeholder="Rp 100.000" /></label><label>Keterangan<input name="description" value={form.description} onChange={update} placeholder="Contoh: beli stok dari grosir" /></label><label>Kategori<select name="categoryId" value={form.categoryId} onChange={update}><option value="">Pilih kategori</option>{categories.filter((category) => category.type === form.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Akun / dompet<select name="accountId" value={form.accountId} onChange={update}><option value="">Pilih akun</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({money(account.balance)})</option>)}</select></label><label>Tag (Ctrl/Cmd untuk pilih beberapa)<select multiple value={form.tagIds} onChange={(event) => setForm((current) => ({ ...current, tagIds: [...event.target.selectedOptions].map((option) => option.value) }))}>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label><label>Metode pembayaran<input name="paymentMethod" value={form.paymentMethod} onChange={update} placeholder="Tunai / Transfer" /></label><button type="button" className="btn btn-secondary" onClick={() => setForm((current) => ({ ...current, splits: current.splits.length ? [] : [{ categoryId: current.categoryId, amount: current.amount, note: '' }] }))}>{form.splits.length ? 'Hapus split' : 'Split transaksi'}</button>{form.splits.map((split, index) => <div key={index} className="split-row"><select value={split.categoryId} onChange={(event) => setForm((current) => ({ ...current, splits: current.splits.map((row, rowIndex) => rowIndex === index ? { ...row, categoryId: event.target.value } : row) }))}>{categories.filter((category) => category.type === form.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><CurrencyInput value={split.amount} onValueChange={(value) => setForm((current) => ({ ...current, splits: current.splits.map((row, rowIndex) => rowIndex === index ? { ...row, amount: value } : row) }))} /></div>)}<button className="btn btn-primary full" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Catat transaksi'}</button></form>
    <section className="crud-table-panel"><div className="crud-toolbar"><strong>Riwayat semua aktivitas keuangan</strong><select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)}><option value="SEMUA">Semua sumber</option><option>KASIR / PENJUALAN</option><option>PENGELUARAN</option><option>PARCEL</option><option>TABUNGAN</option><option>NET WORTH</option><option>KEUANGAN LAINNYA</option></select></div><BulkTableActions selectedCount={selectedIds.length} totalCount={transactions.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? transactions.map((transaction) => transaction.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} /><div className="product-table-wrap"><table className="product-table"><thead><tr><th>Tanggal</th><th>Sumber</th><th>Jenis</th><th>Keterangan</th><th>Nominal</th><th>Aksi</th></tr></thead><tbody>{unifiedHistory.filter((item) => historyFilter === 'SEMUA' || item.source === historyFilter).map((item) => <tr key={item.id}><td>{new Date(item.date || item.createdAt).toLocaleDateString('id-ID')}</td><td><span className="status-chip good">{item.source}</span></td><td>{item.type}</td><td><strong>{item.description}</strong><small>{item.category || item.paymentMethod || '-'}</small></td><td>{money(item.amount)}</td><td>{item.source === 'KEUANGAN LAINNYA' || item.source === 'PENGELUARAN' || item.source === 'KASIR / PENJUALAN' ? <div className="row-actions"><button onClick={() => remove(item)}>Hapus</button></div> : '-'}</td></tr>)}</tbody></table>{!loading && !unifiedHistory.length && <div className="table-empty">Belum ada aktivitas keuangan.</div>}</div></section></section>
    <section className="crud-layout"><div className="crud-table-panel"><div className="crud-toolbar"><strong>Tren cashflow</strong></div><CashflowChart data={cashflow} /></div><div className="crud-table-panel"><div className="crud-toolbar"><strong>Breakdown pengeluaran</strong></div><CategoryBreakdownChart data={breakdown} /></div></section>
    <BulkPasteModal isOpen={bulkPasteOpen} onClose={() => setBulkPasteOpen(false)} categories={categories} accounts={accounts} onDone={load} />
  </main></div>;
}
