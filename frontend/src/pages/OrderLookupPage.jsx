import { useState } from 'react';
import { SearchCheck, PackageCheck } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';

const statusLabel = {
  PENDING: 'Menunggu konfirmasi',
  CONFIRMED: 'Pesanan dikonfirmasi',
  PROCESSING: 'Sedang disiapkan',
  READY: 'Siap diambil / dikirim',
  COMPLETED: 'Pesanan selesai',
  CANCELLED: 'Pesanan dibatalkan',
};

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function OrderLookupPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phoneLastFour, setPhoneLastFour] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const response = await apiFetch('/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        silentNotify: true,
        body: JSON.stringify({ orderNumber: orderNumber.trim(), phoneLastFour }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pesanan belum dapat ditemukan.');
      setOrder(data.order);
    } catch (lookupError) {
      setError(lookupError.message || 'Status pesanan belum dapat diperiksa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glosir-public-page">
      <PublicHeader />
      <main className="g-order-lookup">
        <header className="g-order-lookup__intro">
          <span className="g-order-lookup__icon"><SearchCheck size={25} /></span>
          <p className="g-eyebrow">INFORMASI PESANAN</p>
          <h1>Cek status pesanan</h1>
          <p>Masukkan nomor pesanan dan empat digit terakhir nomor WhatsApp yang dipakai saat memesan.</p>
        </header>
        <form className="g-order-lookup__form" onSubmit={submit}>
          <label className="g-field">
            <span>Nomor pesanan</span>
            <input required autoComplete="off" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="Contoh: WEB-..." />
          </label>
          <label className="g-field">
            <span>4 digit terakhir nomor WhatsApp</span>
            <input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={phoneLastFour} onChange={(event) => setPhoneLastFour(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Contoh: 6789" />
          </label>
          {error && <p className="g-order-lookup__error" role="alert">{error}</p>}
          <button className="g-ui-button g-ui-button--primary" type="submit" disabled={loading || phoneLastFour.length !== 4}>
            {loading ? 'Memeriksa…' : 'Periksa pesanan'}
          </button>
        </form>
        {order && (
          <section className="g-order-lookup__result" aria-live="polite">
            <div className="g-order-lookup__result-heading"><span><PackageCheck size={20} /></span><div><small>{order.orderNumber}</small><h2>{statusLabel[order.status] || order.status}</h2></div></div>
            <p className="g-order-lookup__date">Dibuat {new Date(order.createdAt).toLocaleString('id-ID')}</p>
            <ul>{order.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name} × {item.quantity}</span><strong>{money(item.total)}</strong></li>)}</ul>
            <div className="g-order-lookup__total"><span>Total pesanan</span><strong>{money(order.total)}</strong></div>
          </section>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
