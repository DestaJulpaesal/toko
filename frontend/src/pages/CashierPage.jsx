import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import CashierHelpModal from '../components/CashierHelpModal';
import ProductUnitPicker from '../components/ProductUnitPicker';
import StockAlertBadge from '../components/StockAlertBadge';
import { playBeep } from '../utils/barcodeUtils';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';
import { printReceipt } from '../utils/printReceipt';

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

export default function CashierPage() {
  const [products, setProducts] = useState([]);
  const [databaseCategories, setDatabaseCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [heldCarts, setHeldCarts] = useState([]);
  const [activeHoldId, setActiveHoldId] = useState(null);
  const [holdsLoading, setHoldsLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerEnabled, setCustomerEnabled] = useState(false);
  const [customerType, setCustomerType] = useState('RETAIL');

  // Cart & Catalog states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [items, setItems] = useState([]);
  const [selectedUnits, setSelectedUnits] = useState({}); // { productId: unit }

  // Promo Campaign state
  const [selectedPromoId, setSelectedPromoId] = useState('none');

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');

  // General UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [averageTransaction, setAverageTransaction] = useState(0);

  const refreshAverageTransaction = async () => {
    try {
      const response = await apiFetch('/orders/average-transaction', { silentNotify: true });
      const data = await response.json().catch(() => ({}));
      if (data.success && Number.isFinite(data.average)) setAverageTransaction(data.average);
    } catch {
      // Non-critical background refresh; keep whatever value we already have.
    }
  };

  // Mode Kasir Layar Penuh & Bantuan
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Completed receipt modal
  const [completedOrder, setCompletedOrder] = useState(null);
  const checkoutInFlightRef = useRef(false);

  // Barcode Scanner Modal State
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanInputRef = useRef(null);

  const loadHeldCarts = async () => {
    setHoldsLoading(true);
    try {
      const response = await apiFetch('/orders/holds');
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && Array.isArray(data.holds)) {
        setHeldCarts(data.holds);
      }
    } catch (error) {
      console.warn('Failed to load held carts:', error.message);
    } finally {
      setHoldsLoading(false);
    }
  };

  // Load products & customers
  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, categoryRes, customerRes] = await Promise.all([
        apiFetch('/products').then((r) => r.json()).catch(() => null),
        apiFetch('/categories').then((r) => r.json()).catch(() => null),
        apiFetch('/customers').then((r) => r.json()).catch(() => null),
      ]);

      if (prodRes?.success && Array.isArray(prodRes.products)) {
        const catalogProducts = prodRes.products.flatMap((product) => (product.variants?.length
          ? product.variants.map((variant) => ({
            ...product,
            id: variant.id,
            productId: product.id,
            variantId: variant.id,
            name: `${product.name} (${variant.name})`,
            sku: variant.sku || product.sku,
            barcode: variant.barcode,
            price: variant.price,
            wholesalePrice: variant.wholesalePrice,
<<<<<<< HEAD
            purchasePrice: variant.purchasePrice,
=======
>>>>>>> cbd8857 (push fitur notifikasi email)
            stock: variant.stock,
          }))
          : [product]));
        setProducts(catalogProducts.filter((p) => p.stock > 0 || p.stock === undefined));
      } else {
        setProducts([]);
        setNotice(prodRes?.message || 'Produk tidak bisa dimuat dari database.');
      }

      if (categoryRes?.success && Array.isArray(categoryRes.categories)) {
        setDatabaseCategories(categoryRes.categories.map((category) => category.name).filter(Boolean));
      }

      if (customerRes?.success && Array.isArray(customerRes.customers)) {
        setCustomers(customerRes.customers);
      } else if (customerRes?.message) {
        setNotice(customerRes.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const holdCurrentCart = async () => {
    if (!items.length) {
      setNotice('Keranjang belanja masih kosong.');
      return;
    }
    if (activeHoldId) {
      setNotice('Selesaikan atau batalkan cart yang sedang dilanjutkan sebelum menahan cart baru.');
      return;
    }

    const label = window.prompt('Nama atau catatan pembeli untuk cart ini:', activeCustomer?.name || '');
    if (label === null) return;

    try {
      const response = await apiFetch('/orders/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        silentNotify: true,
        body: JSON.stringify({
          items: items.map((item) => ({
            variantId: item.variantId || item.id,
            eventPackageId: item.eventPackageId,
            parcelId: item.parcelId,
            quantity: item.qty,
          })),
          customerId: selectedCustomerId && selectedCustomerId !== 'NEW' ? selectedCustomerId : null,
          customerName: activeCustomer?.name || (label.trim() || null),
          customerType,
          discount: totalDiscount,
          promoId: activePromo.id,
          note: label.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || 'Belanjaan gagal ditahan.');

      setHeldCarts((current) => [data.hold, ...current]);
      setItems([]);
      setPaidAmount('');
      setCustomerEnabled(false);
      setSelectedCustomerId('');
      setCustomCustomerName('');
      setCustomerSearch('');
      setSelectedPromoId('none');
      setCustomerType('RETAIL');
      setNotice(`Belanjaan ditahan${label.trim() ? ` dengan catatan "${label.trim()}"` : ''}.`);
    } catch (error) {
      setNotice(error.message);
    }
  };

  useEffect(() => {
    loadData();
    refreshAverageTransaction();
    loadHeldCarts();
  }, []);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, [fullscreenMode]);

  useEffect(() => {
    if (!fullscreenMode) return undefined;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [fullscreenMode]);

  const toggleFullscreen = async () => {
    try {
      if (!fullscreenMode) {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
        setFullscreenMode(true);
      } else {
        if (document.exitFullscreen && document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
        setFullscreenMode(false);
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err.message);
      setFullscreenMode((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && fullscreenMode) {
        setFullscreenMode(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setHelpModalOpen((prev) => !prev);
      } else if (e.key === 'F4') {
        e.preventDefault();
        holdCurrentCart();
      } else if (e.key === 'Escape' && fullscreenMode) {
        if (!scannerOpen && !completedOrder && !helpModalOpen) {
          toggleFullscreen();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fullscreenMode, scannerOpen, completedOrder, helpModalOpen, holdCurrentCart]);

  useEffect(() => {
    if (loading || scannerOpen || completedOrder) return undefined;

    const focusBarcodeInput = () => {
      const active = document.activeElement;
      const isEditing = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
      if (!isEditing || active === scanInputRef.current) {
        scanInputRef.current?.focus();
      }
    };

    focusBarcodeInput();
    window.addEventListener('focus', focusBarcodeInput);
    return () => window.removeEventListener('focus', focusBarcodeInput);
  }, [loading, scannerOpen, completedOrder]);

  // Compute categories
  const categories = useMemo(() => {
    const productCategories = products.map((p) => p.category).filter(Boolean);
    const list = ['Semua', ...new Set([...databaseCategories, ...productCategories])];
    return list;
  }, [databaseCategories, products]);

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

    // FASE 4: Check if product has units and if one is selected
    const unit = selectedUnits[product.productId || product.id];
    if (!unit) {
      setNotice(`Pilih unit untuk ${product.name} terlebih dahulu.`);
      return;
    }

    setItems((current) => {
      const existing = current.find((item) => item.id === product.id && item.unitId === unit.id);
      const maxStock = product.stock !== undefined ? product.stock : 999;
      if (existing) {
        const nextQty = Math.min(existing.qty + 1, maxStock);
        if (nextQty <= existing.qty) {
          setNotice(`Stok ${product.name} sudah maksimal di keranjang.`);
          return current;
        }
        return current.map((item) =>
          item.id === product.id && item.unitId === unit.id ? { ...item, qty: nextQty } : item
        );
      }
      return [...current, {
        ...product,
        unitId: unit.id,
        unitName: unit.name,
        price: getSellingPrice(product),
        qty: 1,
        availableStock: unit.baseStockQty,
        minimumStock: unit.minimumStock,
        maximumStock: unit.maximumStock,
      }];
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
      window.requestAnimationFrame(() => scanInputRef.current?.focus());
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
        window.requestAnimationFrame(() => scanInputRef.current?.focus());
      } else if (filteredProducts.length > 0) {
        addProduct(filteredProducts[0]);
        playBeep(1500, 0.1);
        setNotice(`✓ Menambahkan ${filteredProducts[0].name}!`);
        setSearch('');
        window.requestAnimationFrame(() => scanInputRef.current?.focus());
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

  const resumeHeldCart = async (hold) => {
    if (items.length && !await confirmAction('Cart aktif akan diganti dengan belanjaan tertahan ini. Lanjutkan?')) return;

    setItems(hold.items.map((heldItem) => {
      const catalogItem = products.find((product) => product.id === heldItem.variantId) || {};
      return {
        ...catalogItem,
        id: heldItem.variantId || heldItem.id,
        variantId: heldItem.variantId || undefined,
        productId: heldItem.productId || catalogItem.productId,
        eventPackageId: heldItem.eventPackageId || undefined,
        parcelId: heldItem.parcelId || undefined,
        name: heldItem.name,
        sku: catalogItem.sku || '',
        price: heldItem.unitPrice,
        qty: heldItem.quantity,
        stock: catalogItem.stock,
      };
    }));
    setActiveHoldId(hold.id);
    setPaidAmount('');
    setCustomerType(hold.customerType || 'RETAIL');
    setSelectedPromoId(hold.promoId || 'none');
    if (hold.customer?.id) {
      setCustomerEnabled(true);
      setSelectedCustomerId(hold.customer.id);
      setCustomCustomerName('');
    } else if (hold.customerName) {
      setCustomerEnabled(true);
      setSelectedCustomerId('NEW');
      setCustomCustomerName(hold.customerName);
    } else {
      setCustomerEnabled(false);
      setSelectedCustomerId('');
      setCustomCustomerName('');
    }
    setNotice(`Melanjutkan ${hold.note || hold.customerName || hold.orderNumber}. Stok akan dicek saat checkout.`);
  };

  const cancelHeldCart = async (hold) => {
    if (!await confirmAction(`Batalkan belanjaan tertahan "${hold.note || hold.orderNumber}"?`)) return;
    try {
      const response = await apiFetch(`/orders/holds/${hold.id}`, {
        method: 'DELETE',
        silentNotify: true,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || 'Belanjaan tertahan gagal dibatalkan.');
      setHeldCarts((current) => current.filter((item) => item.id !== hold.id));
      if (activeHoldId === hold.id) {
        setActiveHoldId(null);
        setItems([]);
        setPaidAmount('');
        setCustomerEnabled(false);
        setSelectedCustomerId('');
        setCustomCustomerName('');
        setSelectedPromoId('none');
        setCustomerType('RETAIL');
      }
      setNotice('Belanjaan tertahan dibatalkan.');
    } catch (error) {
      setNotice(error.message);
    }
  };

  const renderHeldCarts = () => (
    <section className="pos-held-carts">
      <div className="pos-held-carts-header">
        <div>
          <span className="panel-kicker">Antrian tertunda</span>
          <strong>⏸️ Belanjaan Ditahan ({heldCarts.length})</strong>
          <small>Pilih Resume untuk melanjutkan tanpa scan ulang.</small>
        </div>
        <button type="button" className="pos-held-refresh" onClick={loadHeldCarts} disabled={holdsLoading}>
          {holdsLoading ? 'Memuat...' : '↻ Muat ulang'}
        </button>
      </div>
      {heldCarts.length > 0 && (
        <div className="pos-held-carts-list">
          {heldCarts.map((hold) => (
            <article className={`pos-held-cart-card ${activeHoldId === hold.id ? 'active' : ''}`} key={hold.id}>
              <div className="pos-held-cart-copy">
                <strong>{hold.note || hold.customerName || hold.orderNumber}</strong>
                <span>{hold.itemCount} barang • {formatMoney(hold.total)}</span>
                <small>{new Date(hold.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</small>
              </div>
              <div className="pos-held-cart-actions">
                <button type="button" className="pos-held-resume-btn" onClick={() => resumeHeldCart(hold)} disabled={activeHoldId && activeHoldId !== hold.id}>
                  ▶ Lanjutkan
                </button>
                <button type="button" className="pos-held-cancel-btn" onClick={() => cancelHeldCart(hold)} aria-label={`Batalkan ${hold.orderNumber}`}>
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  const setQuickCash = (amount) => {
    setPaidAmount(String(amount));
  };

  // Complete Transaction
  const completeTransaction = async ({ autoPrint = false } = {}) => {
    if (checkoutInFlightRef.current) return;
    if (!items.length) {
      setNotice('Keranjang belanja masih kosong.');
      return;
    }

    if (paymentMethod === 'CASH' && effectivePaid < finalTotal) {
      setNotice('Jumlah uang tunai yang diterima kurang dari total tagihan.');
      return;
    }
    if (paymentMethod === 'DEBT' && !selectedCustomerId) {
      setNotice('Pilih pelanggan terdaftar untuk transaksi bon/utang.');
      return;
    }

    if (averageTransaction > 0 && finalTotal > averageTransaction * 5) {
      const proceed = await confirmAction(`Nominal ini jauh lebih besar dari biasanya. Rata-rata 30 hari: ${formatMoney(averageTransaction)}. Tetap lanjutkan?`);
      if (!proceed) return;
    }
    if (!await confirmAction(`Yakin menyelesaikan transaksi sebesar ${formatMoney(finalTotal)}?`)) return;

    setSaving(true);
    checkoutInFlightRef.current = true;
    setNotice('');

    const payload = {
      items: items.map((item) => ({
        variantId: item.variantId || item.id,
        productId: item.productId || item.id,
        eventPackageId: item.eventPackageId,
        parcelId: item.parcelId,
        name: item.name,
        price: item.price,
        unitPrice: item.price,
        quantity: item.qty,
      })),
      paidAmount: paymentMethod === 'DEBT' ? 0 : effectivePaid,
      paymentMethod,
      customerType,
      paymentReference: null,
      customerId: selectedCustomerId && selectedCustomerId !== 'NEW' ? selectedCustomerId : null,
      customerName: activeCustomer?.name || null,
      cashierName: 'Kasir Glosir',
      discount: totalDiscount,
      promoName: activePromo.id !== 'none' ? activePromo.name : null,
      promoDiscount,
      holdOrderId: activeHoldId,
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
        paidAmount: data.paidAmount ?? (paymentMethod === 'DEBT' ? 0 : effectivePaid),
        change: data.change ?? Math.max(effectivePaid - finalTotal, 0),
        paymentMethod: data.paymentMethod || paymentMethod,
        paymentStatus: data.paymentStatus || (paymentMethod === 'DEBT' ? 'UNPAID' : 'PAID'),
        remainingAmount: data.remainingAmount ?? (paymentMethod === 'DEBT' ? finalTotal : 0),
        paymentReference: null,
        customer: activeCustomer,
        cashierName: 'Kasir Glosir',
        earnedPoints,
        previousPoints: previousCustomerPoints,
        currentPoints: currentCustomerPoints,
        createdAt: new Date().toISOString(),
      };

      setCompletedOrder(receipt);
      refreshAverageTransaction();
      if (activeHoldId) {
        setHeldCarts((current) => current.filter((hold) => hold.id !== activeHoldId));
        setActiveHoldId(null);
      }

      if (autoPrint) {
        setTimeout(() => {
          try {
            printReceipt('printable-receipt');
          } catch (printErr) {
            console.warn('Auto print failed:', printErr.message);
          }
        }, 400);
      }

      // Update customer list points locally
      // Decrement stock
      setProducts((current) =>
        current.map((product) => {
          const sold = items.find((item) => item.id === product.id);
          return sold ? { ...product, stock: Math.max((product.stock || 0) - sold.qty, 0) } : product;
        })
      );
    } catch (error) {
      setNotice(error.message || 'Transaksi belum tersimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      checkoutInFlightRef.current = false;
      setSaving(false);
    }
  };

  const handleResetForNewOrder = () => {
    setItems([]);
    setActiveHoldId(null);
    setPaidAmount('');
    setCustomerEnabled(false);
    setSelectedCustomerId('');
    setCustomCustomerName('');
    setSelectedPromoId('none');
    setCustomerType('RETAIL');
    setCompletedOrder(null);
  };

  const handlePrint = () => {
    try {
      printReceipt('printable-receipt');
    } catch (error) {
      setNotice(error.message);
    }
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

  const renderReceiptModal = () => {
    if (!completedOrder) return null;
    return (
      <div className="receipt-modal-backdrop" onClick={handleResetForNewOrder}>
        <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="receipt-modal-header no-print">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge-success-tick">✓</span>
              <h3>{completedOrder.paymentMethod === 'DEBT' ? 'Transaksi Bon Berhasil' : 'Transaksi Tunai Berhasil'}</h3>
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
                <strong style={{ color: completedOrder.paymentStatus === 'PAID' ? '#177d47' : '#b45309' }}>
                  {completedOrder.paymentStatus === 'PAID' ? 'LUNAS' : completedOrder.paymentStatus === 'PARTIAL' ? 'DIBAYAR SEBAGIAN' : 'BELUM LUNAS'}
                </strong>
              </div>
            </div>

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
            <button className="btn btn-primary" onClick={handlePrint}>
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
    );
  };

  if (fullscreenMode) {
    return (
      <div className="pos-fullscreen-kiosk">
        {/* Barcode Camera Scanner Modal */}
        <BarcodeScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={handleBarcodeScanned}
        />

        {/* Bantuan Kasir Modal */}
        <CashierHelpModal
          isOpen={helpModalOpen}
          onClose={() => setHelpModalOpen(false)}
        />

        {/* Kiosk Header */}
        <header className="kiosk-topbar">
          <div className="kiosk-brand">
            <span className="kiosk-logo-badge">🏪 GLOSIR POS</span>
            <div className="kiosk-title-box">
              <h2>Mode Kasir Layar Penuh</h2>
              <span className="kiosk-clock">
                🕒 {currentTime.toLocaleTimeString('id-ID')} • {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="kiosk-top-actions">
            <button
              type="button"
              className="btn-pos-help-large"
              onClick={() => setHelpModalOpen(true)}
              title="Buka panduan langkah kasir (F2)"
            >
              <span className="btn-help-icon">💡</span>
              <span className="btn-help-text">Bantuan Kasir</span>
              <kbd className="btn-help-kbd">F2</kbd>
            </button>
            <button
              type="button"
              className="btn-kiosk-hold"
              onClick={holdCurrentCart}
              disabled={!items.length || Boolean(activeHoldId)}
              title="Tahan belanjaan saat ini (F4)"
            >
              ⏸️ Tahan Belanjaan <kbd>F4</kbd>
            </button>
            <button
              type="button"
              className="btn-kiosk-exit"
              onClick={toggleFullscreen}
              title="Keluar dari layar penuh (Esc)"
            >
              <span>✕</span> Keluar Layar Penuh
            </button>
          </div>
        </header>

        {notice && (
          <div className="kiosk-notice-banner" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}

        {renderHeldCarts()}

        {/* Kiosk Main Grid */}
        <div className="kiosk-main-grid">
          {/* Kolom Kiri: Scan & Daftar Belanja */}
          <section className="kiosk-left-panel">
            {/* 1. Scan Barang */}
            <div className="kiosk-scan-box">
              <label className="kiosk-scan-label" htmlFor="kiosk-scan-input">
                <span>📦 Scan / Cari Barang:</span>
                <small>Arahkan scanner ke barcode atau ketik nama/SKU lalu Enter</small>
              </label>
              <div className="kiosk-scan-input-wrap">
                <span className="kiosk-scan-icon">🔍</span>
                <input
                  id="kiosk-scan-input"
                  ref={scanInputRef}
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Scan barcode produk di sini atau ketik nama/SKU..."
                />
                {search && (
                  <button className="kiosk-clear-search-btn" onClick={() => setSearch('')}>
                    ×
                  </button>
                )}
                <button
                  type="button"
                  className="kiosk-cam-scan-btn"
                  onClick={() => setScannerOpen(true)}
                  title="Scan dengan kamera"
                >
                  📷 Scan Kamera
                </button>
              </div>
            </div>

            {/* 2. Daftar Belanja */}
            <div className="kiosk-cart-box">
              <div className="kiosk-cart-header">
                <div>
                  <h3>🛒 Daftar Belanja</h3>
                  <span className="kiosk-cart-sub">{items.length} macam ({items.reduce((s, i) => s + (i.qty || 1), 0)} pcs)</span>
                </div>
                {items.length > 0 && (
                  <button className="kiosk-btn-clear-cart" onClick={clearCart}>
                    🗑️ Kosongkan Keranjang
                  </button>
                )}
              </div>

              <div className="kiosk-cart-list">
                {items.length > 0 ? (
                  <table className="kiosk-cart-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>No</th>
                        <th>Barang</th>
                        <th style={{ width: '130px' }}>Harga Satuan</th>
                        <th style={{ width: '150px', textAlign: 'center' }}>Jumlah</th>
                        <th style={{ width: '140px', textAlign: 'right' }}>Subtotal</th>
                        <th style={{ width: '45px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="col-idx">{idx + 1}</td>
                          <td className="col-name">
                            <strong>{item.name}</strong>
                            <small>{item.sku || item.barcode || ''}</small>
                            {/* FASE 4: Show unit info */}
                            {item.unitName && (
                              <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                                Unit: {item.unitName}
                                {item.minimumStock && (
                                  <StockAlertBadge
                                    currentStock={item.availableStock}
                                    minimumStock={item.minimumStock}
                                    maximumStock={item.maximumStock}
                                  />
                                )}
                              </div>
                            )}
                          </td>
                          <td className="col-price">{formatMoney(item.price)}</td>
                          <td className="col-qty">
                            <div className="kiosk-qty-control">
                              <button onClick={() => changeQty(item.id, item.qty - 1)}>-</button>
                              <span>{item.qty}</span>
                              <button onClick={() => changeQty(item.id, item.qty + 1)}>+</button>
                            </div>
                          </td>
                          <td className="col-subtotal">{formatMoney(item.price * item.qty)}</td>
                          <td className="col-action">
                            <button
                              className="kiosk-btn-del-item"
                              onClick={() => removeItem(item.id)}
                              title="Hapus barang"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="kiosk-cart-empty-state">
                    <span className="kiosk-empty-icon">🛒</span>
                    <h4>Daftar Belanja Masih Kosong</h4>
                    <p>Arahkan barcode scanner fisik ke kemasan barang, atau ketik nama produk di kolom scan di atas.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Kolom Kanan: Ringkasan Tagihan, Nominal Bayar & Tombol Bayar & Cetak */}
          <section className="kiosk-right-panel">
            <div className="kiosk-pay-card">
              {/* Total Tagihan */}
              <div className="kiosk-total-banner">
                <span className="kiosk-total-label">TOTAL BELANJA:</span>
                <h1 className="kiosk-total-number">{formatMoney(finalTotal)}</h1>
                <span className="kiosk-items-summary">
                  {items.length} macam barang • {items.reduce((s, i) => s + (i.qty || 1), 0)} pcs total
                </span>
              </div>

              {/* Input Nominal Bayar */}
              <div className="kiosk-nominal-section">
                <label className="kiosk-nominal-label">
                  <span>💵 Nominal Bayar (Uang Diterima):</span>
                  <CurrencyInput
                    value={paidAmount}
                    onValueChange={setPaidAmount}
                    placeholder="Contoh: Rp 100.000"
                  />
                </label>

                {/* Quick Cash Chips */}
                <div className="kiosk-quick-cash">
                  <button
                    type="button"
                    className="kiosk-chip-exact"
                    onClick={() => setQuickCash(finalTotal)}
                    disabled={finalTotal <= 0}
                  >
                    Uang Pas
                  </button>
                  {[10000, 20000, 50000, 100000, 200000, 500000].map((amt) => (
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

                {/* Kembalian */}
                <div className={`kiosk-change-display ${change >= 0 ? 'is-valid' : 'is-less'}`}>
                  <span className="kiosk-change-title">Kembalian:</span>
                  <strong className="kiosk-change-value">
                    {effectivePaid === 0 && finalTotal > 0
                      ? 'Masukkan nominal uang'
                      : change >= 0
                        ? formatMoney(change)
                        : `Uang Kurang ${formatMoney(Math.abs(change))}`}
                  </strong>
                </div>
              </div>

              {/* Tombol Utama: Bayar & Cetak */}
              <div className="kiosk-action-buttons">
                <button
                  type="button"
                  className="kiosk-btn-pay-and-print"
                  disabled={saving || !items.length || effectivePaid < finalTotal}
                  onClick={() => completeTransaction({ autoPrint: true })}
                >
                  <span className="kiosk-btn-icon">🖨️</span>
                  <div className="kiosk-btn-copy">
                    <strong>{saving ? 'Memproses Transaksi...' : 'Bayar & Cetak'}</strong>
                    <small>Simpan transaksi & langsung cetak struk</small>
                  </div>
                </button>

                <div className="kiosk-secondary-actions">
                  <button
                    type="button"
                    className="kiosk-btn-secondary"
                    disabled={saving || !items.length || effectivePaid < finalTotal}
                    onClick={() => completeTransaction({ autoPrint: false })}
                  >
                    💵 Bayar Saja
                  </button>
                  <button
                    type="button"
                    className="kiosk-btn-secondary"
                    onClick={() => setHelpModalOpen(true)}
                  >
                    💡 Bantuan (F2)
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {renderReceiptModal()}
      </div>
    );
  }

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Kasir" />

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcodeScanned}
      />

      {/* Bantuan Kasir Modal */}
      <CashierHelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
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
            <button
              type="button"
              className="btn-pos-fullscreen"
              onClick={() => setFullscreenMode(true)}
              title="Aktifkan Mode Kasir Layar Penuh (Kiosk POS)"
            >
              📺 Mode Layar Penuh
            </button>
            <button
              type="button"
              className="btn-pos-hold"
              onClick={holdCurrentCart}
              disabled={!items.length || Boolean(activeHoldId)}
              title="Tahan belanjaan saat ini (F4)"
            >
              ⏸️ Tahan (F4)
            </button>
            <button
              type="button"
              className="btn-pos-help"
              onClick={() => setHelpModalOpen(true)}
              title="Panduan Langkah Kasir (F2)"
            >
              💡 Bantuan (F2)
            </button>
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

        {renderHeldCarts()}

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
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan barcode langsung di sini / cari nama atau SKU..."
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
                  style={{ cursor: 'default' }}
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
                    
                    {/* FASE 4: Add ProductUnitPicker */}
                    <ProductUnitPicker
                      product={product}
                      onSelectUnit={(unit) => {
                        setSelectedUnits((prev) => ({
                          ...prev,
                          [product.productId || product.id]: unit,
                        }));
                      }}
                      selectedUnitId={selectedUnits[product.productId || product.id]?.id}
                    />
                  </div>

                  <div className="pos-card-bottom">
                    <b className="pos-product-price">{formatMoney(getSellingPrice(product))}</b>
                    {customerType === 'WHOLESALE' && Number(product.wholesalePrice) > 0 && <small className="pos-wholesale-hint">Harga warung</small>}
                    <button
                      className="pos-btn-add"
                      title="Tambah ke keranjang"
                      onClick={() => addProduct(product)}
                    >
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

                <div className="pos-payment-selector">
                  <span className="payment-label-text">Metode Pembayaran:</span>
                  <div className="payment-method-buttons">
                    <button type="button" className={paymentMethod === 'CASH' ? 'active' : ''} onClick={() => setPaymentMethod('CASH')}>💵 Tunai</button>
                    <button type="button" className={paymentMethod === 'DEBT' ? 'active' : ''} onClick={() => setPaymentMethod('DEBT')}>📒 Bon / Utang</button>
                  </div>
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
                      style={{ background: '#059669', marginBottom: '8px' }}
                      disabled={saving || effectivePaid < finalTotal}
                      onClick={() => completeTransaction({ autoPrint: true })}
                    >
                      {saving ? 'Menyimpan Transaksi...' : `🖨️ Bayar & Cetak (${formatMoney(finalTotal)})`}
                    </button>
                    <button
                      className="btn-finish-pay btn-cash-pay"
                      style={{ background: '#475569' }}
                      disabled={saving || effectivePaid < finalTotal}
                      onClick={() => completeTransaction({ autoPrint: false })}
                    >
                      {saving ? 'Menyimpan Transaksi...' : `💵 Bayar Saja (${formatMoney(finalTotal)})`}
                    </button>
                  </div>
                )}
                {paymentMethod === 'DEBT' && (
                  <div className="pos-method-detail debt-box">
                    <strong>📒 Transaksi bon</strong>
                    <p>
                      {activeCustomer?.name && activeCustomer.name !== 'Pelanggan Umum'
                        ? `Pelanggan: ${activeCustomer.name}. Pembayaran dapat dicatat kemudian dari menu Piutang.`
                        : 'Pilih pelanggan di bagian pelanggan sebelum menyimpan transaksi bon.'}
                    </p>
                    <div className="pos-change-box valid">
                      <span>Sisa utang:</span>
                      <strong>{formatMoney(finalTotal)}</strong>
                    </div>
                    <button
                      className="btn-finish-pay btn-cash-pay"
                      disabled={saving || !selectedCustomerId || (selectedCustomerId === 'NEW' && !customCustomerName.trim())}
                      onClick={() => completeTransaction({ autoPrint: true })}
                    >
                      {saving ? 'Menyimpan Transaksi...' : `Simpan Bon & Cetak (${formatMoney(finalTotal)})`}
                    </button>
                  </div>
                )}

              </div>
            )}
          </aside>
        </section>

        {renderReceiptModal()}
      </main>
    </div>
  );
}
