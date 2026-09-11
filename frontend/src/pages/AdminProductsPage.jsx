import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, PackagePlus, Pencil, ShoppingBag, Trash2 } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BulkProductModal from '../components/BulkProductModal';
import BarcodePrintModal from '../components/BarcodePrintModal';
import StockReceiptImportModal from '../components/StockReceiptImportModal';
import { generateAutoBarcode, playBeep } from '../utils/barcodeUtils';
import CurrencyInput from '../components/CurrencyInput';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', sku: '', barcode: '', category: '', price: '', wholesalePrice: '', purchasePrice: '', originalPrice: '', stock: '', status: 'Aktif' };

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Barcode & Bulk Modals
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [printModalProduct, setPrintModalProduct] = useState(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/products?all=true');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error('Database produk belum tersedia');
      setProducts(data.products);
      localStorage.setItem('glosir_products_cache', JSON.stringify(data.products));
    } catch (error) {
      try {
        const cachedProducts = JSON.parse(localStorage.getItem('glosir_products_cache') || '[]');
        setProducts(Array.isArray(cachedProducts) ? cachedProducts : []);
      } catch {
        setProducts([]);
      }
      setNotice(error.message === 'Failed to fetch' ? 'Backend sedang tidak tersambung. Coba segarkan halaman setelah server aktif.' : error.message || 'Produk gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiFetch('/categories');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Kategori gagal dimuat');
      setCategories(data.categories || []);
      setForm((current) => ({ ...current, category: current.category && data.categories.some((item) => item.name === current.category) ? current.category : data.categories[0]?.name || '' }));
    } catch (error) {
      setNotice(error.message === 'Failed to fetch' ? 'Backend sedang tersambung ulang. Coba segarkan halaman.' : error.message || 'Kategori gagal dimuat.');
    }
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const visibleProducts = products.filter((product) => {
    const matchesSearch = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'Semua' || product.status === statusFilter);
  });

  const allVisibleProductsSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selectedProductIds.includes(product.id));
  const toggleProductSelection = (id, checked) => setSelectedProductIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  const toggleAllProducts = (checked) => setSelectedProductIds(checked ? visibleProducts.map((product) => product.id) : []);
  const deleteSelectedProducts = async () => {
    if (!selectedProductIds.length || !await confirmAction(`Hapus ${selectedProductIds.length} produk terpilih? Produk akan disembunyikan dari katalog.`)) return;
    const token = localStorage.getItem('glosir_token');
    if (!token) { setNotice('Session login tidak ditemukan. Silakan login ulang.'); return; }
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedProductIds.map((id) => apiFetch(`/products/${id}`, { method: 'DELETE' }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const deletedIds = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    setSelectedProductIds([]);
    setBulkDeleting(false);
    await loadProducts();
    setNotice(`${deletedIds.length} produk berhasil dihapus${deletedIds.length < results.length ? `, ${results.length - deletedIds.length} gagal` : ''}.`);
  };

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  // 1-Click Auto Barcode
  const handleAutoGenerateBarcode = () => {
    const generated = generateAutoBarcode('899', products);
    setForm((prev) => ({ ...prev, barcode: generated }));
    playBeep(1400, 0.08);
  };

  // Bulk add handler
  const handleAddBulkProducts = async (newProducts) => {
    const token = localStorage.getItem('glosir_token');
    const fallbackCategory = categories.find((category) => category.name === 'Warung')?.name || categories[0]?.name || '';
    const normalizedProducts = newProducts.map((product) => ({
      ...product,
      category: product.category?.toLowerCase() === 'glosir' ? fallbackCategory : product.category || fallbackCategory,
    }));
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30000);
      const response = await apiFetch('/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ products: normalizedProducts }),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('glosir_token');
        localStorage.removeItem('glosir_user');
        setNotice('Sesi login sudah berakhir. Silakan login ulang untuk menyimpan banyak barang.');
        setTimeout(() => { window.location.href = '/login'; }, 1200);
        return;
      }
      if (!response.ok || !data.success) throw new Error(data.message || 'Bulk import gagal.');
      await loadProducts();
      setNotice(`✓ Berhasil menyimpan ${data.products.length} produk ke database.`);
      playBeep(1600, 0.15);
    } catch (error) {
      setNotice(error.name === 'AbortError' ? 'Import banyak barang terlalu lama. Periksa koneksi database lalu coba lagi.' : error.message || 'Bulk import gagal.');
    }
  };

  const handleImportStockReceipt = async (rows) => {
    const token = localStorage.getItem('glosir_token');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    let createdCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
      const normalizedName = String(row.name || '').trim().toLowerCase();
      const normalizedBarcode = String(row.barcode || '').trim().toLowerCase();
      const matched = products.find(
        (product) =>
          String(product.name || '').trim().toLowerCase() === normalizedName ||
          (normalizedBarcode && [product.barcode, product.sku].some((value) => String(value || '').trim().toLowerCase() === normalizedBarcode))
      );

      if (matched) {
        const nextStock = Number(matched.stock || 0) + Number(row.stock || 0);
        const response = await apiFetch(`/products/${matched.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            ...matched,
            stock: nextStock,
            category: matched.category,
            barcode: matched.barcode || row.barcode || '',
            sku: matched.sku,
            price: Number(matched.price || 0),
            wholesalePrice: matched.wholesalePrice || '',
            originalPrice: matched.originalPrice ? Number(matched.originalPrice) : null,
          }),
        });
        const data = await response.json();
        if (response.ok && data.success) updatedCount += 1;
      } else {
        const payload = {
          name: row.name,
          sku: row.sku,
          barcode: row.barcode || '',
          category: categories[0]?.name || '',
          price: Number(row.price || 0),
          wholesalePrice: row.wholesalePrice ? Number(row.wholesalePrice) : null,
          originalPrice: Number(row.price || 0),
          stock: Number(row.stock || 0),
          status: 'Aktif',
        };
        const response = await apiFetch('/products', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (response.ok && data.success) createdCount += 1;
      }
    }

    await loadProducts();
    setNotice(`✓ Barang masuk berhasil diproses: ${updatedCount} item update, ${createdCount} item baru.`);
    playBeep(1600, 0.18);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!String(form.name || '').trim() || !form.price || !form.stock) {
      setNotice('Lengkapi nama, harga, dan stok produk.');
      return;
    }

    const actionLabel = editingId ? 'memperbarui produk ini' : 'menambahkan produk baru';
    if (!await confirmAction(`Yakin ingin ${actionLabel}?`)) return;

    let timeoutId;
    try {
      setSaving(true);
      setNotice('Menyimpan perubahan ke database...');
      const payload = {
        ...form,
        name: String(form.name || '').trim(),
        sku: String(form.sku || '').trim() || `GLS-${Date.now()}`,
        barcode: String(form.barcode || '').trim() || null,
        category: String(form.category || '').trim(),
        status: String(form.status || 'Aktif'),
        price: Number(form.price),
        wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        stock: Number(form.stock),
      };
      const discountPercent = payload.originalPrice && payload.originalPrice > payload.price
        ? Math.round(((payload.originalPrice - payload.price) / payload.originalPrice) * 100)
        : 0;
      const token = localStorage.getItem('glosir_token');
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 15000);
      const response = await apiFetch(editingId ? `/products/${editingId}` : '/products', {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || `Produk gagal disimpan (HTTP ${response.status}).`);
      setProducts((previous) => {
        const nextProducts = editingId
          ? previous.map((product) => product.id === editingId ? data.product : product)
          : [data.product, ...previous];
        localStorage.setItem('glosir_products_cache', JSON.stringify(nextProducts));
        return nextProducts;
      });
      setNotice(editingId ? 'Produk berhasil diperbarui di database.' : 'Produk berhasil ditambahkan ke database.');
      resetForm();
    } catch (error) {
      setNotice(error.name === 'AbortError' ? 'Penyimpanan terlalu lama. Periksa koneksi database lalu coba lagi.' : error.message || 'Produk gagal disimpan ke database.');
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setSaving(false);
    }
  };

  const editProduct = (product) => {
    setEditingId(product.id);
    setForm({
      ...product,
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      category: product.category || categories[0]?.name || '',
      status: product.status || 'Aktif',
      price: product.price ?? '',
      wholesalePrice: product.wholesalePrice ?? '',
      purchasePrice: product.purchasePrice ?? '',
      originalPrice: product.originalPrice ?? '',
      stock: product.stock ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteProduct = async (id) => {
    const product = products.find((item) => item.id === id);
    if (!await confirmAction(`Hapus produk "${product?.name || 'ini'}" secara permanen? SKU dan barcode-nya bisa dipakai lagi setelah dihapus.`)) return;

    try {
      const token = localStorage.getItem('glosir_token');
      if (!token) {
        setNotice('Session login tidak ditemukan. Silakan login ulang sebelum menghapus produk.');
        return;
      }

      const response = await apiFetch(`/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('glosir_token');
        setNotice('Session login sudah expired. Silakan login ulang untuk menghapus produk.');
        return;
      }
      if (!response.ok || !data.success) throw new Error(data.message || 'Produk gagal dihapus.');
      await loadProducts();
      setNotice('Produk berhasil dihapus permanen dari database. SKU dan barcode dapat dipakai lagi.');
      if (editingId === id) resetForm();
    } catch (error) {
      setNotice(error.message || 'Produk gagal dihapus. Data tetap tersimpan.');
    }
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Produk" />

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(scannedSku) => {
          const cleanCode = String(scannedSku || '').trim().toLowerCase();
          const matchedProduct = products.find((product) =>
            [product.barcode, product.sku].some((value) => String(value || '').trim().toLowerCase() === cleanCode)
          );

          if (matchedProduct) {
            setEditingId(matchedProduct.id);
            setForm({
              name: matchedProduct.name || '',
              sku: matchedProduct.sku || scannedSku,
              barcode: matchedProduct.barcode || scannedSku,
              category: matchedProduct.category || categories[0]?.name || '',
              price: matchedProduct.price || '',
              wholesalePrice: matchedProduct.wholesalePrice || '',
              purchasePrice: matchedProduct.purchasePrice || '',
              originalPrice: matchedProduct.originalPrice || '',
              stock: matchedProduct.stock ?? '',
              status: matchedProduct.status || 'Aktif',
            });
            setNotice(`✓ ${matchedProduct.name} ditemukan dan form otomatis terisi.`);
          } else {
            setForm((prev) => ({ ...prev, barcode: scannedSku, sku: prev.sku || scannedSku }));
            setNotice(`Barcode "${scannedSku}" berhasil dibaca, tetapi belum terdaftar. Lengkapi nama produk lalu simpan.`);
          }
        }}
      />

      {/* Bulk Add Products Modal */}
      <BulkProductModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onAddProducts={handleAddBulkProducts}
        onRefreshProducts={loadProducts}
        existingProducts={products}
      />

      <StockReceiptImportModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onImport={handleImportStockReceipt}
        existingProducts={products}
      />

      {/* Barcode Print Sticker Modal */}
      <BarcodePrintModal
        isOpen={Boolean(printModalProduct)}
        onClose={() => setPrintModalProduct(null)}
        product={printModalProduct}
      />

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Product management</p>
            <h1>Kelola Produk & Barcode</h1>
            <p className="admin-subtitle">Tambah produk, buat barcode otomatis, atau scan kemasan fisik.</p>
          </div>
          <div className="admin-header-actions" style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setBulkModalOpen(true)}
              title="Tambah puluhan sembako populer tanpa ngetik barcode"
            >
              <PackagePlus size={16} /> Tambah Banyak Barang Sekaligus
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setReceiptModalOpen(true)}
              title="Masukkan stok dari foto/nota barang masuk"
            >
              <ShoppingBag size={16} /> Barang Masuk
            </button>
            <Link to="/products" className="btn btn-secondary"><Eye size={16} /> Lihat katalog</Link>
          </div>
        </header>

        {notice && (
          <div className="crud-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button>
          </div>
        )}

        <section className="crud-layout">
          <form className="crud-form-panel" onSubmit={submitForm}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Edit produk' : 'Produk baru'}</span>
                <h2>{editingId ? 'Perbarui informasi' : 'Tambah produk'}</h2>
              </div>
              {editingId && <button type="button" className="text-button" onClick={resetForm}>Batal</button>}
            </div>

            <label>
              Nama produk
              <input name="name" value={form.name || ''} onChange={updateField} placeholder="Contoh: Kopi Bubuk Premium" />
            </label>

            <label>
              SKU / Barcode
              <div className="sku-input-wrapper">
                <input
                  name="barcode"
                  value={form.barcode || ''}
                  onChange={updateField}
                  placeholder="Opsional: scan barcode pabrik"
                />
                <input
                  name="sku"
                  value={form.sku || ''}
                  onChange={updateField}
                  placeholder="SKU internal (opsional, otomatis)"
                />
                <button
                  type="button"
                  className="btn-auto-barcode"
                  onClick={handleAutoGenerateBarcode}
                  title="Buat barcode internal untuk dicetak pada label toko"
                >
                  ⚡ Buat Label
                </button>
                <button
                  type="button"
                  className="btn-scan-barcode"
                  onClick={() => setScannerOpen(true)}
                  title="Buka kamera untuk scan barcode kemasan barang"
                >
                  📷 Scan
                </button>
              </div>
                <small style={{ color: '#6b7280', fontSize: '0.74rem', marginTop: '4px', display: 'block' }}>
                Barcode pabrik opsional. Produk tanpa barcode tetap bisa dicari lewat nama atau SKU internal.
              </small>
            </label>

            <div className="form-two-columns">
              <label>
                Kategori
                <select name="category" value={form.category || ''} onChange={updateField}>
                  {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Status
                <select name="status" value={form.status || 'Aktif'} onChange={updateField}>
                  <option>Aktif</option>
                  <option>Stok menipis</option>
                  <option>Draft</option>
                </select>
              </label>
            </div>

            <div className="form-two-columns">
              <label>
                Harga Jual (Promo)
                <CurrencyInput name="price" value={form.price} onValueChange={(value) => setForm((current) => ({ ...current, price: value }))} placeholder="Rp 48.000" />
              </label>
              <label>
                Harga warung / grosir
                <CurrencyInput name="wholesalePrice" value={form.wholesalePrice || ''} onValueChange={(value) => setForm((current) => ({ ...current, wholesalePrice: value }))} placeholder="Opsional, mis. Rp 45.000" />
              </label>
            </div>
            <div className="form-two-columns">
              <label>
                Harga beli / modal
                <CurrencyInput name="purchasePrice" value={form.purchasePrice || ''} onValueChange={(value) => setForm((current) => ({ ...current, purchasePrice: value }))} placeholder="Rp 40.000" />
              </label>
            </div>

            <div className="form-two-columns">
              <label>
                Harga Normal / Coret (Opsional)
                <CurrencyInput name="originalPrice" value={form.originalPrice || ''} onValueChange={(value) => setForm((current) => ({ ...current, originalPrice: value }))} placeholder="Rp 60.000" />
              </label>
            </div>

            <label>
              Stok
              <input name="stock" value={form.stock ?? ''} onChange={updateField} type="number" min="0" placeholder="25" />
            </label>

            <button className="btn btn-primary full" type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah produk'}
            </button>
          </form>

          <section className="crud-table-panel">
            <div className="crud-toolbar">
              <label className="crud-search">
                <span>cari</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau barcode SKU..." />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option>Semua</option>
                <option>Aktif</option>
                <option>Stok menipis</option>
                <option>Draft</option>
              </select>
            </div>
            <BulkTableActions selectedCount={selectedProductIds.length} totalCount={visibleProducts.length} allSelected={allVisibleProductsSelected} onToggleAll={toggleAllProducts} onDelete={deleteSelectedProducts} deleting={bulkDeleting} />

            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Produk & Barcode</th>
                    <th>Kategori</th>
                    <th>Harga</th>
                    <th>Stok</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="bulk-check-column"><BulkRowCheckbox checked={selectedProductIds.includes(product.id)} onChange={(checked) => toggleProductSelection(product.id, checked)} label={`Pilih ${product.name}`} /></td>
                      <td>
                        <strong>{product.name}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', color: '#1f2937', fontWeight: 600 }}>
                            🏷️ {product.sku}
                          </span>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#1f7a4a', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                            onClick={() => setPrintModalProduct(product)}
                            title="Cetak stiker barcode untuk barang ini"
                          >
                            🖨️ Cetak Stiker
                          </button>
                        </div>
                      </td>
                      <td>{product.category}</td>
                      <td>
                        <strong>Rp {Number(product.price).toLocaleString('id-ID')}</strong>
                        {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <del style={{ color: '#8c867e', fontSize: '0.78rem' }}>Rp {Number(product.originalPrice).toLocaleString('id-ID')}</del>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c0392b', background: '#fdedec', padding: '1px 6px', borderRadius: '4px' }}>
                              -{product.discountPercent || Math.round(((Number(product.originalPrice) - Number(product.price)) / Number(product.originalPrice)) * 100)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td>{product.stock}</td>
                      <td>
                        <span className={`status-chip ${product.status === 'Aktif' ? 'good' : product.status === 'Stok menipis' ? 'warning' : ''}`}>
                          {product.status}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-action" onClick={() => editProduct(product)} title="Edit produk" aria-label={`Edit produk ${product.name}`}><Pencil size={14} /></button>
                          <button className="icon-action icon-action-danger" onClick={() => deleteProduct(product.id)} title="Hapus produk" aria-label={`Hapus produk ${product.name}`}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="table-empty">Memuat produk dari database...</div>}
              {!loading && visibleProducts.length === 0 && <div className="table-empty">Produk tidak ditemukan.</div>}
            </div>
          </section>
        </section>

        <footer className="admin-footer">Glosir Owner Workspace <span>Sistem Barcode & Inventory Terintegrasi</span></footer>
      </main>
    </div>
  );
}
