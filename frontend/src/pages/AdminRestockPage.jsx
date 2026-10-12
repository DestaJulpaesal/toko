import { useEffect, useMemo, useRef, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminRestockPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('Semua');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('Semua');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const itemsRef = useRef([]);

  const load = async () => {
    const query = category !== 'Semua' ? `?category=${encodeURIComponent(category)}` : '';
    const response = await apiFetch(`/restock${query}`);
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Daftar restock gagal dimuat');
    setItems(data.items || []);
    itemsRef.current = data.items || [];
  };

  useEffect(() => {
    Promise.all([apiFetch('/categories'), load()]).then(async ([categoriesResponse]) => {
      const data = await categoriesResponse.json();
      setCategories(data.categories || []);
    }).catch((error) => setNotice(error.message || 'Data restock gagal dimuat'));
  }, []);

  useEffect(() => { load().catch((error) => setNotice(error.message || 'Data restock gagal dimuat')); }, [category]);

  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + Number(item.requestedQty || 0), 0), [items]);
  const estimatedTotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.requestedQty || 0) * Number(item.purchasePrice || 0)), 0), [items]);
  const visibleItems = useMemo(() => items.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${item.productName} ${item.sku} ${item.category}`.toLowerCase().includes(query);
    const stock = Number(item.stockQty || 0);
    const warning = Number(item.stockWarning || 0);
    const matchesStock = stockFilter === 'Semua'
      || (stockFilter === 'Habis' && stock <= 0)
      || (stockFilter === 'Menipis' && stock > 0 && stock <= warning)
      || (stockFilter === 'Aman' && stock > warning);
    return matchesSearch && matchesStock;
  }), [items, search, stockFilter]);

  const updateItem = (variantId, changes) => {
    itemsRef.current = itemsRef.current.map((item) => item.variantId === variantId ? { ...item, ...changes } : item);
    setItems(itemsRef.current);
  };
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
    const rows = [['Produk', 'SKU', 'Kategori', 'Stok', 'Batas minimum', 'Harga modal', 'Jumlah beli', 'Satuan beli', 'Estimasi'], ...items.filter((item) => purchaseQty(item) > 0).map((item) => [item.productName, item.sku, item.category, item.stockQty, item.stockWarning, money(item.purchasePrice), purchaseQty(item), item.purchaseUnit || item.unit || 'unit', money(purchaseQty(item) * Number(item.purchasePrice || 0))])];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `restock-glosir-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const printList = () => {
    const printableItems = itemsRef.current.filter((item) => purchaseQty(item) > 0);
    if (!printableItems.length) {
      setNotice('Isi minimal satu jumlah beli sebelum mencetak.');
      return;
    }
    const printWindow = window.open('', '_blank', 'width=480,height=700');
    if (!printWindow) {
      setNotice('Jendela cetak diblokir browser. Izinkan pop-up untuk mencetak.');
      return;
    }
    const rows = printableItems.map((item, index) => `<div class="row"><span class="number">${String(index + 1).padStart(2, '0')}</span><strong>${item.productName}</strong><span class="qty">${purchaseQty(item)} ${item.purchaseUnit || item.unit || 'unit'}</span></div>`).join('');
    printWindow.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>Daftar Belanja Glosir</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#193127;background:#f4f8f4}
      .paper{max-width:620px;margin:0 auto;padding:30px;background:#fff;border:1px solid #d8e6dc;border-radius:18px;box-shadow:0 10px 28px rgba(28,70,45,.08)}
      .brand{display:flex;align-items:center;gap:12px;padding-bottom:20px;border-bottom:2px solid #21804f}
      .logo{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#21804f;color:#fff;font-size:20px;font-weight:900}
      h1{margin:0;font-size:24px;letter-spacing:-.5px} .subtitle{margin:5px 0 0;color:#718077;font-size:12px}
      .meta{display:flex;justify-content:space-between;margin:20px 0 12px;color:#718077;font-size:12px}
      .list{display:grid;gap:9px}.row{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:12px;padding:14px 12px;border:1px solid #e1ece4;border-radius:11px;background:#f8fbf8;font-size:15px}
      .number{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#dff1e4;color:#21804f;font-size:11px;font-weight:800}
      .qty{padding:7px 10px;border-radius:8px;background:#21804f;color:#fff;font-weight:800;white-space:nowrap}
      .footer{margin-top:20px;padding-top:14px;border-top:1px dashed #c8d9cd;color:#718077;text-align:center;font-size:11px}
      @media print{body{padding:0;background:#fff}.paper{max-width:none;border:0;box-shadow:none;border-radius:0;padding:8mm}.row{break-inside:avoid}}
    </style></head><body><main class="paper"><header class="brand"><span class="logo">G</span><div><h1>Daftar Belanja</h1><p class="subtitle">Glosir · Restok barang</p></div></header><div class="meta"><span>${new Date().toLocaleDateString('id-ID')}</span><span>${printableItems.length} barang</span></div><section class="list">${rows}</section><footer class="footer">Cek barang dan jumlah sebelum pembayaran</footer></main></body></html>`);
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
          <div className="tool-panel-heading"><div><span className="panel-kicker">Daftar belanja</span><h2>{items.length} produk tersedia</h2><p className="restock-panel-help">Pilih barang apa pun untuk dimasukkan ke daftar belanja. Stok tidak berubah dari halaman ini.</p></div><div className="restock-summary"><span>{totalUnits} unit dipilih</span><strong>{money(estimatedTotal)}</strong></div></div>
          <div className="tool-actions">
            <div className="restock-filters">
              <label className="tool-field">Cari barang<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama barang atau SKU" /></label>
              <label className="tool-field">Kondisi stok<select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option>Semua</option><option>Habis</option><option>Menipis</option><option>Aman</option></select></label>
              <label className="tool-field">Filter kategori<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Semua</option>{categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
            </div>
            <div className="tool-action-buttons"><button type="button" className="btn btn-secondary" onClick={exportCsv}>Export CSV</button><button type="button" className="btn btn-secondary" onClick={printList}>Cetak</button><button type="button" className="btn btn-primary" onClick={saveList} disabled={saving || !items.length}>{saving ? 'Menyimpan...' : 'Simpan daftar'}</button></div>
          </div>
          <div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Stok</th><th>Saran</th><th>Harga modal</th><th>Jumlah beli</th><th>Satuan beli</th><th>Estimasi</th></tr></thead><tbody>{visibleItems.map((item) => <tr key={item.variantId}><td><strong>{item.productName}</strong><br /><small>{item.sku} · stok eceran: {item.unit}</small></td><td>{item.category}</td><td className={item.stockQty <= item.stockWarning ? 'negative' : ''}>{item.stockQty}</td><td><span className="restock-suggestion">{item.suggestedQty}</span></td><td>{money(item.purchasePrice)}</td><td><input className="restock-quantity-input" aria-label={`Jumlah beli ${item.productName}`} type="number" min="0" placeholder="Jumlah" value={item.requestedQty || ''} onChange={(event) => updateItem(item.variantId, { requestedQty: event.target.value })} /></td><td><select className="restock-unit-select" aria-label={`Satuan beli ${item.productName}`} value={item.purchaseUnit || item.unit || 'unit'} onChange={(event) => updateItem(item.variantId, { purchaseUnit: event.target.value })}><option value="ball">ball</option><option value="slop">slop</option><option value="pak">pak</option><option value="bungkus">bungkus</option><option value="dus">dus</option><option value="lusin">lusin</option><option value="unit">unit</option></select></td><td>{money(purchaseQty(item) * Number(item.purchasePrice || 0))}</td></tr>)}</tbody></table>{!visibleItems.length && <div className="tool-empty">Tidak ada barang yang cocok dengan pencarian atau filter stok.</div>}<div className="printable-area" aria-hidden="true"></div></div>
        </section>
      </main>
    </div>
  );
}
