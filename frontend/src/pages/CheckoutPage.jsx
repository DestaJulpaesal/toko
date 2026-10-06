import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { isValidIndonesianPhone, normalizeIndonesianPhone } from '../utils/phoneUtils';

export default function CheckoutPage() {
  const { items, totalPrice, promo, discount } = useCart();
  const [form, setForm] = useState({ name: '', phone: '', note: '' });
  const [formError, setFormError] = useState('');
  const fulfillmentMethod = 'PICKUP';
  const shippingCost = 0;
  const total = totalPrice - discount;

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setFormError('');
  };

  const buildWhatsappLink = async (event) => {
    event.preventDefault();
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
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pesanan gagal dicatat.');
      window.open(data.order.whatsappLink, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setFormError(error.message || 'Pesanan gagal dicatat. WhatsApp tidak dibuka.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="public-page">
        <PublicHeader />
        <main className="detail-empty"><h1>Belum ada pesanan</h1><p>Tambahkan produk ke keranjang sebelum checkout.</p><Link to="/products" className="btn btn-primary">Lihat produk</Link></main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="public-page">
      <PublicHeader />
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
      </div>
      <PublicFooter />
    </div>
  );
}
