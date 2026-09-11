import { useState } from 'react';
import { useCart } from '../context/CartContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { Link } from 'react-router-dom';

export default function CheckoutPage() {
  const { items, totalPrice, promo, discount } = useCart();
  const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
  const [formError, setFormError] = useState('');
  const total = totalPrice - discount + 25000;

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setFormError('');
  };

  const buildWhatsappLink = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setFormError('Lengkapi nama, nomor WhatsApp, dan alamat terlebih dahulu.');
      return;
    }

    const whatsappMessage = encodeURIComponent(
      `Halo Glosir, saya ingin pesan:\n\nNama: ${form.name}\nWhatsApp: ${form.phone}\nAlamat: ${form.address}\nCatatan: ${form.note || '-'}\nPromo: ${promo || '-'}\n\n${items
        .map((item) => `${item.name} x${item.qty} - Rp ${(item.price * item.qty).toLocaleString('id-ID')}`)
        .join('\n')}\n\nTotal: Rp ${total.toLocaleString('id-ID')}\nMohon dikonfirmasi.`
    );

    window.open(`https://wa.me/6281234567890?text=${whatsappMessage}`, '_blank', 'noopener,noreferrer');
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
