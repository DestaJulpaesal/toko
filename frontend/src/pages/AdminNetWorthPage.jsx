import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';
import CurrencyInput from '../components/CurrencyInput';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const emptyForm = { name: '', kind: 'ASSET', value: '' };

export default function AdminNetWorthPage() {
  const [summary, setSummary] = useState({});
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [historyItemId, setHistoryItemId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    const response = await apiFetch(`/finance/networth?refresh=${Date.now()}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'Net worth gagal dimuat');
    setSummary(result.data || {});
    setItems(result.data?.items || []);
  };
  useEffect(() => { load().catch((error) => setNotice(error.message)); }, []);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiFetch(editingId ? `/finance/networth/items/${editingId}` : '/finance/networth/items', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, value: Number(form.value) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Item gagal disimpan');
      setNotice(editingId ? 'Item berhasil diperbarui.' : 'Item berhasil ditambahkan.');
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (error) {
      setNotice(error.message || 'Item gagal disimpan ke database.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (deletingId) return;
    if (!window.confirm(`Arsipkan "${item.name}"?`)) return;
    setDeletingId(item.id);
    try {
      const response = await apiFetch(`/finance/networth/items/${item.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Item gagal dihapus');
      setNotice('Item berhasil diarsipkan.');
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-shell admin-crud-shell finance-workspace">
      <AdminSidebar active="Net Worth" />
      <main className="admin-main">
        <header className="finance-page-hero">
          <div><span className="finance-kicker">Gambaran kekayaan</span><h1>Kekayaan Bersih</h1><p>Pantau aset, liabilitas, dan posisi finansial toko dalam satu tempat.</p></div>
          <div className="finance-hero-mark">NW</div>
        </header>
        {notice && <p className="notice-banner finance-notice">{notice}</p>}
        <section className="finance-summary-strip networth-summary">
          <div><span>Total aset</span><strong className="positive">{money(summary.totalAsset)}</strong><small>saldo, stok, dan aset lain</small></div>
          <div><span>Total utang/kewajiban</span><strong className="negative">{money(summary.totalLiability)}</strong><small>kewajiban yang tercatat</small></div>
          <div><span>Total Kekayaan Bersih</span><strong>{money(summary.netWorth)}</strong><small>aset dikurangi kewajiban</small></div>        </section>
        <div className="finance-two-column">
          <section className="finance-panel">
            <div className="finance-panel-heading"><div><span className="finance-kicker">{editingId ? 'Perbarui data' : 'Tambah data'}</span><h2>{editingId ? 'Edit item kekayaan' : 'Catat aset atau liabilitas'}</h2></div></div>
            <form className="finance-form" onSubmit={save}>
              <label>Nama item<input list="networth-item-names" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Pilih atau ketik nama item" required /><datalist id="networth-item-names">{[...new Set(items.map((item) => item.name))].map((name) => <option key={name} value={name} />)}</datalist><small className="finance-field-help">Jika nama dan jenis sama, nominal baru akan ditambahkan ke item yang sudah ada.</small></label>
              <label>Jenis<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="ASSET">Aset</option><option value="LIABILITY">Liabilitas</option></select></label>
              <label>Nilai<CurrencyInput value={form.value} onValueChange={(value) => setForm({ ...form, value })} placeholder="Rp 0" required /></label>
              <div className="finance-form-actions"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah item'}</button>{editingId && <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => { setEditingId(null); setForm(emptyForm); }}>Batal</button>}</div>
            </form>
          </section>
          <section className="finance-panel finance-tip-panel"><span className="finance-tip-icon">i</span><h2>Tips pencatatan</h2><p>Masukkan nilai terbaru untuk aset fisik, saldo kas, kendaraan, atau kewajiban di luar piutang toko.</p><div className="finance-tip-line"><span>Item tercatat</span><strong>{items.length}</strong></div></section>
        </div>
        <section className="finance-panel">
          <div className="finance-panel-heading"><div><span className="finance-kicker">Daftar posisi</span><h2>Item kekayaan</h2></div><span className="finance-count">{items.length} item</span></div>
          {!items.length ? <div className="finance-empty"><span className="finance-empty-icon">+</span><strong>Belum ada item manual</strong><p>Tambahkan aset atau liabilitas untuk melengkapi perhitungan.</p></div>
            : <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Nama item</th><th>Jenis</th><th>Nilai</th><th>Tanggal dicatat</th><th>Aksi</th></tr></thead><tbody>{items.map((item) => <><tr key={item.id}><td><strong>{item.name}</strong></td><td><span className={`finance-badge ${item.kind === 'ASSET' ? 'asset' : 'liability'}`}>{item.kind === 'ASSET' ? 'Aset' : 'Liabilitas'}</span></td><td><strong className={item.kind === 'ASSET' ? 'finance-amount positive' : 'finance-amount negative'}>{money(item.value)}</strong></td><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td><td><div className="finance-action-group"><button type="button" className="btn btn-secondary small" onClick={() => setHistoryItemId(historyItemId === item.id ? null : item.id)}>{historyItemId === item.id ? 'Tutup riwayat' : 'Riwayat'}</button><button type="button" className="btn btn-danger small" onClick={() => remove(item).catch((error) => setNotice(error.message))}>Hapus</button></div></td></tr>{historyItemId === item.id && <tr key={`${item.id}-history`}><td colSpan="5"><div className="networth-history"><div className="networth-history-heading"><div><span className="finance-kicker">Catatan perubahan</span><strong>Riwayat penambahan</strong></div><span>{item.history?.length || 0} kali penambahan</span></div><div className="networth-history-list">{(item.history || []).map((entry, index) => { const balance = Number(item.value) - (item.history || []).slice(0, index).reduce((sum, row) => sum + Number(row.amount || 0), 0); return <div className="networth-history-entry" key={entry.id}><span className="networth-history-index">{(item.history.length - index).toString().padStart(2, '0')}</span><div className="networth-history-date"><strong>{new Date(entry.addedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>Penambahan saldo</small></div><strong className="networth-history-amount">+{money(entry.amount)}</strong><div className="networth-history-balance"><small>Total setelah penambahan</small><strong>{money(balance)}</strong></div></div>; })}</div></div></td></tr>}</>)}</tbody></table></div>}
        </section>
      </main>
    </div>
  );
}
