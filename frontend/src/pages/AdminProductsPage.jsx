import { useEffect, useRef, useState } from 'react';
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
import CatalogImageField from '../components/CatalogImageField';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';
      sessionStorage.setItem(ADMIN_PRODUCTS_CACHE_KEY, JSON.stringify(data.products));
    } catch (error) {
      try {
        const cachedProducts = JSON.parse(sessionStorage.getItem(ADMIN_PRODUCTS_CACHE_KEY) || '[]');        setProducts(Array.isArray(cachedProducts) ? cachedProducts : []);
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
      setForm((current) => {
        const currentCategory = String(current.category || '').trim().toLowerCase();
        const matchedCategory = data.categories.find((item) => item.name.trim().toLowerCase() === currentCategory);
        return { ...current, category: matchedCategory?.name || '' };
      });
    } catch (error) {
      setNotice(error.message === 'Failed to fetch' ? 'Backend sedang tersambung ulang. Coba segarkan halaman.' : error.message || 'Kategori gagal dimuat.');
    }
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => () => window.clearTimeout(scannerTimerRef.current), []);

  const visibleProducts = products.filter((product) => {
    const matchesSearch = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'Semua' || product.status === statusFilter;
    const matchesCategory = categoryFilter === 'Semua' || product.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  }).sort((first, second) => {
    const textCompare = (left, right) => String(left || '').localeCompare(String(right || ''), 'id', { sensitivity: 'base' });
    switch (sortBy) {
      case 'nameAsc': return textCompare(first.name, second.name);
      case 'nameDesc': return textCompare(second.name, first.name);
      case 'categoryAsc': return textCompare(first.category, second.category) || textCompare(first.name, second.name);
      case 'categoryDesc': return textCompare(second.category, first.category) || textCompare(first.name, second.name);
      case 'priceAsc': return Number(first.price || 0) - Number(second.price || 0);
      case 'priceDesc': return Number(second.price || 0) - Number(first.price || 0);
      case 'stockAsc': return Number(first.stock || 0) - Number(second.stock || 0);
      case 'stockDesc': return Number(second.stock || 0) - Number(first.stock || 0);
      default: return 0;
    }
  });

  const allVisibleProductsSelected = visibleProducts.length > 0 && visibleProducts.every((product) => selectedProductIds.includes(product.id));
  const toggleProductSelection = (id, checked) => setSelectedProductIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  const toggleAllProducts = (checked) => setSelectedProductIds(checked ? visibleProducts.map((product) => product.id) : []);
  const deleteSelectedProducts = async () => {
    if (!selectedProductIds.length || !await confirmAction(`Hapus ${selectedProductIds.length} produk terpilih? Produk akan disembunyikan dari katalog.`)) return;
    const token = localStorage.getItem('glosir_token');
    if (!token) { setNotice('Session login tidak ditemukan. Silakan login ulang.'); return; }
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedProductIds.map((id) => apiFetch(`/products/${id}`, { method: 'DELETE', silentNotify: true }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const deletedIds = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const failedMessages = results.filter((result) => result.status === 'rejected').map((result) => result.reason?.message).filter(Boolean);
    setSelectedProductIds([]);
    setBulkDeleting(false);
    await loadProducts();
    const summary = `${deletedIds.length} produk berhasil dihapus${deletedIds.length < results.length ? `, ${results.length - deletedIds.length} gagal: ${failedMessages[0] || 'periksa relasi data produk'}` : '.'}`;
    setNotice(summary);
    showNotice(summary, deletedIds.length === results.length ? 'success' : 'error');
  };

  const normalizeBarcode = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const fillFormFromProduct = (product, scannedCode = '') => {
    setEditingId(product.id);
    setForm({
      ...product,
      name: product.name || '',
      sku: product.sku || scannedCode,
      barcode: product.barcode || scannedCode,
      category: product.category || categories[0]?.name || '',
      price: product.price ?? '',
      wholesalePrice: product.wholesalePrice ?? '',
      purchasePrice: product.purchasePrice ?? '',
      originalPrice: product.originalPrice ?? '',
      stock: product.stock ?? '',
      status: product.status || 'Aktif',
      imageUrl: product.imageUrl || '',
    });
    setNotice(`✓ ${product.name} terdeteksi. Nama produk otomatis dimasukkan.`);
  };

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === 'barcode') {
      const cleanCode = normalizeBarcode(value);
      const matchedProduct = products.find((product) =>
        [product.barcode, product.sku].some((item) => normalizeBarcode(item) === cleanCode)
      );
      if (matchedProduct && cleanCode.length >= 8) fillFormFromProduct(matchedProduct, value);
    }
  };

  const detectProductFromBarcode = (rawCode) => {
    const cleanCode = normalizeBarcode(rawCode);
    if (!cleanCode) return;
    const matchedProduct = products.find((product) =>
      [product.barcode, product.sku].some((value) => normalizeBarcode(value) === cleanCode)
    );
    if (matchedProduct) {
      fillFormFromProduct(matchedProduct, rawCode);
    } else {
      setNotice(`Barcode "${rawCode}" terbaca, tetapi belum terdaftar. Isi nama produk lalu simpan.`);
    }
    window.setTimeout(() => barcodeInputRef.current?.focus(), 0);
  };

  const handleBarcodeInputKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    detectProductFromBarcode(form.barcode);
  };

  useEffect(() => {
    const handleScannerKeyDown = (event) => {
      if (event.target !== barcodeInputRef.current && (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
      if (event.key === 'Enter') {
        if (scannerBufferRef.current.length >= 8) {
          event.preventDefault();
          const code = scannerBufferRef.current;
          scannerBufferRef.current = '';
          detectProductFromBarcode(code);
        }
        return;
      }
      if (event.key.length !== 1 || !/[a-z0-9]/i.test(event.key)) return;
      scannerBufferRef.current += event.key;
      window.clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = window.setTimeout(() => {
        scannerBufferRef.current = '';
      }, 150);
    };
    window.addEventListener('keydown', handleScannerKeyDown);
    return () => window.removeEventListener('keydown', handleScannerKeyDown);
  }, [products, categories]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setAuditLogs([]);
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
    const selectedCategory = categories.find((item) => item.name.trim().toLowerCase() === String(form.category || '').trim().toLowerCase());
    if (!String(form.name || '').trim() || !form.price || !form.stock || !selectedCategory) {
      setNotice(!selectedCategory ? 'Pilih kategori produk terlebih dahulu.' : 'Lengkapi nama, harga, dan stok produk.');
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
        category: selectedCategory.name,
        status: String(form.status || 'Aktif'),
        price: Number(form.price),
        wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        stock: Number(form.stock),
        isQuickAccess: Boolean(form.isQuickAccess),
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
      if (!response.ok || !data.success) {
        const validationDetails = Array.isArray(data.errors)
          ? data.errors.map((item) => `${item.field || 'field'}: ${item.message}`).join(', ')
          : '';
        throw new Error(validationDetails || data.message || `Produk gagal disimpan (HTTP ${response.status}).`);
      }
      setProducts((previous) => {
        const nextProducts = editingId
          ? previous.map((product) => product.id === editingId ? data.product : product)
          : [data.product, ...previous];
        sessionStorage.setItem(ADMIN_PRODUCTS_CACHE_KEY, JSON.stringify(nextProducts));        return nextProducts;
      });
      if (data.product?.id && form.packages?.length) {
        for (const packageForm of form.packages) {
          const packageResponse = await apiFetch(packageForm.id ? `/products/${data.product.id}/variants/${packageForm.id}` : `/products/${data.product.id}/variants`, {
            method: packageForm.id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(packageForm),
          });
          const packageData = await packageResponse.json();
          if (!packageResponse.ok || !packageData.success) throw new Error(packageData.message || 'Kemasan gagal disimpan.');
        }
        await loadProducts();
      }
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
      packages: (product.variants || []).filter((variant) => !variant.isDefault).map((variant) => ({
        id: variant.id,
        name: variant.name || '',
        sku: variant.sku || '',
        barcode: variant.barcode || '',
        price: variant.price ?? '',
        wholesalePrice: variant.wholesalePrice ?? '',
        purchasePrice: variant.purchasePrice ?? '',
        stock: variant.stock ?? '',
      })),
    });
    apiFetch(`/audit-logs?entityId=${encodeURIComponent(product.variantId || product.id)}`)
      .then((response) => response.json())
      .then((data) => setAuditLogs(data.logs || []))
      .catch(() => setAuditLogs([]));
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
            fillFormFromProduct(matchedProduct, scannedSku);
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
            <button type="button" className="btn btn-secondary" onClick={downloadExcel}>Unduh Excel</button><Link to="/products" className="btn btn-secondary"><Eye size={16} /> Lihat katalog</Link>
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
                  ref={barcodeInputRef}
                  name="barcode"
                  value={form.barcode || ''}
                  onChange={updateField}
                  onKeyDown={handleBarcodeInputKeyDown}
                  autoComplete="off"
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
                  <option value="">Pilih kategori produk</option>
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

            <CatalogImageField value={form.imageUrl || ''} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} group="products" label="Foto produk" />

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

            <section className="product-packages-panel">
              <div className="panel-heading">
                <div><span className="panel-kicker">Kemasan tambahan</span><h3>Atur ukuran jual selain eceran</h3><p className="product-package-help">Contoh: 1 dus berisi beberapa unit. Setiap kemasan dapat memiliki harga, barcode, dan stok sendiri.</p></div>
                <button type="button" className="text-button" onClick={() => setForm((current) => ({ ...current, packages: [...(current.packages || []), { name: 'Dus', sku: '', barcode: '', price: '', wholesalePrice: '', purchasePrice: '', stock: '' }] }))}>+ Tambah kemasan</button>
              </div>
              <small className="tool-empty">Isi nama model kemasan, lalu bedakan harga jual, harga warung/grosir, modal beli, barcode, SKU, dan stoknya.</small>
              {(form.packages || []).map((packageForm, index) => (
                <div className="product-package-row" key={packageForm.id || index}>
                  <label><span>Model kemasan</span><input type="text" placeholder="Dus / Pak / Slop" value={packageForm.name ?? ''} onChange={(event) => setForm((current) => ({ ...current, packages: current.packages.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} /></label>
                  <label><span>SKU kemasan</span><input type="text" placeholder="Kode SKU khusus kemasan" value={packageForm.sku ?? ''} onChange={(event) => setForm((current) => ({ ...current, packages: current.packages.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item) }))} /></label>
                  <label><span>Barcode kemasan</span><input type="text" placeholder="Barcode pada dus/pak" value={packageForm.barcode ?? ''} onChange={(event) => setForm((current) => ({ ...current, packages: current.packages.map((item, itemIndex) => itemIndex === index ? { ...item, barcode: event.target.value } : item) }))} /></label>
                  <label><span>Harga jual pelanggan</span><CurrencyInput value={packageForm.price ?? ''} placeholder="Rp 0" onValueChange={(value) => setForm((current) => ({ ...current, packages: current.packages.map((item, itemIndex) => itemIndex === index ? { ...item, price: value } : item) }))} /></label>
                  <label><span>Harga warung / grosir</span><CurrencyInput value={packageForm.wholesalePrice ?? ''} placeholder="Rp 0" onValueChange={(value) => setForm((current) => ({ ...current, packages: current.packages.map((item, itemIndex) => itemIndex === index ? { ...item, wholesalePrice: value } : item) }))} /></label>
                  <label><span>Harga beli / modal</span><CurrencyInput value={packageForm.purchasePrice ?? ''} placeholder="Rp 0" onValueChange={(value) => setForm((current) => ({ ...current, packages: current.packages.map((item, itemIndex) => itemIndex === index ? { ...item, purchasePrice: value } : item) }))} /></label>
                  <label><span>Stok kemasan</span><input type="number" min="0" placeholder="0" value={packageForm.stock ?? ''} onChange={(event) => setForm((current) => ({ ...current, packages: current.packages.map((item, itemIndex) => itemIndex === index ? { ...item, stock: event.target.value } : item) }))} /></label>
                  <button type="button" className="text-button" onClick={() => setForm((current) => ({ ...current, packages: current.packages.filter((_, itemIndex) => itemIndex !== index) }))}>Hapus</button>
                </div>
              ))}
            </section>

            <label className="quick-access-toggle"><input type="checkbox" checked={Boolean(form.isQuickAccess)} onChange={(event) => setForm((current) => ({ ...current, isQuickAccess: event.target.checked }))} /><span><strong>Tampilkan sebagai tombol cepat di Kasir</strong><small>Untuk barang yang sering dijual tanpa perlu mencari.</small></span></label>

            <button className="btn btn-primary full" type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah produk'}
            </button>
          </form>

          {editingId && <section className="product-audit-panel"><div className="panel-heading"><div><span className="panel-kicker">Kontrol perubahan</span><h2>Riwayat Perubahan</h2></div><span className="tool-count">{auditLogs.length} catatan</span></div>{auditLogs.length ? <div className="product-audit-list">{auditLogs.map((log) => <div className="product-audit-row" key={log.id}><strong>{log.field}</strong><span>{log.oldValue || '-'} → {log.newValue || '-'}</span><small>{log.changedBy?.name || 'User'} · {new Date(log.createdAt).toLocaleString('id-ID')}</small></div>)}</div> : <p className="tool-empty">Belum ada perubahan harga atau stok yang tercatat.</p>}</section>}

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
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter kategori">
                <option>Semua</option>
                {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Urutkan produk">
                <option value="newest">Terbaru ditambahkan</option>
                <option value="nameAsc">Nama A-Z</option>
                <option value="nameDesc">Nama Z-A</option>
                <option value="categoryAsc">Kategori A-Z</option>
                <option value="categoryDesc">Kategori Z-A</option>
                <option value="priceAsc">Harga terendah</option>
                <option value="priceDesc">Harga tertinggi</option>
                <option value="stockAsc">Stok terendah</option>
                <option value="stockDesc">Stok tertinggi</option>
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
