import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { confirmAction } from '../utils/confirmService';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

export default function CartPage() {
  const { items, updateQty, removeItem, totalPrice, promo, discount, applyPromo, removePromo } = useCart();
  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState('');

  const subtotal = totalPrice;
  const ongkir = 25000;
  const total = subtotal - discount + ongkir;

  const confirmRemoveItem = async (item) => {
    if (await confirmAction(`Hapus "${item.name}" dari keranjang?`)) removeItem(item.id);
  };

  const handlePromo = (event) => {
    event.preventDefault();
    if (applyPromo(promoInput)) {
      setPromoMessage('Kode promo berhasil dipakai.');
      setPromoInput('');
    } else setPromoMessage('Kode tidak ditemukan. Coba LEBARAN15, GLOSIR10, atau HEMAT25.');
  };

  return (
    <div className="public-page">
      <PublicHeader />
      <div className="cart-shell">
        <div className="shopping-steps"><span className="current">01 Keranjang</span><i /> <span>02 Checkout</span><i /> <span>03 WhatsApp</span></div>
        <h1>Keranjang Belanja</h1>
        <div className="cart-layout">
        <div className="cart-list">
          {items.length === 0 ? (
            <div className="cart-empty">Keranjang masih kosong.</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="cart-item">
                <div className={`cart-thumb product-art-${item.id}`}><span>{item.name.split(' ').slice(0, 1).join(' ')}</span></div>
                <div className="cart-info">
                  <h3>{item.name}</h3>
                  <div className="qty-control">
                    <button onClick={() => updateQty(item.id, item.qty - 1)}>-</button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                  </div>
                </div>
                <div className="cart-actions">
                  <strong>Rp {(item.qty * item.price).toLocaleString('id-ID')}</strong>
                  <button className="remove-btn" onClick={() => confirmRemoveItem(item)}>Hapus</button>
                </div>
              </div>
            ))
          )}
        </div>

        <aside className="cart-summary">
          <h3>Ringkasan</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <strong>Rp {subtotal.toLocaleString('id-ID')}</strong>
          </div>
          <div className="summary-row">
            <span>Ongkir</span>
            <strong>Rp {ongkir.toLocaleString('id-ID')}</strong>
          </div>
          <form className="promo-form" onSubmit={handlePromo}><input value={promoInput} onChange={(event) => setPromoInput(event.target.value)} placeholder="Kode promo" aria-label="Kode promo" /><button type="submit">Pakai</button></form>
          {promo && <div className="applied-promo"><span>{promo} aktif</span><button onClick={removePromo}>Hapus</button></div>}
          {promoMessage && <p className="promo-message">{promoMessage}</p>}
          {discount > 0 && <div className="summary-row discount-row"><span>Diskon promo</span><strong>- Rp {discount.toLocaleString('id-ID')}</strong></div>}
          <div className="summary-row total">
            <span>Total</span>
            <strong>Rp {total.toLocaleString('id-ID')}</strong>
          </div>
          <Link to="/checkout" className={`btn btn-primary full center-link ${items.length === 0 ? 'is-disabled' : ''}`} aria-disabled={items.length === 0} onClick={(event) => { if (items.length === 0) event.preventDefault(); }}>
            {items.length === 0 ? 'Belanja dulu' : 'Lanjut ke checkout'}
          </Link>
        </aside>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
