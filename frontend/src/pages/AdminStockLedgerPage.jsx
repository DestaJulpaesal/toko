import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';

export default function AdminStockLedgerPage() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ newQty: '', reason: '' });
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [productsResponse, movementsResponse] = await Promise.all([
      apiFetch('/products?all=true'),
      apiFetch('/stock-movements?limit=250'),
    ]);
    const productsData = await productsResponse.json();
    const movementsData = await movementsResponse.json();
    if (!productsResponse.ok || !productsData.success) throw new Error(productsData.message || 'Produk gagal dimuat');
    if (!movementsResponse.ok || !movementsData.success) throw new Error(movementsData.message || 'Kartu stok gagal dimuat');
    const list = productsData.products || [];
    setProducts(list);
    setMovements(movementsData.movements || []);
    setSelectedId((current) => current || list[0]?.variantId || '');
  };

  useEffect(() => { load().catch((error) => setNotice(error.message)); }, []);
  const selected = products.find((product) => product.variantId === selectedId);
  const filtered = useMemo(() => products.filter((item) => `${item.name} ${item.sku || ''}`.toLowerCase().includes(search.toLowerCase().trim())), [products, search]);
  const selectedMovements = selectedId ? movements.filter((item) => item.variant?.id === selectedId) : movements;

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedId || form.newQty === '' || form.reason.trim().length < 3) return setNotice('Jumlah baru dan alasan wajib diisi.');
    setSaving(true);
    try {
      const response = await apiFetch('/stock-movements/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantId: selectedId, newQty: Number(form.newQty), reason: form.reason }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Penyesuaian stok gagal');
      setNotice('Penyesuaian stok tersimpan dan tercatat dengan nama pengguna.');
      setForm({ newQty: '', reason: '' });
      await load();
    } catch (error) { setNotice(error.message); } finally { setSaving(false); }
  };

  return <AdminShell active="Kartu Stok" className="admin-crud-shell tool-page">
    <header className="tool-hero"><div><span className="eyebrow">Kontrol stok</span><h1>Kartu Stok</h1><p className="page-lead">Pantau setiap stok masuk, keluar, dan penyesuaian. Penyesuaian selalu membutuhkan alasan dan tercatat oleh pengguna.</p></div><div className="tool-hero-mark">ST<span>↕</span></div></header>
    {notice && <p className="notice-banner tool-notice">{notice}</p>}
    <section className="tool-panel"><div className="tool-panel-heading"><div><span className="panel-kicker">Penyesuaian terkendali</span><h2>Ubah stok dengan alasan</h2></div></div>
      <form onSubmit={submit} className="tool-form-grid">
        <label className="tool-field">Cari produk<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama atau SKU" /></label>
        <label className="tool-field">Produk / varian<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{filtered.map((item) => <option key={item.variantId} value={item.variantId}>{item.name} — stok {item.stock} (min. {item.stockWarning ?? 0})</option>)}</select></label>
        <label className="tool-field">Stok baru<input type="number" min="0" step="any" value={form.newQty} onChange={(event) => setForm({ ...form, newQty: event.target.value })} required /></label>
        <label className="tool-field">Alasan wajib<input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Contoh: barang rusak / hitung ulang" required /></label>
        <div className="tool-summary"><span>Stok saat ini <strong>{selected?.stock ?? '—'}</strong> · minimum <strong>{selected?.stockWarning ?? 0}</strong></span><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan penyesuaian'} <span>→</span></button></div>
      </form>
    </section>
    <section className="tool-panel"><div className="tool-panel-heading"><div><span className="panel-kicker">Jejak perubahan</span><h2>Riwayat masuk-keluar</h2></div><span className="tool-count">{selectedMovements.length} catatan</span></div>
      <div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Waktu</th><th>Produk</th><th>Jenis</th><th>Qty</th><th>Alasan / referensi</th><th>Oleh</th></tr></thead><tbody>{selectedMovements.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString('id-ID')}</td><td><strong>{item.product?.name || 'Produk'}</strong><small>{item.variant?.name || ''}</small></td><td>{item.type}</td><td className={item.quantity < 0 ? 'negative' : 'positive'}>{item.quantity > 0 ? '+' : ''}{item.quantity}</td><td>{item.note || item.reference || '—'}</td><td>{item.changedBy?.name || 'Sistem'}</td></tr>)}</tbody></table>{!selectedMovements.length && <div className="tool-empty">Belum ada pergerakan untuk produk ini.</div>}</div>
    </section>
  </AdminShell>;
}
