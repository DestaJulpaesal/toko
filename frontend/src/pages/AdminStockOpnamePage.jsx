import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';
import { confirmAction } from '../utils/confirmService';

export default function AdminStockOpnamePage() {
  const [products, setProducts] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ variantId: '', physicalQty: '', note: '' });
  const [notice, setNotice] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    const [productsResponse, recordsResponse] = await Promise.all([
      apiFetch('/products?all=true'),
      apiFetch('/stock-opnames'),
    ]);
    const productsData = await productsResponse.json();
    const recordsData = await recordsResponse.json();
    setProducts(productsData.products || []);
    setRecords(recordsData.records || []);
    setForm((current) => ({ ...current, variantId: current.variantId || productsData.products?.[0]?.variantId || '' }));
  };

  useEffect(() => { load().catch((error) => setNotice(error.message || 'Data opname gagal dimuat')); }, []);

  const selected = products.find((product) => product.variantId === form.variantId);
  const filteredProducts = products.filter((product) => `${product.name} ${product.sku} ${product.barcode || ''}`.toLowerCase().includes(productSearch.toLowerCase().trim()));
  const difference = selected && form.physicalQty !== '' ? Number(form.physicalQty) - Number(selected.stock || 0) : 0;

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await apiFetch('/stock-opnames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Opname gagal disimpan');
      setNotice('Stok opname berhasil disimpan.');
      setForm((current) => ({ ...current, physicalQty: '', note: '' }));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record) => {
    if (deletingId) return;
    if (!await confirmAction(`Hapus catatan opname untuk "${record.variant?.product?.name || 'produk ini'}"? Stok sistem tidak akan berubah.`)) return;
    setDeletingId(record.id);
    try {
      const response = await apiFetch(`/stock-opnames/${record.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Catatan opname gagal dihapus');
      setNotice('Catatan opname berhasil dihapus. Stok sistem tetap sama.');
      await load();
    } catch (error) {
      setNotice(error.message || 'Catatan opname gagal dihapus');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-shell admin-crud-shell tool-page">
      <AdminSidebar active="Stok Opname" />
      <main className="admin-main">
        <header className="tool-hero"><div><span className="eyebrow">Kontrol stok</span><h1>Stok Opname</h1><p className="page-lead">Cocokkan stok fisik dengan angka sistem dan simpan jejak penyesuaiannya.</p></div><div className="tool-hero-mark">SO<span>✓</span></div></header>
        {notice && <p className="notice-banner tool-notice">{notice}</p>}
        <section className="tool-panel"><div className="tool-panel-heading"><div><span className="panel-kicker">Pemeriksaan barang</span><h2>Catat hasil hitung fisik</h2></div><span className="tool-step">01 / 02</span></div>
          <form onSubmit={(event) => submit(event).catch((error) => setNotice(error.message))} className="tool-form-grid">
            <label className="tool-field">Cari produk<input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nama, SKU, atau barcode" /></label>
            <label className="tool-field">Produk / varian<select value={form.variantId} onChange={(event) => setForm({ ...form, variantId: event.target.value })} required>
              <option value="">Pilih produk</option>
              {filteredProducts.map((product) => <option key={product.variantId} value={product.variantId}>{product.name} - sistem {product.stock}</option>)}
            </select></label>
            <label className="tool-field">Jumlah fisik<input type="number" min="0" value={form.physicalQty} onChange={(event) => setForm({ ...form, physicalQty: event.target.value })} required /></label>
            <label className="tool-field">Catatan<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Opsional" /></label>
            <div className="tool-summary"><span>Selisih stok</span><strong className={difference < 0 ? 'negative' : difference > 0 ? 'positive' : ''}>{difference > 0 ? '+' : ''}{difference}</strong><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan opname'} <span>→</span></button></div>
          </form>
        </section>
        <section className="tool-panel"><div className="tool-panel-heading"><div><span className="panel-kicker">Catatan kontrol</span><h2>Riwayat opname</h2></div><span className="tool-count">{records.length} pemeriksaan</span></div><div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Produk</th><th>Sistem</th><th>Fisik</th><th>Selisih</th><th>Waktu</th><th>Aksi</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><strong>{record.variant?.product?.name || record.variantId}</strong></td><td>{record.systemQty}</td><td>{record.physicalQty}</td><td><span className={`difference-pill ${record.difference < 0 ? 'negative' : record.difference > 0 ? 'positive' : ''}`}>{record.difference > 0 ? '+' : ''}{record.difference}</span></td><td>{new Date(record.createdAt).toLocaleString('id-ID')}</td><td><button type="button" className="table-delete-action" disabled={deletingId === record.id} onClick={() => deleteRecord(record)}>{deletingId === record.id ? 'Menghapus...' : 'Hapus'}</button></td></tr>)}</tbody></table>{!records.length && <div className="tool-empty">Belum ada hasil opname yang tersimpan.</div>}</div></section>
      </main>
    </div>
  );
}
