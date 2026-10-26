import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { confirmAction } from '../utils/confirmService';
import { Link } from 'react-router-dom';
import { ShoppingBag, RotateCcw, Trash2, ArrowRight } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { showSuccess } from '../utils/noticeService';

export default function CartPage() {
  const { items, updateQty, removeItem, totalPrice, promo, discount, promoError, applyPromo, removePromo, addItem } = useCart();
  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('glosir_last_order');
      if (saved) {
        setLastOrder(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const subtotal = totalPrice;
  const total = Math.max(0, subtotal - discount);

  const confirmRemoveItem = async (item) => {
    if (await confirmAction(`Hapus "${item.name}" dari keranjang belanja?`)) {
      removeItem(item.id);
    }
  };

  const handlePromo = async (event) => {
    event.preventDefault();
    if (await applyPromo(promoInput)) {
      setPromoMessage('Kode promo berhasil dipakai.');
      setPromoInput('');
    } else {
      setPromoMessage('Kode tidak ditemukan.');
    }
  };

  const handleReorder = () => {
    if (!lastOrder?.items || lastOrder.items.length === 0) return;
    lastOrder.items.forEach((item) => {
      addItem({
        id: item.id || item.variantId || item.productId,
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        price: item.price || item.unitPrice,
        unit: item.unit || 'Pcs',
        qty: item.qty || item.quantity || 1,
      });
    });
    showSuccess('Pesanan sebelumnya berhasil dimasukkan ke keranjang!');
  };

  return (
    <div className="glosir-public-page">
      <PublicHeader />
      <div className="cart-shell" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Tombol Pesan Lagi (jika ada pesanan sebelumnya) */}
        {lastOrder && items.length === 0 && (
          <div className="reorder-banner" style={{ background: '#e8f5ed', border: '1px solid #bce3c9', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <strong style={{ display: 'block', color: '#135b35', fontSize: '1rem' }}>Pernah belanja sebelumnya?</strong>
              <small style={{ color: '#4b5563' }}>Isi keranjang langsung dari pesanan terakhir Anda.</small>
            </div>
            <button onClick={handleReorder} className="btn btn-secondary" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#ffffff', color: '#1f7a4a', borderColor: '#1f7a4a' }}>
              <RotateCcw size={16} /> Pesan Lagi
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#111827', margin: 0 }}>Keranjang Belanja</h1>
          <span style={{ fontSize: '0.9rem', color: '#1f7a4a', fontWeight: 700, background: '#e8f5ed', padding: '6px 12px', borderRadius: '999px' }}>
            Ambil di Toko
          </span>
        </div>

        <div className="cart-layout">
          <div className="cart-list">
            {items.length === 0 ? (
              <div className="cart-empty" style={{ textAlign: 'center', padding: '48px 16px', background: '#ffffff', borderRadius: '20px', border: '1px solid #e5e7eb' }}>
                <ShoppingBag size={48} style={{ color: '#9ca3af', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 8px' }}>Keranjang Anda masih kosong</h3>
                <p style={{ color: '#6b7280', margin: '0 0 20px' }}>Pilih sembako dan kebutuhan harian untuk mulai berbelanja.</p>
                <Link to="/products" className="btn btn-primary" style={{ minHeight: '48px', padding: '0 24px' }}>
                  Lihat Katalog Produk
                </Link>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-thumbnail">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} width="80" height="80" loading="lazy" decoding="async" />
                    ) : (
                      <span aria-hidden="true">🛍️</span>
                    )}
                  </div>
                  <div className="cart-info">
                    <h3>{item.name}</h3>
                    <div className="cart-item-unit-price">
                      Rp {Number(item.price).toLocaleString('id-ID')} / {item.unit || 'Pcs'}
                    </div>
                    <div className="qty-control">
                      <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} aria-label={`Kurangi jumlah ${item.name}`}>-</button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => updateQty(item.id, item.qty + 1)} aria-label={`Tambah jumlah ${item.name}`}>+</button>
                    </div>
                  </div>
                  <div className="cart-actions">
                    <strong>
                      Rp {(item.qty * item.price).toLocaleString('id-ID')}
                    </strong>
                    <button type="button" className="remove-btn" onClick={() => confirmRemoveItem(item)}>
                      <Trash2 size={16} /> Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <aside className="cart-summary" style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '24px', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 16px', color: '#111827' }}>Ringkasan Belanja</h3>
            
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.95rem', color: '#4b5563' }}>
              <span>Total Barang</span>
              <strong>Rp {subtotal.toLocaleString('id-ID')}</strong>
            </div>

            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '0.95rem', color: '#1f7a4a' }}>
              <span>Metode</span>
              <strong style={{ fontWeight: 800 }}>Ambil di Toko (Rp 0)</strong>
            </div>

            <form className="promo-form" onSubmit={handlePromo} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value)}
                placeholder="Kode kupon promo"
                aria-label="Kode promo"
                style={{ flex: 1, height: '44px', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0 12px' }}
              />
              <button type="submit" style={{ height: '44px', padding: '0 16px', background: '#1f7a4a', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 700 }}>
                Pakai
              </button>
            </form>

            {promo && (
              <div className="applied-promo" style={{ background: '#e8f5ed', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: '#135b35', fontWeight: 700 }}>Promo {promo} aktif</span>
                <button onClick={removePromo} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Hapus</button>
              </div>
            )}

            {promoMessage && <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: '0 0 12px' }}>{promoMessage}</p>}
            {promoError && <p role="alert" style={{ fontSize: '0.85rem', color: '#b42318', margin: '0 0 12px' }}>{promoError}</p>}

            {discount > 0 && (
              <div className="summary-row discount-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#16a34a' }}>
                <span>Potongan Promo</span>
                <strong>- Rp {discount.toLocaleString('id-ID')}</strong>
              </div>
            )}

            <div className="summary-row total" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px dashed #e5e7eb', paddingTop: '16px', marginTop: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Total Pembayaran</span>
              <strong style={{ fontSize: '1.4rem', color: '#1f7a4a', fontWeight: 900 }}>Rp {total.toLocaleString('id-ID')}</strong>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.4 }}>
              * Pembayaran dilakukan di toko saat mengambil barang (Tunai atau Transfer).
            </p>

            <Link
              to="/checkout"
              className={`btn btn-primary full center-link ${items.length === 0 ? 'is-disabled' : ''}`}
              aria-disabled={items.length === 0}
              style={{
                width: '100%',
                minHeight: '52px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '1.05rem',
                fontWeight: 800,
                borderRadius: '14px',
                textDecoration: 'none',
                background: items.length === 0 ? '#9ca3af' : '#1f7a4a',
                color: '#ffffff',
                pointerEvents: items.length === 0 ? 'none' : 'auto',
              }}
            >
              Lanjut ke Checkout <ArrowRight size={20} />
            </Link>
          </aside>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
