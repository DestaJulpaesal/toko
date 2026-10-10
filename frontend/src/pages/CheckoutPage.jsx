<<<<<<< HEAD
import { useState, useEffect } from 'react';
=======
import { useEffect, useState } from 'react';
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
import { useCart } from '../context/CartContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { isValidIndonesianPhone, normalizeIndonesianPhone } from '../utils/phoneUtils';
import { MessageCircle, Store, AlertTriangle, ShieldCheck } from 'lucide-react';

// Konfigurasi pencegahan pesanan iseng (mudah diubah)
const ORDER_LIMIT_CONFIG = {
  maxQtyPerItem: 50,
  maxTotalAmount: 5000000, // Rp 5.000.000
};

const CUSTOMER_STORAGE_KEY = 'glosir_customer_info';
const LAST_ORDER_STORAGE_KEY = 'glosir_last_order';

export default function CheckoutPage() {
<<<<<<< HEAD
  const { items, totalPrice, promo, discount, clearCart } = useCart();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const total = Math.max(0, totalPrice - discount);

  // Ambil data nama & nomor HP dari localStorage agar terisi otomatis
  useEffect(() => {
    try {
      const savedInfo = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (savedInfo) {
        const parsed = JSON.parse(savedInfo);
        setForm({
          name: parsed.name || '',
          phone: parsed.phone || '',
        });
      }
    } catch {
      // ignore
    }
  }, []);
=======
  const { items, totalPrice, promo, discount } = useCart();
  const [form, setForm] = useState({ name: '', phone: '', note: '' });
  const [formError, setFormError] = useState('');
  const fulfillmentMethod = 'PICKUP';
  const shippingCost = 0;
  const total = totalPrice - discount;
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setFormError('');
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
<<<<<<< HEAD
    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();

    if (!trimmedName || !trimmedPhone) {
      setFormError('Silakan isi Nama Lengkap dan Nomor WhatsApp Anda.');
      return;
    }

    if (!isValidIndonesianPhone(trimmedPhone)) {
      setFormError('Nomor WhatsApp tidak valid. Masukkan nomor HP aktif (contoh: 08123456789).');
      return;
    }

    // Validasi batas pesanan iseng
    const hasExcessiveItem = items.some((item) => item.qty > ORDER_LIMIT_CONFIG.maxQtyPerItem);
    if (hasExcessiveItem) {
      setFormError(`Jumlah per barang maksimal ${ORDER_LIMIT_CONFIG.maxQtyPerItem} item untuk pemesanan online.`);
      return;
    }

    if (total > ORDER_LIMIT_CONFIG.maxTotalAmount) {
      setFormError(`Maksimal total pesanan online adalah Rp ${ORDER_LIMIT_CONFIG.maxTotalAmount.toLocaleString('id-ID')}. Untuk pesanan partai besar silakan hubungi langsung.`);
      return;
    }

    setLoading(true);
    setFormError('');

    try {
      const normalizedPhone = normalizeIndonesianPhone(trimmedPhone);

      // Simpan data pembeli ke localStorage untuk pesanan berikutnya
      localStorage.setItem(
        CUSTOMER_STORAGE_KEY,
        JSON.stringify({ name: trimmedName, phone: trimmedPhone })
      );

      // Simpan ke database backend
      const response = await apiFetch('/orders/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: trimmedName,
          customerPhone: normalizedPhone,
          address: 'Ambil di Toko (Glosir)', // Ambil di toko tanpa form alamat
          note: 'Metode: Ambil di Toko',
          promoCode: promo || '',
          shippingCost: 0, // Tanpa biaya antar / ongkir Rp 0
          items: items.map((item) => ({
            variantId: item.variantId || undefined,
            parcelId: item.parcelId || undefined,
            eventPackageId: item.eventPackageId || undefined,
            quantity: item.qty,
          })),
        }),
      });

=======
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError('Lengkapi nama dan nomor WhatsApp terlebih dahulu.');
      return;
    }
    if (!isValidIndonesianPhone(form.phone)) {
      setFormError('Nomor WhatsApp tidak valid. Gunakan format 08..., 628..., atau +628... .');
      return;
    }
    try {
      const response = await apiFetch('/orders/online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: form.name.trim(), customerPhone: normalizeIndonesianPhone(form.phone), note: form.note.trim(), promoCode: promo, fulfillmentMethod, items: items.map((item) => ({ variantId: item.variantId, parcelId: item.parcelId, eventPackageId: item.eventPackageId, quantity: item.qty })) }) });
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
      const data = await response.json();
      const orderNumber = data.order?.orderNumber || `WEB-${Date.now().toString().slice(-6)}`;

      // Simpan riwayat pesanan terakhir untuk fitur "Pesan Lagi"
      localStorage.setItem(
        LAST_ORDER_STORAGE_KEY,
        JSON.stringify({
          orderNumber,
          date: new Date().toISOString(),
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            qty: item.qty,
            price: item.price,
            unit: item.unit || 'Pcs',
          })),
          total,
        })
      );

      // Format Pesan WhatsApp Sesuai Instruksi
      const storeNumber = (import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
      const waLines = items.map(
        (item) => `• ${item.name} x${item.qty} = Rp ${(item.price * item.qty).toLocaleString('id-ID')}`
      );

      const messageText = [
        `*PESANAN BARU GLOSIR - AMBIL DI TOKO*`,
        `Kode Pesanan: ${orderNumber}`,
        `Nama: ${trimmedName}`,
        `No. HP / WA: ${normalizedPhone}`,
        ``,
        `*Daftar Barang:*`,
        ...waLines,
        ``,
        `Total Belanja: *Rp ${total.toLocaleString('id-ID')}*`,
        `Metode: *Ambil di Toko*`,
        `Pembayaran: *Di Toko saat mengambil*`,
        ``,
        `_Catatan: Pesanan ditahan sampai toko tutup hari ini (21:00 WIB). Mohon konfirmasi ketersediaan barang dan total._`,
      ].join('\n');

      const whatsappTarget = data.order?.whatsappLink || `https://wa.me/${storeNumber}?text=${encodeURIComponent(messageText)}`;

      // Kosongkan keranjang setelah pesanan berhasil dicatat
      clearCart();

      // Buka WhatsApp
      window.location.href = whatsappTarget;
    } catch (error) {
      setFormError(error.message || 'Gagal menyimpan pesanan. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="glosir-public-page">
        <PublicHeader />
        <main style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center', padding: '32px 16px', background: '#ffffff', borderRadius: '20px', border: '1px solid #e5e7eb' }}>
          <Store size={48} style={{ color: '#1f7a4a', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 10px' }}>Keranjang Belanja Masih Kosong</h1>
          <p style={{ color: '#6b7280', margin: '0 0 24px' }}>Tambahkan produk terlebih dahulu sebelum melakukan pemesanan.</p>
          <Link to="/products" className="btn btn-primary" style={{ minHeight: '48px', padding: '0 24px' }}>
            Lihat Produk
          </Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="glosir-public-page">
      <PublicHeader />
<<<<<<< HEAD
      <div className="checkout-shell" style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '0.85rem', color: '#1f7a4a', fontWeight: 800, textTransform: 'uppercase' }}>Pemesanan Cepat (Tanpa Login)</span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#111827', margin: '4px 0 0' }}>Ambil & Bayar di Toko</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Form Pembeli */}
          <section style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Data Pembeli</h2>
            <p style={{ fontSize: '0.88rem', color: '#6b7280', margin: '0 0 20px' }}>
              Cukup isi nama dan nomor HP. Data disimpan otomatis di HP ini untuk pesanan berikutnya.
            </p>

            <form onSubmit={handleCheckoutSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: '#374151' }}>
                  Nama Lengkap <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Contoh: Pak Budi / Bu Rina"
                  required
                  style={{ width: '100%', height: '50px', borderRadius: '12px', border: '1px solid #d1d5db', padding: '0 14px', fontSize: '1rem' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: '#374151' }}>
                  Nomor WhatsApp / HP Aktif <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Contoh: 081234567890"
                  inputMode="tel"
                  required
                  style={{ width: '100%', height: '50px', borderRadius: '12px', border: '1px solid #d1d5db', padding: '0 14px', fontSize: '1rem' }}
                />
                <small style={{ display: 'block', color: '#6b7280', marginTop: '6px', fontSize: '0.8rem' }}>
                  Untuk konfirmasi stok dan pengingat saat pesanan siap diambil.
                </small>
              </div>

              {/* Box Peringatan Informasi Toko */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Store size={22} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', color: '#14532d', fontSize: '0.95rem', marginBottom: '4px' }}>
                      PENGAMBILAN & PEMBAYARAN DI TOKO
                    </strong>
                    <p style={{ color: '#166534', fontSize: '0.88rem', margin: 0, lineHeight: 1.45 }}>
                      Tidak ada pengantaran/ongkir. Anda cukup datang ke toko untuk mengambil pesanan dan membayar langsung (tunai atau transfer).
                    </p>
                  </div>
                </div>
              </div>

              {/* Peringatan Konfirmasi Stok */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', padding: '14px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
                  <p style={{ color: '#92400e', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 }}>
                    Total dan stok akan dikonfirmasi langsung oleh pemilik toko melalui WhatsApp.
                  </p>
                </div>
              </div>

              {formError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 14px', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '20px' }}>
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  minHeight: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  borderRadius: '14px',
                  background: '#25d366',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <MessageCircle size={22} />
                {loading ? 'Menyimpan Pesanan...' : 'Pesan & Lanjut ke WhatsApp'}
              </button>
            </form>
          </section>

          {/* Ringkasan Belanja */}
          <aside style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '24px', height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: '0 0 16px' }}>Daftar Belanjaan</h2>
            <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
              {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem', color: '#1f2937' }}>{item.name}</strong>
                    <small style={{ color: '#6b7280' }}>
                      {item.qty} {item.unit || 'item'} x Rp {Number(item.price).toLocaleString('id-ID')}
                    </small>
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: '#1f7a4a' }}>
                    Rp {(item.price * item.qty).toLocaleString('id-ID')}
                  </strong>
                </div>
              ))}
            </div>

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', marginBottom: '10px', fontSize: '0.95rem' }}>
                <span>Diskon Kupon</span>
                <strong>- Rp {discount.toLocaleString('id-ID')}</strong>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.95rem', color: '#4b5563' }}>
              <span>Ongkos Kirim</span>
              <strong style={{ color: '#1f7a4a' }}>Rp 0 (Ambil di Toko)</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px dashed #e5e7eb', paddingTop: '16px', marginTop: '12px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>Total yang Dibayar</span>
              <strong style={{ fontSize: '1.35rem', color: '#1f7a4a', fontWeight: 900 }}>
                Rp {total.toLocaleString('id-ID')}
              </strong>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '0.82rem' }}>
              <ShieldCheck size={18} style={{ color: '#1f7a4a' }} />
              <span>Pesanan ditahan sampai toko tutup hari ini (21:00 WIB).</span>
            </div>
          </aside>
        </div>
=======
      <div className="checkout-shell">
        <div className="shopping-steps"><span className="done">01 Keranjang</span><i /> <span className="current">02 Checkout</span><i /> <span>03 WhatsApp</span></div>
        <div className="checkout-header">
        <div>
          <p className="eyebrow dark">Checkout aman & praktis</p>
          <h1>Konfirmasi Pesanan</h1>
          <p className="checkout-lead">Lengkapi data di bawah ini. Kami akan meneruskan detail pesanan ke WhatsApp admin untuk konfirmasi.</p>
        </div>
        </div>

        <form className="checkout-layout" onSubmit={buildWhatsappLink}>
        <section className="checkout-form-box">
          <div className="checkout-section-heading">
            <span className="checkout-section-number">01</span>
            <div><h3>Data Pembeli</h3><p>Informasi ini digunakan untuk menghubungi dan mengirimkan pesanan.</p></div>
          </div>
          <div className="field-grid">
            <label><span>Nama lengkap</span><input name="name" value={form.name} onChange={handleChange} placeholder="Contoh: Budi Santoso" required /></label>
            <label><span>Nomor WhatsApp</span><input name="phone" value={form.phone} onChange={handleChange} placeholder="08xxxxxxxxxx" inputMode="tel" required /></label>
            <label className="field-wide"><span>Catatan tambahan <em>(opsional)</em></span><input name="note" value={form.note} onChange={handleChange} placeholder="Waktu pengambilan atau pesan lainnya" /></label>
          </div>
          <div className="delivery-options pickup-only">
            <div className="checkout-section-heading compact">
              <span className="checkout-section-number">02</span>
              <div><h3>Pengambilan pesanan</h3><p>Pesanan disiapkan untuk diambil langsung di toko Glosir.</p></div>
            </div>
            <div className="pickup-confirmation"><strong>Ambil langsung di toko</strong><span>Ongkir Rp0 · Tidak ada biaya pengiriman</span></div>
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
        </section>

        <aside className="checkout-summary-box">
          <div className="checkout-summary-heading"><div><span>03</span><h3>Ringkasan pesanan</h3></div><small>{items.reduce((sum, item) => sum + item.qty, 0)} item</small></div>
          <div className="checkout-summary-items">
          {items.map((item) => (
            <div key={item.id} className="summary-row">
              <span>{item.name} x{item.qty}</span>
              <strong>Rp {(item.price * item.qty).toLocaleString('id-ID')}</strong>
            </div>
          ))}
          </div>
          {discount > 0 && <div className="summary-row discount-row"><span>Diskon {promo}</span><strong>- Rp {discount.toLocaleString('id-ID')}</strong></div>}
          <div className="summary-row"><span>Pengambilan</span><strong>Ambil di toko</strong></div>
          <div className="summary-row total">
            <span>Total</span>
            <strong>Rp {total.toLocaleString('id-ID')}</strong>
          </div>
          <button type="submit" className="btn btn-primary full center-link">
            Kirim ke WhatsApp
          </button>
        </aside>
        </form>
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
      </div>
      <PublicFooter />
    </div>
  );
}

