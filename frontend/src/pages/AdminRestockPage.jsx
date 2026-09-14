import { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';

export default function AdminRestockPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('Semua');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const query = category !== 'Semua' ? `?category=${encodeURIComponent(category)}` : '';
    const response = await apiFetch(`/restock${query}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Daftar restock gagal dimuat');
    setItems(data.items || []);
  };

  useEffect(() => {
    Promise.all([apiFetch('/categories'), load()]).then(async ([categoriesResponse]) => {
      const data = await categoriesResponse.json();
      setCategories(data.categories || []);
    }).catch((error) => setNotice(error.message || 'Data restock gagal dimuat'));
  }, []);

  useEffect(() => { load().catch((error) => setNotice(error.message || 'Data restock gagal dimuat')); }, [category]);

  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + Number(item.requestedQty || 0), 0), [items]);

  const updateItem = (variantId, changes) => setItems((current) => current.map((item) => item.variantId === variantId ? { ...item, ...changes } : item));
  const purchaseQty = (item) => {
    const value = Number.parseInt(String(item.requestedQty ?? '').trim(), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const saveList = async () => {
    setSaving(true);
    try {
      const response = await apiFetch('/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((item) => ({ ...item, requestedQty: Number(item.requestedQty || 0), purchaseUnit: item.purchaseUnit || item.unit || 'unit' })) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Daftar restock gagal disimpan');
      setNotice('Daftar restock berhasil disimpan.');
      await load();
    } catch (error) { setNotice(error.message || 'Daftar restock gagal disimpan'); } finally { setSaving(false); }
  };

  const exportCsv = () => {
    const rows = [['Produk', 'SKU', 'Kategori', 'Stok', 'Batas minimum', 'Jumlah restock', 'Satuan beli'], ...items.map((item) => [item.productName, item.sku, item.category, item.stockQty, item.stockWarning, item.requestedQty || '', item.purchaseUnit || item.unit || 'unit'])];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `restock-glosir-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const printList = () => {
    const printableItems = items.filter((item) => purchaseQty(item) > 0);
    if (!printableItems.length) {
      setNotice('Isi minimal satu jumlah beli sebelum mencetak.');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=480,height=700');
    if (!printWindow) {
      setNotice('Jendela cetak diblokir browser. Izinkan pop-up untuk mencetak.');
      return;
    }
    const rows = printableItems.map((item) => `<div class="row"><span>${item.productName}</span><strong>${purchaseQty(item)} ${item.purchaseUnit || item.unit || 'unit'}</strong></div>`).join('');
    printWindow.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Daftar Belanja Restok</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#1d3027}h1{font-size:24px;margin:0 0 6px}p{color:#68756c;margin:0 0 24px}.row{display:flex;justify-content:space-between;gap:24px;padding:13px 0;border-bottom:1px solid #dce5de;font-size:16px}.row strong{white-space:nowrap}@media print{body{margin:12mm}}</style></head><body><h1>Daftar Belanja Restok</h1><p>${new Date().toLocaleDateString('id-ID')} · ${printableItems.length} barang</p>${rows}</body></html>`);
    printWindow.document.close();
    let printed = false;
    const startPrint = () => {
      if (printed) return;
      printed = true;
      printWindow.focus();
      printWindow.print();
    };
    printWindow.addEventListener('load', startPrint, { once: true });
    setTimeout(startPrint, 500);
  };

  return (
    <div className="admin-shell admin-crud-shell tool-page">
      <AdminSidebar active="Restock" />
      <main className="admin-main">
        <header className="tool-hero"><div><span className="eyebrow">Kontrol stok</span><h1>Manajemen Restock</h1><p className="page-lead">Prioritaskan produk yang stoknya berada di bawah batas minimum.</p></div><div className="tool-hero-mark">RS<span>↗</span></div></header>
        {notice && <p className="notice-banner tool-notice">{notice}</p>}
        <section className="tool-panel">
          <div className="tool-panel-heading"><div><span className="panel-kicker">Daftar pembelian</span><h2>{items.length} produk perlu diisi ulang</h2></div><span className="tool-count">{totalUnits} unit</span></div>
          <div className="tool-actions">
            <label className="tool-field">Filter kategori<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Semua</option>{categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
            <div className="tool-action-buttons"><button type="button" className="btn btn-secondary" onClick={exportCsv}>Export CSV</button><button type="button" className="btn btn-secondary" onClick={printList}>Cetak</button><button type="button" className="btn btn-primary" onClick={saveList} disabled={saving || !items.length}>{saving ? 'Menyimpan...' : 'Simpan daftar'}</button></div>
          </div>
          <div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Stok</th><th>Batas</th><th>Saran</th><th>Jumlah beli</th><th>Satuan beli</th></tr></thead><tbody>{items.map((item) => <tr key={item.variantId}><td><strong>{item.productName}</strong><br /><small>{item.sku} · stok eceran: {item.unit}</small></td><td>{item.category}</td><td className="negative">{item.stockQty}</td><td>{item.stockWarning}</td><td><span className="restock-suggestion">{item.suggestedQty}</span></td><td><input className="restock-quantity-input" aria-label={`Jumlah beli ${item.productName}`} type="number" min="0" placeholder="Jumlah" value={item.requestedQty || ''} onChange={(event) => updateItem(item.variantId, { requestedQty: event.target.value })} /></td><td><select className="restock-unit-select" aria-label={`Satuan beli ${item.productName}`} value={item.purchaseUnit || item.unit || 'unit'} onChange={(event) => updateItem(item.variantId, { purchaseUnit: event.target.value })}><option value="ball">ball</option><option value="slop">slop</option><option value="pak">pak</option><option value="bungkus">bungkus</option><option value="dus">dus</option><option value="lusin">lusin</option><option value="unit">unit</option></select></td></tr>)}</tbody></table>{!items.length && <div className="tool-empty">Tidak ada stok menipis pada kategori ini.</div>}<div className="printable-area" aria-hidden="true"><h1>Daftar Belanja Restok</h1><p>{new Date().toLocaleDateString('id-ID')}</p>{items.filter((item) => Number(item.requestedQty || 0) > 0).map((item) => <div key={item.variantId} className="print-restock-row"><span>{item.productName}</span><strong>{item.requestedQty} {item.purchaseUnit || item.unit || 'unit'}</strong></div>)}</div></div>
        </section>
      </main>
    </div>
  );
}
