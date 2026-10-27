import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';
import * as XLSX from 'xlsx';
import CashflowChart from '../components/CashflowChart';
import CategoryBreakdownChart from '../components/CategoryBreakdownChart';
import ModalForm from '../components/ModalForm';
import ReconciliationModal from '../components/ReconciliationModal';
import BulkPasteModal from '../components/BulkPasteModal';

const emptyForm = { type: 'EXPENSE', amount: '', description: '', categoryId: '', accountId: '', paymentMethod: 'Tunai', tagIds: [], splits: [] };
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const sourceLabels = {
  'KASIR / PENJUALAN': 'Penjualan kasir',
  PENGELUARAN: 'Pengeluaran',
  PARCEL: 'Setoran parsel',
  TABUNGAN: 'Tabungan',
  'NET WORTH': 'Perubahan aset',
  'KEUANGAN LAINNYA': 'Catatan manual',
};
const getFinanceError = (error, fallback) => {
  if (error instanceof TypeError) return 'Koneksi ke server bermasalah. Periksa internet lalu coba lagi.';
  if (error instanceof SyntaxError) return 'Respons server tidak dapat dibaca. Coba muat ulang halaman.';
  return error.message || fallback;
};
const formatCashDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Tanggal tidak tersedia' : date.toLocaleDateString('id-ID');
};

export default function AdminFinancePage() {
  const [summary, setSummary] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [unifiedHistory, setUnifiedHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('SEMUA');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [entryFieldErrors, setEntryFieldErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const cashAccounts = accounts.filter((account) => account.type === 'CASH');
  const cashAccount = cashAccounts.find((account) => account.id === 'finance-default-cash') || cashAccounts[0] || null;
  const visibleHistory = unifiedHistory.filter((item) => historyFilter === 'SEMUA' || item.source === historyFilter);
  const downloadExcel = () => { const rows = transactions.map((item) => ({ Tanggal: new Date(item.createdAt).toLocaleString('id-ID'), Jenis: item.type, Keterangan: item.description, Kategori: item.category || '', Nominal: item.amount, Metode: item.paymentMethod || '' })); const sheet = XLSX.utils.json_to_sheet(rows); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Keuangan'); XLSX.writeFile(book, `laporan-keuangan-${new Date().toISOString().slice(0, 10)}.xlsx`); };

  const load = async () => {
    setLoading(true);
    const loadResource = async (path, label, update) => {
      const response = await apiFetch(path);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || `${label} gagal dimuat.`);
      update(data);
    };

    try {
      const results = await Promise.allSettled([
        loadResource('/finance/summary', 'Ringkasan keuangan', (data) => setSummary(data.summary || {})),
        loadResource('/finance/transactions', 'Transaksi', (data) => setTransactions(data.transactions || [])),
        loadResource('/finance/unified-history', 'Riwayat keuangan', (data) => setUnifiedHistory(data.data || [])),
        loadResource('/finance/accounts', 'Akun keuangan', (data) => setAccounts(data.data || data.accounts || [])),
        loadResource('/finance/cashflow?period=daily&months=1', 'Arus kas', (data) => setCashflow(data.data || [])),
        loadResource('/finance/breakdown?type=EXPENSE', 'Rincian pengeluaran', (data) => setBreakdown(data.data || [])),
      ]);
      const failures = results.filter((result) => result.status === 'rejected');
      setLoadFailed(failures.length > 0);
      if (failures.length) {
        console.error('Some finance data failed to load:', failures.map((result) => result.reason));
        setNotice(`Sebagian data keuangan gagal dimuat (${failures.length} bagian).`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      try {
        const response = await apiFetch(`/finance/categories?type=${form.type}`);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Kategori keuangan gagal dimuat.');
        if (active) setCategories(data.data || data.categories || []);
      } catch (error) {
        console.error('Finance categories failed to load:', error);
        if (active) setNotice(getFinanceError(error, 'Kategori keuangan gagal dimuat.'));
      }
    };
    loadCategories();
    return () => { active = false; };
  }, [form.type]);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const reset = () => { setForm(emptyForm); setEditingId(null); setEntryFieldErrors({}); };
  const updateEntryField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setEntryFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const errors = {};
    if (!form.amount || Number(form.amount) <= 0) errors.amount = 'Masukkan nominal lebih dari Rp 0.';
    if (!form.description.trim()) errors.description = 'Keterangan wajib diisi.';
    setEntryFieldErrors(errors);
    if (Object.keys(errors).length) {
      setNotice('');
      document.getElementById(`cash-entry-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    if (!await confirmAction(`${editingId ? 'Perbarui' : 'Catat'} transaksi keuangan ini?`)) return;
    setSaving(true);
    try {
      const splitTotal = form.splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
      if (form.splits.length && Math.abs(splitTotal - Number(form.amount)) > 0.01) { setNotice('Total split transaksi harus sama dengan nominal.'); return; }
      const response = await apiFetch(editingId ? `/finance/${editingId}` : '/finance', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount), category: null, splits: form.splits.length ? form.splits : undefined }) });
      const data = await response.json();
      if (!response.ok || !data.success) {
        const serverErrors = {};
        data.errors?.forEach(({ field }) => {
          if (field === 'amount') serverErrors.amount = 'Masukkan nominal lebih dari Rp 0.';
          if (field === 'description') serverErrors.description = 'Keterangan wajib diisi.';
        });
        if (Object.keys(serverErrors).length) {
          setEntryFieldErrors(serverErrors);
          document.getElementById(`cash-entry-${Object.keys(serverErrors)[0]}`)?.focus();
          return;
        }
        throw new Error(data.message || 'Transaksi belum berhasil disimpan. Coba lagi.');
      }
      setNotice(editingId ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil dicatat.');
      reset();
      setEntryOpen(false);
      await load();
    } catch (error) { setNotice(getFinanceError(error, 'Transaksi belum berhasil disimpan. Coba lagi.')); }
    finally { setSaving(false); }
  };

  const edit = (transaction) => { setEditingId(transaction.id); setForm({ type: transaction.type, amount: transaction.amount, description: transaction.description, categoryId: transaction.categoryId || '', accountId: transaction.accountId || '', paymentMethod: transaction.paymentMethod || 'Tunai', tagIds: (transaction.tags || []).map((tag) => tag.id), splits: transaction.splits || [] }); };
  const remove = async (transaction) => {
    if (deletingId) return;
    if (!await confirmAction(`Hapus transaksi "${transaction.description}"?`)) return;
    setDeletingId(transaction.id);
    try { const response = await apiFetch(`/finance/${transaction.id}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Transaksi gagal dihapus.'); setNotice('Transaksi berhasil dihapus.'); await load(); }
    catch (error) { setNotice(getFinanceError(error, 'Transaksi belum berhasil dihapus. Coba lagi.')); }
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

  return <AdminShell active="Keuangan" className="admin-crud-shell">
    <header className="admin-header cash-page-header"><div><p className="eyebrow light">Catatan uang tunai</p><h1>Buku Kas Toko</h1><p className="admin-subtitle">Pantau uang tunai toko dan catat transaksi harian dengan mudah.</p></div><div className="admin-header-actions finance-header-actions"><details className="finance-more-actions"><summary>Opsi lainnya</summary><div><button type="button" onClick={() => setBulkPasteOpen(true)}>Tempel transaksi sekaligus</button><button type="button" onClick={downloadExcel}>Unduh laporan</button></div></details><span className={`database-status ${loading ? 'loading' : loadFailed ? 'error' : 'ready'}`} aria-live="polite"><i /> {loading ? 'Memuat data...' : loadFailed ? 'Sebagian data bermasalah' : 'Data tersambung'}</span></div></header>
    {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <section className="cash-finance-overview cash-finance-overview-compact" aria-label="Ringkasan buku kas">
      <article className="cash-balance-card"><span className="cash-balance-icon">Rp</span><div><small>Perkiraan uang di kas</small><strong>{cashAccount ? money(cashAccount.balance) : 'Akun kas belum tersedia'}</strong><span>Berdasarkan catatan masuk dan keluar · {cashAccount?.name || 'Kas Toko'}</span></div></article>
      <div className="cash-today-summary"><article className="cash-today-card is-income"><span><ArrowDownLeft size={15} aria-hidden="true" /> Uang masuk hari ini</span><strong>{money(summary.todaysIncome)}</strong><small>Pemasukan yang tercatat</small></article><article className="cash-today-card is-expense"><span><ArrowUpRight size={15} aria-hidden="true" /> Uang keluar hari ini</span><strong>{money(summary.todaysExpense)}</strong><small>Pengeluaran yang tercatat</small></article></div>
    </section>
    <div className="cash-how-to" aria-label="Cara menggunakan buku kas"><strong>Alur mudah</strong><span><i>1</i> Catat setiap uang masuk atau keluar</span><b>→</b><span><i>2</i> Saat tutup hari, hitung uang fisik</span></div>
    <section className="cash-workspace">
      <section className="crud-table-panel cash-history-panel">
        <div className="cash-history-heading"><div><span className="panel-kicker">Catatan transaksi</span><h2>Riwayat uang</h2><p>Lihat uang masuk dan keluar yang sudah tercatat.</p></div><button type="button" className="btn btn-primary cash-add-button" onClick={() => { reset(); setEntryOpen(true); }}><Plus size={16} aria-hidden="true" /> Tambah catatan</button></div>
        <div className="cash-history-toolbar"><label className="cash-history-filter-label" htmlFor="cash-history-filter">Tampilkan<select id="cash-history-filter" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)}><option value="SEMUA">Semua transaksi</option><option value="KASIR / PENJUALAN">Penjualan kasir</option><option value="PENGELUARAN">Pengeluaran</option><option value="PARCEL">Setoran parsel</option><option value="TABUNGAN">Tabungan</option><option value="NET WORTH">Perubahan aset</option><option value="KEUANGAN LAINNYA">Catatan manual</option></select></label><span>{visibleHistory.length} transaksi</span></div>
        <BulkTableActions selectedCount={selectedIds.length} totalCount={transactions.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? transactions.map((transaction) => transaction.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
        <div className="product-table-wrap cash-history-table-wrap"><table className="product-table cash-history-table"><thead><tr><th>Tanggal</th><th>Jenis transaksi</th><th>Keterangan</th><th>Nominal</th><th>Aksi</th></tr></thead><tbody>
          {visibleHistory.map((item) => <tr key={item.id}><td className="cash-history-date">{formatCashDate(item.date || item.createdAt)}</td><td><span className={`cash-source-chip${item.type === 'EXPENSE' ? ' is-expense' : ' is-income'}`}>{item.type === 'INCOME' ? 'Uang masuk' : item.type === 'EXPENSE' ? 'Uang keluar' : item.source === 'KASIR / PENJUALAN' ? 'Penjualan' : item.type}</span><small>{sourceLabels[item.source] || item.source}</small></td><td className="cash-history-description"><strong>{item.description || 'Tanpa keterangan'}</strong><small>{item.category || item.paymentMethod || 'Tanpa kategori'}</small></td><td className={`cash-history-amount ${item.type === 'EXPENSE' ? 'is-expense' : 'is-income'}`}>{item.type === 'EXPENSE' ? '− ' : '+ '}{money(item.amount)}</td><td>{item.source === 'KEUANGAN LAINNYA' || item.source === 'PENGELUARAN' || item.source === 'KASIR / PENJUALAN' ? <div className="row-actions"><button type="button" className="icon-action icon-action-danger" onClick={() => remove(item)} title="Hapus transaksi" aria-label={`Hapus transaksi ${item.description}`}><Trash2 size={14} /><span>Hapus</span></button></div> : '—'}</td></tr>)}
        </tbody></table>{!loading && !visibleHistory.length && <div className="table-empty">{unifiedHistory.length ? 'Tidak ada catatan yang cocok dengan pilihan ini.' : 'Belum ada catatan uang. Catatan baru akan muncul di sini.'}</div>}{loading && <div className="table-empty" role="status">Memuat riwayat uang...</div>}</div>
      </section>
      <aside className="cash-side-column">
        <section className="finance-actions-panel cash-actions-panel"><div className="finance-actions-heading"><div><span className="panel-kicker">Hitung fisik · tutup hari</span><h2>Cocokkan uang kas</h2><p>Hitung semua uang tunai di laci, lalu masukkan jumlahnya di bawah.</p></div><span className="finance-actions-mark">💵</span></div><div className="cash-count-steps"><span><i>1</i> Pisahkan dan hitung uang fisik</span><span><i>2</i> Masukkan total hitungan</span><span><i>3</i> Lihat apakah cocok atau selisih</span></div><div className="finance-actions-grid cash-actions-grid"><ReconciliationModal accounts={cashAccount ? [cashAccount] : []} onDone={load} /></div></section>
        <div className="cash-side-tip"><strong>Ingat</strong><span>Penjualan kasir sudah tercatat otomatis. Tidak perlu dimasukkan lagi sebagai catatan manual.</span></div>
      </aside>
    </section>
    <ModalForm isOpen={entryOpen} onClose={() => { if (!saving) setEntryOpen(false); }} title={editingId ? 'Ubah catatan kas' : 'Tambah catatan kas'} subtitle="Isi informasi uang tunai yang masuk atau keluar." kicker="Catatan baru" maxWidth="540px" cardClassName="cash-entry-modal">
      <form className="crud-form-panel finance-entry-form cash-entry-form cash-entry-modal-form" onSubmit={submit} noValidate>
        <div className="cash-entry-guidance"><strong>Catat transaksi tunai selain penjualan kasir.</strong><span>Penjualan dari kasir sudah masuk otomatis ke riwayat. Jangan masukkan lagi di sini agar tidak terhitung dua kali.</span></div>
        <label>Jenis transaksi<select name="type" value={form.type} onChange={(event) => { update(event); setForm((current) => ({ ...current, categoryId: '' })); }}><option value="INCOME">Uang masuk</option><option value="EXPENSE">Uang keluar</option></select></label>
        <label htmlFor="cash-entry-amount">Nominal<CurrencyInput id="cash-entry-amount" name="amount" value={form.amount} onValueChange={(value) => updateEntryField('amount', value)} placeholder="Contoh: Rp 100.000" aria-invalid={Boolean(entryFieldErrors.amount)} aria-describedby={entryFieldErrors.amount ? 'cash-entry-amount-error' : undefined} />{entryFieldErrors.amount && <small className="cash-entry-field-error" id="cash-entry-amount-error" role="alert">{entryFieldErrors.amount}</small>}</label>
        <label htmlFor="cash-entry-description">Keterangan<input id="cash-entry-description" name="description" value={form.description} onChange={(event) => updateEntryField('description', event.target.value)} placeholder={form.type === 'INCOME' ? 'Contoh: tambahan modal tunai' : 'Contoh: belanja stok tunai'} aria-invalid={Boolean(entryFieldErrors.description)} aria-describedby={entryFieldErrors.description ? 'cash-entry-description-error' : undefined} />{entryFieldErrors.description && <small className="cash-entry-field-error" id="cash-entry-description-error" role="alert">{entryFieldErrors.description}</small>}</label>
        <label>Kategori<select name="categoryId" value={form.categoryId} onChange={update}><option value="">Pilih kategori</option>{categories.filter((category) => category.type === form.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <div className="cash-entry-modal-actions"><button type="button" className="btn btn-secondary" onClick={() => { reset(); setEntryOpen(false); }} disabled={saving}>Batal</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Simpan catatan'}</button></div>
      </form>
    </ModalForm>
    <section className="cash-report-section" aria-label="Grafik dan laporan kas">
      <div className="cash-report-heading"><div><span className="panel-kicker">Gambaran transaksi</span><h2>Arus kas toko</h2><p>Bandingkan uang masuk dan keluar dalam 30 hari terakhir.</p></div></div>
      <div className="cash-report-grid">
        <article className="cash-report-card cashflow-report-card"><div className="cash-report-card-heading"><div><span className="cash-report-icon is-green">↗</span><span><strong>Pergerakan uang harian</strong><small>Uang masuk dibandingkan dengan uang keluar</small></span></div><span className="cash-report-period">30 hari terakhir</span></div><CashflowChart data={cashflow} /></article>
        <article className="cash-report-card category-report-card"><div className="cash-report-card-heading"><div><span className="cash-report-icon is-amber">◔</span><span><strong>Pengeluaran per kategori</strong><small>Lihat ke mana uang kas digunakan</small></span></div></div><CategoryBreakdownChart data={breakdown} /></article>
      </div>
    </section>
    <BulkPasteModal isOpen={bulkPasteOpen} onClose={() => setBulkPasteOpen(false)} categories={categories} accounts={cashAccounts} onDone={load} />
  </AdminShell>;
}
