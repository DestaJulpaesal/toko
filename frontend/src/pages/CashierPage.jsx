import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { playBeep } from '../utils/barcodeUtils';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

// Hitung poin loyalitas:
// - Minimal 100rb dapat 10 poin (setiap kelipatan 100rb = 10 poin)
// - Minimal 50rb dapat 2 poin (sisa >= 50rb = +2 poin)
export const calculateEarnedPoints = (total) => {
  const amount = Number(total) || 0;
  if (amount < 50000) return 0;
  const ratusan = Math.floor(amount / 100000);
  const sisa = amount % 100000;
  const bonusSisa = sisa >= 50000 ? 2 : 0;
  return ratusan * 10 + bonusSisa;
};

// Daftar Promo Campaign Aktif
export const availablePromos = [
  { id: 'none', name: 'Tanpa Promo', code: '', type: 'NONE', value: 0, tag: 'NORMAL' },
  { id: 'promo-lebaran', name: 'Promo Lebaran', code: 'LEBARAN15', type: 'PERCENT', value: 15, tag: '15% OFF', desc: 'Diskon spesial momen Lebaran 15%' },
  { id: 'promo-glosir10', name: 'Glosir Hemat 10', code: 'GLOSIR10', type: 'PERCENT', value: 10, tag: '10% OFF', desc: 'Diskon 10% belanja hemat sembako' },
  { id: 'promo-hemat25', name: 'Hemat 25 Ribu', code: 'HEMAT25', type: 'FIXED', value: 25000, tag: 'POTONGAN 25RB', desc: 'Potongan langsung Rp 25.000' },
];

const storeBankAccounts = [
  { bank: 'BCA', number: '8830-1234-5678', name: 'Toko Glosir', color: '#005baa' },
  { bank: 'Mandiri', number: '137-00-9876543-2', name: 'Toko Glosir', color: '#e69800' },
  { bank: 'BRI', number: '0123-01-001234-53-1', name: 'Toko Glosir', color: '#00529c' },
];

export default function CashierPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerEnabled, setCustomerEnabled] = useState(false);
  const [customerType, setCustomerType] = useState('RETAIL');

  // Cart & Catalog states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [items, setItems] = useState([]);

  // Promo Campaign state
  const [selectedPromoId, setSelectedPromoId] = useState('none');

  // Payment states
  const [paymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');

  // General UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  // Completed receipt modal
  const [completedOrder, setCompletedOrder] = useState(null);

  // Barcode Scanner Modal State
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanInputRef = useRef(null);

  // Load products & customers
  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes] = await Promise.all([
        apiFetch('/products').then((r) => r.json()).catch(() => null),
      ]);

      if (prodRes?.success && Array.isArray(prodRes.products)) {
        setProducts(prodRes.products.filter((p) => p.stock > 0 || p.stock === undefined));
      } else {
        setProducts([]);
        setNotice(prodRes?.message || 'Produk tidak bisa dimuat dari database.');
      }

      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // Compute categories
  const categories = useMemo(() => {
    const list = ['Semua', ...new Set(products.map((p) => p.category).filter(Boolean))];
    return list;
  }, [products]);

  const getSellingPrice = (product) => customerType === 'WHOLESALE' && Number(product.wholesalePrice) > 0
    ? Number(product.wholesalePrice)
    : Number(product.price || 0);

  useEffect(() => {
    setItems((current) => current.map((item) => ({ ...item, price: getSellingPrice(item) })));
  }, [customerType]);

  // Selected customer object
  const activeCustomer = useMemo(() => {
    if (!customerEnabled) return null;
    if (selectedCustomerId && selectedCustomerId !== 'NEW') {
      return customers.find((c) => c.id === selectedCustomerId) || null;
    }
    if (selectedCustomerId === 'NEW' && customCustomerName.trim()) {
      return { name: customCustomerName.trim(), points: 0 };
    }
    return { name: 'Pelanggan Umum', points: 0 };
  }, [customerEnabled, selectedCustomerId, customCustomerName, customers]);

  // Active Promo
  const activePromo = useMemo(() => {
    return availablePromos.find((p) => p.id === selectedPromoId) || availablePromos[0];
  }, [selectedPromoId]);

  // Subtotal from items
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0),
    [items]
  );

  // Promo Discount Calculation
  const promoDiscount = useMemo(() => {
    if (!activePromo || activePromo.type === 'NONE' || subtotal === 0) return 0;
    if (activePromo.type === 'PERCENT') {
      return Math.round((subtotal * activePromo.value) / 100);
    }
    if (activePromo.type === 'FIXED') {
      return Math.min(activePromo.value, subtotal);
    }
    return 0;
  }, [activePromo, subtotal]);

  // Total discounts combined
  const totalDiscount = promoDiscount;

  // Final Total to pay
  const finalTotal = Math.max(subtotal - totalDiscount, 0);

  const earnedPoints = 0;

  // Gamified progress to next point tier
  const nextPointProgress = useMemo(() => {
    if (finalTotal <= 0) {
      return {
        status: 'empty',
        title: 'Mulai Kumpulkan Poin',
        message: 'Belanja minimal Rp 50.000 untuk dapatkan 2 Poin pertama!',
        percent: 0,
        badge: '0 Poin',
      };
    }
    if (finalTotal < 50000) {
      const remaining = 50000 - finalTotal;
      const pct = Math.min(Math.round((finalTotal / 50000) * 100), 100);
      return {
        status: 'tier-0',
        title: 'Tinggal Sedikit Lagi!',
        message: `Tambah belanja ${formatMoney(remaining)} lagi untuk dapatkan 2 Poin pertama! ✨`,
        percent: pct,
        badge: 'Target 50rb',
      };
    }
    if (finalTotal < 100000) {
      const remaining = 100000 - finalTotal;
      const pct = Math.min(Math.round(((finalTotal - 50000) / 50000) * 100), 100);
      return {
        status: 'tier-50',
        title: '🎉 Kamu Mendapat +2 Poin!',
        message: `Tinggal tambah ${formatMoney(remaining)} lagi untuk langsung tembus 10 Poin! 🚀`,
        percent: pct,
        badge: '+2 Poin Aktif',
      };
    }
    const sisa = finalTotal % 100000;
    const ratusan = Math.floor(finalTotal / 100000);
    if (sisa < 50000) {
      const toNext50 = 50000 - sisa;
      return {
        status: 'tier-100',
        title: `🔥 Mantap! Kamu Dapat +${ratusan * 10} Poin!`,
        message: `Tambah ${formatMoney(toNext50)} lagi untuk dapat bonus +2 Poin tambahan!`,
        percent: Math.round((sisa / 50000) * 100),
        badge: `+${ratusan * 10} Poin`,
      };
    } else {
      const toNext100 = 100000 - sisa;
      return {
        status: 'tier-100-plus',
        title: `⭐ Luar Biasa! Kamu Dapat +${ratusan * 10 + 2} Poin!`,
        message: `Tambah ${formatMoney(toNext100)} lagi untuk naik ke +${(ratusan + 1) * 10} Poin!`,
        percent: Math.round(((sisa - 50000) / 50000) * 100),
        badge: `+${ratusan * 10 + 2} Poin`,
      };
    }
  }, [finalTotal]);

  // Effective amount paid
  const effectivePaid = useMemo(() => {
    return Number(paidAmount) || 0;
  }, [paidAmount]);

  const change = effectivePaid - finalTotal;

  // Filtered products
  const filteredProducts = products.filter((product) => {
    const q = search.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(q) ||
      (product.sku && product.sku.toLowerCase().includes(q));
    const matchesCat = categoryFilter === 'Semua' || product.category === categoryFilter;
    return matchesSearch && matchesCat;
  });
  const quickAccessProducts = products.filter((product) => product.isQuickAccess && Number(product.stock ?? 1) > 0);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(q) ||
      (customer.phone && customer.phone.toLowerCase().includes(q)) ||
      (customer.email && customer.email.toLowerCase().includes(q))
    );
  }, [customerSearch, customers]);

  const addProduct = (product) => {
    const availableStock = Number(product.stock ?? 999);
    if (availableStock <= 0) {
      setNotice(`Stok ${product.name} sudah habis, tidak bisa ditambahkan ke keranjang.`);
      return;
    }

    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      const maxStock = product.stock !== undefined ? product.stock : 999;
      if (existing) {
        const nextQty = Math.min(existing.qty + 1, maxStock);
        if (nextQty <= existing.qty) {
          setNotice(`Stok ${product.name} sudah maksimal di keranjang.`);
          return current;
        }
        return current.map((item) =>
          item.id === product.id ? { ...item, qty: nextQty } : item
        );
      }
      return [...current, { ...product, price: getSellingPrice(product), qty: 1 }];
    });
  };

  const handleBarcodeScanned = (scannedCode) => {
    const clean = String(scannedCode || '').trim().toLowerCase();
    const product = products.find(
          (p) => String(p.barcode || '').trim().toLowerCase() === clean ||
            String(p.sku || '').trim().toLowerCase() === clean ||
             p.name.toLowerCase().includes(clean)
    );

    if (product) {
      addProduct(product);
      playBeep(1500, 0.12);
      setNotice(`✓ Berhasil scan ${product.name}! (+1 ke keranjang)`);
    } else {
      setNotice(`Barcode "${scannedCode}" tidak ditemukan di katalog produk.`);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = search.trim().toLowerCase();
      if (!q) return;

      const exact = products.find(
         (p) => String(p.barcode || '').trim().toLowerCase() === q ||
           String(p.sku || '').trim().toLowerCase() === q ||
               p.name.toLowerCase() === q
      ) || (filteredProducts.length === 1 ? filteredProducts[0] : null);

      if (exact) {
        addProduct(exact);
        playBeep(1500, 0.1);
        setNotice(`✓ Berhasil scan ${exact.name}! (+1 ke keranjang)`);
        setSearch('');
      } else if (filteredProducts.length > 0) {
        addProduct(filteredProducts[0]);
        playBeep(1500, 0.1);
        setNotice(`✓ Menambahkan ${filteredProducts[0].name}!`);
        setSearch('');
      } else {
        setNotice(`Barang dengan barcode/nama "${search}" tidak ditemukan.`);
      }
    }
  };

  const changeQty = (id, qty) => {
    if (qty < 1) {
      removeItem(id);
      return;
    }

    setItems((current) =>
      current.map((item) => {
            if (item.id === id) {
              const maxStock = item.stock !== undefined ? item.stock : 999;
              return { ...item, qty: Math.min(qty, maxStock) };
            }
            return item;
          })
    );
  };

  const removeItem = async (id) => {
    const item = items.find((currentItem) => currentItem.id === id);
    if (!await confirmAction(`Hapus "${item?.name || 'barang ini'}" dari keranjang?`)) return;
    setItems((current) => current.filter((currentItem) => currentItem.id !== id));
    setNotice(`${item?.name || 'Barang'} dihapus dari keranjang.`);
  };

  const clearCart = async () => {
    if (!await confirmAction('Kosongkan semua barang dari keranjang kasir?')) return;
    setItems([]);
    setNotice('Keranjang berhasil dikosongkan.');
  };

  const setQuickCash = (amount) => {
    setPaidAmount(String(amount));
  };

  const handleCopyAccount = (number, bank) => {
    navigator.clipboard.writeText(number.replace(/-/g, ''));
    setCopiedBank(bank);
    setTimeout(() => setCopiedBank(''), 2500);
  };

  // Complete Transaction
  const completeTransaction = async () => {
    if (!items.length) {
      setNotice('Keranjang belanja masih kosong.');
      return;
    }

    if (paymentMethod === 'CASH' && effectivePaid < finalTotal) {
      setNotice('Jumlah uang tunai yang diterima kurang dari total tagihan.');
      return;
    }

    const averageResponse = await apiFetch('/orders/average-transaction');
    const averageData = await averageResponse.json().catch(() => ({}));
    if (averageData.success && averageData.average > 0 && finalTotal > averageData.average * 5) {
      const proceed = await confirmAction(`Nominal ini jauh lebih besar dari biasanya. Rata-rata 30 hari: ${formatMoney(averageData.average)}. Tetap lanjutkan?`);
      if (!proceed) return;
    }
    if (!await confirmAction(`Yakin menyelesaikan transaksi sebesar ${formatMoney(finalTotal)}?`)) return;

    setSaving(true);
    setNotice('');

    const payload = {
      items: items.map((item) => ({
        variantId: item.variantId || item.id,
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
      })),
      paidAmount: effectivePaid,
      paymentMethod,
      customerType,
      paymentReference: null,
      customerId: selectedCustomerId && selectedCustomerId !== 'NEW' ? selectedCustomerId : null,
      customerName: activeCustomer?.name || null,
      cashierName: 'Kasir Glosir',
      discount: totalDiscount,
      promoName: activePromo.id !== 'none' ? activePromo.name : null,
      promoDiscount,
    };

    try {
      const response = await apiFetch('/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Transaksi gagal diproses.');
      }

      const previousCustomerPoints = 0;
      const currentCustomerPoints = 0;

      const receipt = {
        orderNumber: data.orderNumber || `POS-${Date.now()}`,
        items: [...items],
        subtotal,
        promoName: activePromo.id !== 'none' ? activePromo.name : null,
        promoDiscount,
        pointDiscount: 0,
        discount: totalDiscount,
        total: finalTotal,
        paidAmount: effectivePaid,
        change: Math.max(effectivePaid - finalTotal, 0),
        paymentMethod,
        paymentReference: null,
        customer: activeCustomer,
        cashierName: 'Kasir Glosir',
        earnedPoints,
        previousPoints: previousCustomerPoints,
        currentPoints: currentCustomerPoints,
        createdAt: new Date().toISOString(),
      };

      setCompletedOrder(receipt);

      // Update customer list points locally
      // Decrement stock
      setProducts((current) =>
        current.map((product) => {
          const sold = items.find((item) => item.id === product.id);
          return sold ? { ...product, stock: Math.max((product.stock || 0) - sold.qty, 0) } : product;
        })
      );
    } catch (error) {
      console.warn('Checkout offline, using simulated receipt:', error.message);

      const previousCustomerPoints = 0;
      const currentCustomerPoints = 0;

      const receipt = {
        orderNumber: `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        items: [...items],
        subtotal,
        promoName: activePromo.id !== 'none' ? activePromo.name : null,
        promoDiscount,
        pointDiscount: 0,
        discount: totalDiscount,
        total: finalTotal,
        paidAmount: effectivePaid,
        change: Math.max(effectivePaid - finalTotal, 0),
        paymentMethod,
        paymentReference: null,
        customer: activeCustomer,
        cashierName: 'Kasir Glosir',
        earnedPoints,
        previousPoints: previousCustomerPoints,
        currentPoints: currentCustomerPoints,
        createdAt: new Date().toISOString(),
      };

      setCompletedOrder(receipt);
    } finally {
      setSaving(false);
    }
  };

  const handleResetForNewOrder = () => {
    setItems([]);
    setPaidAmount('');
    setCustomerEnabled(false);
    setSelectedCustomerId('');
    setCustomCustomerName('');
    setSelectedPromoId('none');
    setCustomerType('RETAIL');
    setCompletedOrder(null);
  };

  const handleShareWhatsApp = (order) => {
    const itemsList = (order.items || [])
      .map(
        (it) =>
          `• ${it.name} (${it.qty || it.quantity}x) = ${formatMoney(
            (it.price || it.unitPrice) * (it.qty || it.quantity)
          )}`
      )
      .join('\n');

    const methodLabels = {
      CASH: 'Tunai (Cash)',
      QRIS: 'QRIS',
      TRANSFER: 'Transfer Bank',
    };

    const text =
      `*STRUK PEMBELIAN RESMI GLOSIR*\n` +
      `No. Faktur: ${order.orderNumber}\n` +
      `Tanggal: ${new Date(order.createdAt).toLocaleString('id-ID')}\n` +
      (order.customer?.name ? `Pelanggan: ${order.customer.name}\n` : '') +
      `--------------------------------\n` +
      `${itemsList}\n` +
      `--------------------------------\n` +
      `Subtotal: ${formatMoney(order.subtotal)}\n` +
      (order.promoDiscount > 0 ? `Diskon Promo (${order.promoName}): -${formatMoney(order.promoDiscount)}\n` : '') +
      `*TOTAL BELANJA: ${formatMoney(order.total)}*\n` +
      `Metode: ${methodLabels[order.paymentMethod] || order.paymentMethod}\n` +
      (order.paymentReference ? `Keterangan: ${order.paymentReference}\n` : '') +
      `Status: LUNAS\n` +
      `================================\n` +
      `*★ PROGRAM POIN MEMBER GLOSIR ★*\n` +
      `Poin Transaksi Ini: +${order.earnedPoints} Poin\n` +
      (order.redeemedPoints > 0 ? `Poin Ditukar: -${order.redeemedPoints} Poin\n` : '') +
      `Total Saldo Poin: ⭐ ${order.currentPoints} Poin ⭐\n` +
      `--------------------------------\n` +
      `💡 TIPS HEMAT MEMBER:\n` +
      `• Belanja ≥ 100rb = 10 Poin\n` +
      `• Belanja ≥ 50rb  = 2 Poin\n` +
      `Tukarkan 10 Poin = Diskon Rp 5.000 di kasir!\n` +
      `Terima kasih telah berbelanja di Glosir 💚`;

    const phone = order.customer?.phone
      ? order.customer.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')
      : '';

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Kasir" />

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcodeScanned}
      />

      <main className="admin-main cashier-main-clean">
        {/* Compact, Modern Header */}
        <header className="pos-topbar-header">
          <div className="pos-title-block">
            <div className="pos-badge-row">
              <span className="pos-badge-live">● POS Online</span>
              <span className="pos-badge-points">
                ⭐ Promo & Poin: Belanja ≥ 100rb = 10 Poin | ≥ 50rb = 2 Poin
              </span>
            </div>
            <h1>Kasir Toko (POS)</h1>
            <p>Pilih produk, terapkan promo Lebaran/voucher, kumpulkan poin member, dan selesaikan transaksi.</p>
          </div>

          <div className="pos-header-actions">
            <Link to="/kasir/riwayat" className="btn-pos-history">
              <span>📋</span> Riwayat Transaksi
            </Link>
          </div>
        </header>

        {notice && (
          <div className="crud-notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button>
          </div>
        )}

        {/* 2-Column POS Layout */}
        <section className="pos-grid-container">
          {/* SISI KIRI: Katalog Produk */}
          <section className="pos-catalog-panel">
            {/* Toolbar Search & Kategori */}
            {quickAccessProducts.length > 0 && <section className="cashier-quick-access"><div><span className="panel-kicker">Akses cepat</span><strong>Barang favorit</strong><small>Tekan sekali untuk memasukkan ke keranjang</small></div><div className="cashier-quick-grid">{quickAccessProducts.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)}><strong>{product.name}</strong><small>{formatMoney(getSellingPrice(product))}</small></button>)}</div></section>}
            <div className="pos-search-bar">
              <span className="search-icon">🔍</span>
              <input
                      ref={scanInputRef}
                      value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan barcode gun / cari nama atau SKU... (Tekan Enter)"
              />
              {search && (
                <button className="clear-search-btn" onClick={() => setSearch('')}>
                  ×
                </button>
              )}
              <button
                type="button"
                className="pos-scan-cam-btn"
                onClick={() => setScannerOpen(true)}
                title="Buka kamera untuk scan barcode kemasan barang"
              >
                📷 Scan Barcode
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="pos-category-scroll">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`pos-cat-chip ${categoryFilter === cat ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Cards Grid */}
            <div className="pos-products-grid">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="pos-product-card"
                  onClick={() => addProduct(product)}
                >
                  <div className="pos-card-top">
                    <span className="pos-cat-tag">{product.category || 'Glosir'}</span>
                    <span className={`pos-stock-pill ${(product.stock || 0) <= 5 ? 'low' : ''}`}>
                      Stok: {product.stock !== undefined ? product.stock : 'Tersedia'}
                    </span>
                  </div>

                  <div className="pos-card-body">
                    <strong className="pos-product-name">{product.name}</strong>
                    <small className="pos-product-sku">{product.sku}</small>
                  </div>

                  <div className="pos-card-bottom">
                    <b className="pos-product-price">{formatMoney(getSellingPrice(product))}</b>
                    {customerType === 'WHOLESALE' && Number(product.wholesalePrice) > 0 && <small className="pos-wholesale-hint">Harga warung</small>}
                    <button className="pos-btn-add" title="Tambah ke keranjang">
                      + Tambah
                    </button>
                  </div>
                </div>
              ))}

              {!loading && !filteredProducts.length && (
                <div className="table-empty" style={{ gridColumn: '1 / -1', padding: '50px 20px' }}>
                  Tidak ada produk yang cocok dengan pencarian "{search}".
                </div>
              )}
            </div>
          </section>

          {/* SISI KANAN: Keranjang, Poin, & Pembayaran */}
          <aside className="pos-cart-panel">
            <div className="pos-cart-header">
              <div>
                <h2>Keranjang Kasir</h2>
                <span className="cart-item-count">{items.length} macam produk</span>
              </div>
              {items.length > 0 && (
                <button
                  className="btn-clear-cart"
                  onClick={clearCart}
                  title="Kosongkan keranjang"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {/* Pilih tipe harga tanpa perlu mengisi data pelanggan. */}
            <div className="pos-customer-box">
              <label className="redeem-checkbox-label">
                <input
                  type="checkbox"
                  checked={customerEnabled}
                  onChange={(event) => {
                    setCustomerEnabled(event.target.checked);
                    if (!event.target.checked) {
                      setSelectedCustomerId('');
                      setCustomCustomerName('');
                      setCustomerSearch('');
                    }
                  }}
                />
                <span>Tambahkan pelanggan/member (opsional)</span>
              </label>
              {customerEnabled && (
                <>
                  <input className="pos-custom-name-input" placeholder="Cari nama / nomor HP member..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                  <select className="pos-cust-select" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                    <option value="">Pilih pelanggan umum</option>
                    {filteredCustomers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.points ? `(⭐ ${c.points} Poin)` : ''}</option>)}
                    <option value="NEW">+ Input Nama Pembeli Baru...</option>
                  </select>
                  {selectedCustomerId === 'NEW' && <input className="pos-custom-name-input" placeholder="Ketik nama pelanggan..." value={customCustomerName} onChange={(e) => setCustomCustomerName(e.target.value)} />}
                </>
              )}
              <div className="pos-cust-row">
                <span className="pos-field-label">Tipe harga:</span>
                <div className="seg-control compact">
                  <button type="button" className={customerType === 'RETAIL' ? 'active' : ''} onClick={() => setCustomerType('RETAIL')}>Pribadi / Eceran</button>
                  <button type="button" className={customerType === 'WHOLESALE' ? 'active' : ''} onClick={() => setCustomerType('WHOLESALE')}>Warung</button>
                </div>
              </div>
            </div>

            {/* 2. Pemilih Promo Toko / Voucher Campaign */}
            <div className="pos-promo-selector-box">
              <div className="pos-cust-row">
                <span className="pos-field-label">🎉 Promo / Voucher Toko:</span>
                {activePromo.id !== 'none' && (
                  <span className="pos-promo-active-tag">{activePromo.tag}</span>
                )}
              </div>

              <select
                className="pos-promo-select"
                value={selectedPromoId}
                onChange={(e) => setSelectedPromoId(e.target.value)}
              >
                {availablePromos.map((promo) => (
                  <option key={promo.id} value={promo.id}>
                    {promo.name} {promo.code ? `(${promo.code} - ${promo.type === 'PERCENT' ? `${promo.value}%` : formatMoney(promo.value)})` : ''}
                  </option>
                ))}
              </select>
              {activePromo.id !== 'none' && (
                <small className="pos-promo-desc-hint">✓ {activePromo.desc}</small>
              )}
            </div>

            {/* Daftar Barang di Keranjang */}
            <div className="pos-cart-items-scroll">
              {items.length ? (
                items.map((item) => (
                  <div className="pos-cart-item-row" key={item.id}>
                    <div className="cart-item-info">
                      <strong>{item.name}</strong>
                      <small>
                        {formatMoney(item.price)} × {item.qty}
                      </small>
                    </div>

                    <div className="cart-item-actions">
                      <div className="cart-qty-buttons">
                        <button onClick={() => changeQty(item.id, item.qty - 1)}>-</button>
                        <span>{item.qty}</span>
                        <button onClick={() => changeQty(item.id, item.qty + 1)}>+</button>
                      </div>
                      <b className="cart-item-subtotal">{formatMoney(item.price * item.qty)}</b>
                      <button
                        className="cart-delete-btn"
                        onClick={() => removeItem(item.id)}
                        title="Hapus barang"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="pos-cart-empty">
                  <span className="empty-cart-icon">🛒</span>
                  <strong>Keranjang Masih Kosong</strong>
                  <p>Klik produk di sebelah kiri untuk menambahkan barang belanjaan.</p>
                </div>
              )}
            </div>

            {/* Rincian Subtotal, Diskon, Poin, dan Total */}
            {items.length > 0 && (
              <div className="pos-totals-container">
                <div className="pos-price-lines">
                  <div className="price-line">
                    <span>Subtotal:</span>
                    <span>{formatMoney(subtotal)}</span>
                  </div>

                  {promoDiscount > 0 && (
                    <div className="price-line discount-line">
                      <span>Diskon Promo ({activePromo.name}):</span>
                      <span>-{formatMoney(promoDiscount)}</span>
                    </div>
                  )}

                  <div className="price-line grand-total-line">
                    <strong>TOTAL BELANJA:</strong>
                    <strong>{formatMoney(finalTotal)}</strong>
                  </div>
                </div>

                {/* Pembayaran tunai */}
                <div className="pos-payment-selector">
                  <span className="payment-label-text">Metode Pembayaran:</span>
                  <strong>💵 Tunai / Cash</strong>
                </div>

                {/* DETAIL: 1. TUNAI */}
                {paymentMethod === 'CASH' && (
                  <div className="pos-method-detail cash-box">
                    <label className="pos-input-label">
                      <span>Uang Diterima dari Pembeli:</span>
                      <CurrencyInput value={paidAmount} onValueChange={setPaidAmount} placeholder="Contoh: Rp 100.000" />
                    </label>

                    {/* Quick Cash Chips */}
                    <div className="quick-cash-chips">
                      <button type="button" onClick={() => setQuickCash(finalTotal)}>
                        Uang Pas
                      </button>
                      {[20000, 50000, 100000, 200000, 500000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setQuickCash(amt)}
                          disabled={amt < finalTotal}
                        >
                          {amt >= 1000 ? `${amt / 1000}rb` : amt}
                        </button>
                      ))}
                    </div>

                    <div className={`pos-change-box ${change >= 0 ? 'valid' : 'invalid'}`}>
                      <span>Kembalian:</span>
                      <strong>{change >= 0 ? formatMoney(change) : 'Uang Kurang'}</strong>
                    </div>

                    <button
                      className="btn-finish-pay btn-cash-pay"
                      disabled={saving || effectivePaid < finalTotal}
                      onClick={completeTransaction}
                    >
                      {saving ? 'Menyimpan Transaksi...' : `Bayar Tunai ${formatMoney(finalTotal)}`}
                    </button>
                  </div>
                )}

                {/* QRIS dan transfer dinonaktifkan sementara; kasir menggunakan tunai. */}
                {false && paymentMethod === 'QRIS' && (
                  <div className="pos-method-detail qris-box">
                    <div className="qris-card-visual-clean">
                      <div className="qris-card-header-clean">
                        <span className="qris-logo-clean">QRIS</span>
                        <span className="qris-sub-clean">PEMBAYARAN DIGITAL NASIONAL</span>
                      </div>

                      <div className="qris-merchant-clean">
                        <strong>GLOSIR TOKO & SEMBAKO</strong>
                        <small>NMID: ID1020304050607</small>
                      </div>

                      {/* Barcode SVG */}
                      <div className="qris-qr-container">
                        <svg viewBox="0 0 100 100" className="qris-qr-svg">
                          <rect width="100" height="100" fill="#ffffff" />
                          <rect x="8" y="8" width="28" height="28" fill="#000" />
                          <rect x="13" y="13" width="18" height="18" fill="#fff" />
                          <rect x="17" y="17" width="10" height="10" fill="#000" />
                          <rect x="64" y="8" width="28" height="28" fill="#000" />
                          <rect x="69" y="13" width="18" height="18" fill="#fff" />
                          <rect x="73" y="17" width="10" height="10" fill="#000" />
                          <rect x="8" y="64" width="28" height="28" fill="#000" />
                          <rect x="13" y="69" width="18" height="18" fill="#fff" />
                          <rect x="17" y="73" width="10" height="10" fill="#000" />
                          <rect x="42" y="12" width="6" height="8" fill="#000" />
                          <rect x="52" y="18" width="6" height="6" fill="#000" />
                          <rect x="40" y="30" width="20" height="6" fill="#000" />
                          <rect x="64" y="44" width="10" height="8" fill="#000" />
                          <rect x="42" y="54" width="16" height="16" fill="#1b6336" />
                          <rect x="64" y="64" width="12" height="6" fill="#000" />
                          <rect x="80" y="74" width="12" height="16" fill="#000" />
                          <rect x="44" y="76" width="14" height="14" fill="#000" />
                          <circle cx="50" cy="50" r="9" fill="#f0ba3f" />
                          <text x="50" y="54" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#14251e">
                            G
                          </text>
                        </svg>
                      </div>

                      <div className="qris-exact-amount">
                        <span>Nominal Pas Bayar:</span>
                        <strong>{formatMoney(finalTotal)}</strong>
                      </div>
                    </div>

                    <div className="pos-guide-note">
                      💡 Minta pelanggan scan kode QRIS di atas dengan aplikasi apa saja (BCA, Mandiri, BRImo, GoPay, Dana, OVO, ShopeePay).
                    </div>

                    <label className="pos-input-label">
                      <span>No. Referensi / RRN Bukti Bayar (Opsional):</span>
                      <input
                        placeholder="Contoh: RRN-9928314..."
                        value={qrisReference}
                        onChange={(e) => setQrisReference(e.target.value)}
                      />
                    </label>

                    <button
                      className="btn-finish-pay btn-qris-pay"
                      disabled={saving}
                      onClick={completeTransaction}
                    >
                      {saving ? 'Memverifikasi Transaksi...' : `📱 Konfirmasi QRIS Lunas & Cetak Struk`}
                    </button>
                  </div>
                )}

                {/* DETAIL: 3. TRANSFER */}
                {false && paymentMethod === 'TRANSFER' && (
                  <div className="pos-method-detail transfer-box">
                    <span className="pos-sub-title">Nomor Rekening Toko Glosir:</span>
                    <div className="pos-bank-list">
                      {storeBankAccounts.map((acc) => (
                        <div key={acc.bank} className="pos-bank-item">
                          <span className="bank-pill" style={{ background: acc.color }}>
                            {acc.bank}
                          </span>
                          <div className="bank-text">
                            <strong>{acc.number}</strong>
                            <small>a.n. {acc.name}</small>
                          </div>
                          <button
                            type="button"
                            className="btn-copy-chip"
                            onClick={() => handleCopyAccount(acc.number, acc.bank)}
                          >
                            {copiedBank === acc.bank ? '✓ Disalin' : 'Salin'}
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="form-two-columns" style={{ marginTop: '8px' }}>
                      <label className="pos-input-label">
                        <span>Bank Tujuan:</span>
                        <select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                        >
                          <option value="BCA">BCA (Toko Glosir)</option>
                          <option value="Mandiri">Mandiri (Toko Glosir)</option>
                          <option value="BRI">BRI (Toko Glosir)</option>
                        </select>
                      </label>

                      <label className="pos-input-label">
                        <span>Nama Pengirim: *</span>
                        <input
                          placeholder="Nama pemilik rekening..."
                          value={senderAccountName}
                          onChange={(e) => setSenderAccountName(e.target.value)}
                        />
                      </label>
                    </div>

                    <label className="pos-input-label">
                      <span>No. Referensi / Berita Transfer:</span>
                      <input
                        placeholder="Contoh: REF-88390..."
                        value={transferReference}
                        onChange={(e) => setTransferReference(e.target.value)}
                      />
                    </label>

                    <button
                      className="btn-finish-pay btn-transfer-pay"
                      disabled={saving}
                      onClick={completeTransaction}
                    >
                      {saving ? 'Memproses Transfer...' : `🏦 Konfirmasi Transfer Lunas (${formatMoney(finalTotal)})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </aside>
        </section>

        {/* MODAL STRUK DENGAN PROMO */}
        {completedOrder && (
          <div className="receipt-modal-backdrop" onClick={handleResetForNewOrder}>
            <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="receipt-modal-header no-print">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge-success-tick">✓</span>
                  <h3>Transaksi Tunai Berhasil</h3>
                </div>
                <button className="receipt-close-btn" onClick={handleResetForNewOrder}>
                  ×
                </button>
              </div>

              {/* Thermal Paper Receipt */}
              <div className="receipt-paper" id="printable-receipt">
                <div className="receipt-shop-head">
                  <h2>GLOSIR</h2>
                  <p>Grosir & Sembako Modern</p>
                  <small>Jl. Raya Glosir No. 88, Jawa Barat</small>
                  <small>WhatsApp: 0812-3456-7890</small>
                </div>

                <div className="receipt-divider-dash" />

                <div className="receipt-meta">
                  <div>
                    <span>No. Faktur:</span>
                    <strong>{completedOrder.orderNumber}</strong>
                  </div>
                  <div>
                    <span>Waktu:</span>
                    <span>{new Date(completedOrder.createdAt).toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span>Kasir:</span>
                    <span>{completedOrder.cashierName || 'Kasir Glosir'}</span>
                  </div>
                  {completedOrder.customer?.name && (
                    <div>
                      <span>Pelanggan:</span>
                      <strong>{completedOrder.customer.name}</strong>
                    </div>
                  )}
                </div>

                <div className="receipt-divider-dash" />

                <div className="receipt-items-list">
                  {completedOrder.items.map((it, idx) => (
                    <div key={idx} className="receipt-item-row">
                      <div className="receipt-item-title">
                        <strong>{it.name}</strong>
                        <span>
                          {it.qty || it.quantity} × {formatMoney(it.price || it.unitPrice)}
                        </span>
                      </div>
                      <div className="receipt-item-total">
                        <strong>
                          {formatMoney((it.price || it.unitPrice) * (it.qty || it.quantity))}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="receipt-divider-dash" />

                <div className="receipt-summary">
                  <div className="receipt-sum-row">
                    <span>Subtotal</span>
                    <span>{formatMoney(completedOrder.subtotal || completedOrder.total)}</span>
                  </div>

                  {completedOrder.promoDiscount > 0 && (
                    <div className="receipt-sum-row" style={{ color: '#c73d3d' }}>
                      <span>Diskon Promo ({completedOrder.promoName})</span>
                      <span>-{formatMoney(completedOrder.promoDiscount)}</span>
                    </div>
                  )}

                  {completedOrder.pointDiscount > 0 && (
                    <div className="receipt-sum-row" style={{ color: '#c73d3d' }}>
                      <span>Diskon Poin ({completedOrder.redeemedPoints} Pts)</span>
                      <span>-{formatMoney(completedOrder.pointDiscount)}</span>
                    </div>
                  )}

                  <div className="receipt-sum-row total-row">
                    <strong>TOTAL BELANJA</strong>
                    <strong>{formatMoney(completedOrder.total)}</strong>
                  </div>

                  <div className="receipt-sum-row">
                    <span>Metode Bayar</span>
                    <strong>
                      {completedOrder.paymentMethod === 'CASH' && '💵 Tunai (Cash)'}
                      {completedOrder.paymentMethod === 'QRIS' && '📱 QRIS'}
                      {completedOrder.paymentMethod === 'TRANSFER' && '🏦 Transfer Bank'}
                    </strong>
                  </div>

                  {completedOrder.paymentMethod === 'CASH' && (
                    <>
                      <div className="receipt-sum-row">
                        <span>Uang Diterima</span>
                        <span>{formatMoney(completedOrder.paidAmount)}</span>
                      </div>
                      <div className="receipt-sum-row">
                        <span>Kembalian</span>
                        <span>{formatMoney(completedOrder.change)}</span>
                      </div>
                    </>
                  )}

                  {completedOrder.paymentReference && (
                    <div className="receipt-sum-row">
                      <span>Keterangan</span>
                      <span style={{ fontSize: '0.7rem' }}>{completedOrder.paymentReference}</span>
                    </div>
                  )}

                  <div className="receipt-sum-row">
                    <span>Status</span>
                    <strong style={{ color: '#177d47' }}>LUNAS</strong>
                  </div>
                </div>

                {completedOrder.customer?.name && <>{/* BAGIAN RINCIAN POIN MEMBER DI STRUK (ELEGAN & MENARIK) */}
                <div className="receipt-divider-dash" /></>}

                {false && <div className="receipt-point-summary-box">
                  <div className="receipt-point-header">
                    <span>★ PROGRAM LOYALITAS MEMBER ★</span>
                  </div>

                  <div className="receipt-sum-row">
                    <span>Nama Member:</span>
                    <strong>{completedOrder.customer?.name || 'Pelanggan Umum'}</strong>
                  </div>
                  <div className="receipt-sum-row">
                    <span>Poin Sebelumnya:</span>
                    <span>{completedOrder.previousPoints || 0} Poin</span>
                  </div>
                  {completedOrder.redeemedPoints > 0 && (
                    <div className="receipt-sum-row" style={{ color: '#c73d3d' }}>
                      <span>Poin Ditukar:</span>
                      <span>-{completedOrder.redeemedPoints} Poin</span>
                    </div>
                  )}
                  <div className="receipt-sum-row" style={{ color: '#15803d', fontWeight: 'bold' }}>
                    <span>Poin Transaksi Ini:</span>
                    <span>+{completedOrder.earnedPoints} Poin</span>
                  </div>

                  <div className="receipt-sum-row total-points-highlight">
                    <strong>TOTAL SALDO POIN ANDA:</strong>
                    <strong>⭐ {completedOrder.currentPoints} POIN ⭐</strong>
                  </div>

                  <div className="receipt-point-tips">
                    <p>💡 TIPS HEMAT MEMBER:</p>
                    <small>• Belanja ≥ 100rb = 10 Poin | ≥ 50rb = 2 Poin</small>
                    <small>• Tukarkan 10 Poin = Potongan Rp 5.000 di kasir</small>
                    <small>Terima kasih telah setia berbelanja di Glosir!</small>
                  </div>
                </div>}

                <div className="receipt-divider-dash" />

                <div className="receipt-footer">
                  <p>*** TERIMA KASIH ATAS KUNJUNGAN ANDA ***</p>
                  <small>
                    Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan kecuali ada perjanjian.
                  </small>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="receipt-modal-actions no-print">
                <button className="btn btn-primary" onClick={() => window.print()}>
                  🖨️ Cetak Struk
                </button>
                <button
                  className="btn btn-light"
                  onClick={() => handleShareWhatsApp(completedOrder)}
                >
                  💬 Kirim Struk WA
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleResetForNewOrder}
                  style={{ marginLeft: 'auto' }}
                >
                  + Transaksi Baru
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
