import { useState } from 'react';
import { useCart } from '../context/CartContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { isValidIndonesianPhone, normalizeIndonesianPhone } from '../utils/phoneUtils';

export default function CheckoutPage() {
  const { items, totalPrice, promo, discount } = useCart();
  const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
  const [formError, setFormError] = useState('');
  const total = totalPrice - discount + 25000;

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setFormError('');
  };

  const buildWhatsappLink = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setFormError('Lengkapi nama, nomor WhatsApp, dan alamat terlebih dahulu.');
      return;
    }
    if (!isValidIndonesianPhone(form.phone)) {
      setFormError('Nomor WhatsApp tidak valid. Gunakan format 08..., 628..., atau +628... .');
      return;
    }

    try {
      const response = await apiFetch('/orders/online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: form.name.trim(), customerPhone: normalizeIndonesianPhone(form.phone), address: form.address.trim(), note: form.note.trim(), promoCode: promo, shippingCost: 25000, items: items.map((item) => ({ variantId: item.variantId, parcelId: item.parcelId, eventPackageId: item.eventPackageId, quantity: item.qty })) }) });
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
          <p className="eyebrow dark">Checkout</p>
          <h1>Konfirmasi Pesanan</h1>
        </div>
        </div>

        <form className="checkout-layout" onSubmit={buildWhatsappLink}>
        <section className="checkout-form-box">
          <h3>Data Pembeli</h3>
          <div className="field-grid">
            <input name="name" value={form.name} onChange={handleChange} placeholder="Nama lengkap" />
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="Nomor WhatsApp" inputMode="tel" />
            <input name="address" value={form.address} onChange={handleChange} placeholder="Alamat lengkap" />
            <input name="note" value={form.note} onChange={handleChange} placeholder="Catatan tambahan" />
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
        </section>

        <aside className="checkout-summary-box">
          <h3>Ringkasan</h3>
          {items.map((item) => (
            <div key={item.id} className="summary-row">
              <span>{item.name} x{item.qty}</span>
              <strong>Rp {(item.price * item.qty).toLocaleString('id-ID')}</strong>
            </div>
          ))}
          {discount > 0 && <div className="summary-row discount-row"><span>Diskon {promo}</span><strong>- Rp {discount.toLocaleString('id-ID')}</strong></div>}
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
