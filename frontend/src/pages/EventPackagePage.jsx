import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { useCart } from '../context/CartContext';
import CatalogImage from '../components/CatalogImage';

const storeWhatsappNumber = import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '';

export default function EventPackagePage() {
  const { addItem, totalItems } = useCart();
  const [packages, setPackages] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const loadPackages = async () => {
      try {
        const response = await apiFetch('/event-packages');
        const data = await response.json();
        if (response.ok && data.success && Array.isArray(data.packages)) setPackages(data.packages);
      } catch {
        setPackages([]);
      }
    };

    loadPackages();
  }, []);

  const handleAddToCart = (item) => {
    addItem({
      id: `event-package-${item.id}`,
      name: item.name,
      price: Number(item.price || 0),
      eventPackageId: item.id,
      items: item.items || [],
    });
    setToastMessage(`"${item.name}" berhasil ditambahkan ke keranjang.`);
    window.setTimeout(() => setToastMessage(''), 3500);
  };

  return (
    <div className="public-page">
      <PublicHeader />

      {toastMessage && (
        <div className="cart-toast" role="status">
          <span className="toast-check">✓</span>
          <span><strong>{toastMessage}</strong></span>
          <Link to="/cart">Lihat keranjang ({totalItems})</Link>
          <button type="button" onClick={() => setToastMessage('')} aria-label="Tutup notifikasi">×</button>
        </div>
      )}

      <main className="parcel-page-shell">
        <section className="inner-hero parcel-hero">
          <div>
            <span className="eyebrow dark">Paket Acara</span>
            <h1>Paket Siap untuk Hajatan dan Momen Spesial.</h1>
          </div>
          <div>
            <p>
              Pilih paket kebutuhan acara yang sudah disusun Glosir untuk hajatan,
              nikahan, syukuran, dan acara keluarga.
            </p>
            <div className="parcel-hero-actions">
              <a href={`https://wa.me/${storeWhatsappNumber}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
                Chat Admin via WhatsApp
              </a>
              <Link to="/cart" className="btn btn-primary">
                Keranjang Belanja ({totalItems})
              </Link>
            </div>
          </div>
        </section>

        <section className="parcel-grid">
          {packages.map((item) => {
            const price = Number(item.price || 0);
            const waUrl = `https://wa.me/${storeWhatsappNumber}?text=${encodeURIComponent(
              `Halo Toko Glosir, saya ingin pesan *${item.name}* dengan harga Rp ${price.toLocaleString('id-ID')}. Mohon info stok dan pengirimannya ya.`
            )}`;

            return (
              <article key={item.id} className="parcel-feature-card">
                <div className="parcel-art parcel-art-purple">
                  <CatalogImage src={item.imageUrl} alt={`Foto ${item.name}`}>
                    <div className="parcel-art-content"><span>GLOSIR</span><small>{item.isCustom ? 'CUSTOM ACARA' : 'PAKET ACARA'}</small></div>
                  </CatalogImage>
                </div>

                <div className="catalog-badges-wrap">
                  <span className="catalog-badge">{item.isCustom ? 'Custom Acara' : 'Paket Acara'}</span>
                </div>

                <h2>{item.name}</h2>
                <p>{item.description || 'Paket kebutuhan acara pilihan Glosir.'}</p>

                {item.items?.length > 0 && (
                  <div className="parcel-contents">
                    <strong>Isi paket</strong>
                    <ul>
                      {item.items.map((entry) => (
                        <li key={entry.id}>
                          <span className="parcel-item-quantity">{entry.quantity}×</span>
                          <span>
                            {entry.variant?.product?.name || 'Produk'}
                            {entry.variant?.name ? ` (${entry.variant.name})` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="parcel-pricing-box">
                  <strong className="current-price">Rp {price.toLocaleString('id-ID')}</strong>
                </div>

                <div className="parcel-card-footer">
                  <button type="button" className="btn btn-primary full" onClick={() => handleAddToCart(item)}>
                    Tambah ke Keranjang
                  </button>
                  <a href={waUrl} target="_blank" rel="noreferrer" className="btn btn-secondary full parcel-wa-btn">
                    Pesan via WhatsApp
                  </a>
                </div>
              </article>
            );
          })}
        </section>

        {!packages.length && <p className="catalog-empty">Belum ada paket acara aktif.</p>}

        <section className="parcel-cta">
          <div>
            <span className="eyebrow light">Butuh Paket Khusus?</span>
            <h2>Ceritakan kebutuhan acara dan anggaran Anda.</h2>
            <p>Kami siap membantu menyesuaikan isi paket untuk jumlah tamu dan jenis acara Anda.</p>
          </div>
          <a
            href={`https://wa.me/${storeWhatsappNumber}?text=Halo%20Glosir,%20saya%20ingin%20konsultasi%20paket%20acara`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            Konsultasi via WhatsApp
          </a>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
