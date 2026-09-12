import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';
import CurrencyInput from '../components/CurrencyInput';

export default function AdminEventPackagesPage() {
  const [products, setProducts] = useState([]);
  const [packages, setPackages] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', isManualPrice: false, price: '', items: [] });
  const [notice, setNotice] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    const [productsResponse, packagesResponse] = await Promise.all([apiFetch('/products?all=true'), apiFetch('/event-packages')]);
    const productsData = await productsResponse.json();
    const packagesData = await packagesResponse.json();
    setProducts(productsData.products || []);
    setPackages(packagesData.packages || []);
  };
  useEffect(() => { load().catch((error) => setNotice(error.message || 'Paket gagal dimuat')); }, []);

  const toggleItem = (variantId) => setForm((current) => ({ ...current, items: current.items.some((item) => item.variantId === variantId) ? current.items.filter((item) => item.variantId !== variantId) : [...current.items, { variantId, quantity: 1 }] }));
  const updateQuantity = (variantId, quantity) => {
    const digits = String(quantity).replace(/\D/g, '');
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.variantId === variantId ? { ...item, quantity: digits } : item),
    }));
  };
  const autoPrice = form.items.reduce((sum, item) => sum + Number(products.find((product) => product.variantId === item.variantId)?.price || 0) * Number(item.quantity || 0), 0);
  const filteredProducts = products.filter((product) => `${product.name} ${product.sku} ${product.barcode || ''}`.toLowerCase().includes(productSearch.toLowerCase().trim()));

  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!form.name.trim() || !form.items.length || form.items.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) || (form.isManualPrice && !form.price)) {
      setNotice('Lengkapi nama, isi paket, dan jumlah barang minimal 1.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await apiFetch('/event-packages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, items: form.items.map((item) => ({ ...item, quantity: Number(item.quantity) })), price: form.isManualPrice ? Number(form.price) : autoPrice }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Paket gagal disimpan');
      setNotice('Paket acara berhasil dibuat.');
      setForm({ name: '', description: '', isManualPrice: false, price: '', items: [] });
      await load();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-shell admin-crud-shell tool-page">
      <AdminSidebar active="Paket Acara" />
      <main className="admin-main">
        <header className="tool-hero"><div><span className="eyebrow">Produk bundel</span><h1>Paket Acara</h1><p className="page-lead">Susun kombinasi barang untuk hajatan, nikahan, dan kebutuhan acara lainnya.</p></div><div className="tool-hero-mark">PA<span>+</span></div></header>
        {notice && <p className="notice-banner tool-notice">{notice}</p>}
        <section className="tool-panel"><div className="tool-panel-heading"><div><span className="panel-kicker">Buat katalog baru</span><h2>Rancang paket</h2></div><span className="tool-step">01 / 02</span></div><form onSubmit={(event) => submit(event).catch((error) => setNotice(error.message))}>
          <div className="tool-form-grid"><label className="tool-field">Nama paket<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Paket Sembako Hajatan 50 Porsi" required /></label><label className="tool-field">Deskripsi<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Jelaskan isi dan cocoknya untuk acara apa" /></label></div>
          <fieldset className="package-picker"><legend>Pilih isi paket <small>{form.items.length} barang dipilih</small></legend><div className="picker-toolbar"><span>Pilih barang penyusun paket</span><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama, SKU, barcode..." /></div><div className="package-options">{filteredProducts.map((product) => { const selectedItem = form.items.find((item) => item.variantId === product.variantId); return <div key={product.variantId} className={`package-option${selectedItem ? ' selected' : ''}`}><input type="checkbox" checked={Boolean(selectedItem)} onChange={() => toggleItem(product.variantId)} /><button type="button" className="package-option-copy" onClick={() => toggleItem(product.variantId)}><strong>{product.name}</strong><small>Rp {Number(product.price).toLocaleString('id-ID')} · stok {product.stock}</small></button>{selectedItem && <input className="quantity-input" aria-label={`Jumlah ${product.name}`} type="text" inputMode="numeric" pattern="[0-9]*" value={selectedItem.quantity} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => updateQuantity(product.variantId, event.target.value)} />}</div>; })}{!filteredProducts.length && <div className="picker-empty">Barang tidak ditemukan.</div>}</div></fieldset>
          <div className="tool-price-row"><label className="toggle-field"><input type="checkbox" checked={form.isManualPrice} onChange={(event) => setForm({ ...form, isManualPrice: event.target.checked })} /><span><strong>Harga manual</strong><small>Gunakan harga nego khusus</small></span></label>{form.isManualPrice ? <label className="tool-field compact-field">Harga paket<CurrencyInput value={form.price} onValueChange={(value) => setForm({ ...form, price: value })} placeholder="Rp 5.000.000" required /></label> : <div className="tool-price-preview"><small>Harga otomatis</small><strong>Rp {autoPrice.toLocaleString('id-ID')}</strong></div>}</div>
          <button className="btn btn-primary tool-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan paket'} <span>→</span></button>
        </form></section>
        <section className="tool-panel"><div className="tool-panel-heading"><div><span className="panel-kicker">Katalog aktif</span><h2>Paket yang sudah dibuat</h2></div><span className="tool-count">{packages.length} paket</span></div><div className="package-list">{packages.map((item) => <div className="package-list-item" key={item.id}><span className="package-list-icon">PA</span><div><strong>{item.name}</strong><small>{item.items?.length || 0} komponen paket</small></div><b>Rp {Number(item.price).toLocaleString('id-ID')}</b></div>)}{!packages.length && <div className="tool-empty">Belum ada paket aktif. Paket pertama yang dibuat akan muncul di sini.</div>}</div></section>
      </main>
    </div>
  );
}
