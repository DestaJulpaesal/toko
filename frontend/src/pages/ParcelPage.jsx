import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { useCart } from '../context/CartContext';
import CatalogImage from '../components/CatalogImage';

export default function ParcelPage() {
  const { addItem, totalItems } = useCart();
  const [packages, setPackages] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const loadParcels = async () => {
      try {
        const response = await apiFetch('/parcels');
        const data = await response.json();

        if (response.ok && data.success && Array.isArray(data.parcels)) {
          setPackages(
            data.parcels.map((parcel) => ({
              id: parcel.id,
              parcelId: parcel.id,
              name: parcel.name,
              category: parcel.type === 'CUSTOM' ? 'Acara' : 'Parsel',
              price: Number(parcel.price || 0),
              originalPrice: parcel.originalPrice ? Number(parcel.originalPrice) : null,
              discountPercent: 0,
              badge: parcel.type === 'CUSTOM' ? 'Custom' : 'Parsel',
              text: parcel.description || 'Paket yang dibuat sesuai kebutuhan pelanggan.',
              tag: parcel.type === 'CUSTOM' ? 'Custom Acara' : 'Best Seller',
              artClass: parcel.type === 'CUSTOM' ? 'purple' : 'warm',
              imageUrl: parcel.imageUrl || null,
              items: parcel.items || [],
            }))
          );
        }
      } catch {
        setPackages([]);
      }
    };

    loadParcels();
  }, []);

  const handleAddToCart = (item) => {
    addItem(item);
    setToastMessage(`✓ "${item.name}" berhasil ditambahkan ke keranjang!`);
    setTimeout(() => setToastMessage(''), 3500);
  };

  return (
    <div className="public-page">
      <PublicHeader />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="cart-toast" role="status">
          <span className="toast-check">✓</span>
          <span><strong>{toastMessage}</strong></span>
          <Link to="/cart">Lihat keranjang ({totalItems})</Link>
          <button onClick={() => setToastMessage('')} aria-label="Tutup notifikasi">×</button>
        </div>
      )}

      <main className="parcel-page-shell">
        <section className="inner-hero parcel-hero">
          <div>
            <span className="eyebrow dark">Parsel Glosir</span>
            <h1>Paket Parsel Siap Berbagi dengan Diskon Spesial.</h1>
          </div>
          <div>
            <p>
              Mulai dari parcel keluarga hingga hampers hari raya.
              Semua dikemas rapi, berkualitas, dan hemat untuk dibagikan.
            </p>
            <div className="parcel-hero-actions">
              <a href={`https://wa.me/${import.meta.env.VITE_STORE_WHATSAPP_NUMBER || ''}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
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
            const savings = item.originalPrice - item.price;
            const waUrl = `https://wa.me/${import.meta.env.VITE_STORE_WHATSAPP_NUMBER || ''}?text=${encodeURIComponent(
              `Halo Toko Glosir, saya ingin pesan *${item.name}* dengan harga promo Rp ${item.price.toLocaleString('id-ID')} (Diskon ${item.discountPercent}%). Mohon info stok dan pengirimannya ya.`
            )}`;

            return (
              <article key={item.id} className="parcel-feature-card">
                <div className={`parcel-art parcel-art-${item.artClass}`}>
                  <CatalogImage src={item.imageUrl} alt={`Foto ${item.name}`}>
                    <><div className="parcel-art-content"><span>GLOSIR</span><small>{item.tag}</small></div>{item.discountPercent > 0 && <div className="parcel-art-discount-badge">-{item.discountPercent}%</div>}</>
                  </CatalogImage>
                </div>

                <div className="catalog-badges-wrap">
                  <span className="catalog-badge">{item.badge}</span>
                  {item.discountPercent > 0 && <span className="discount-tag">-{item.discountPercent}%</span>}
                </div>

                <h2>{item.name}</h2>
                <p>{item.text}</p>
                {item.items.length > 0 && (
                  <div className="parcel-contents">
                    <strong>Isi paket</strong>
                    <ul>
                      {item.items.map((entry) => (
                        <li key={entry.id}>
                          <span className="parcel-item-quantity">{entry.quantity}×</span>
                          <span>{entry.productName || 'Produk'}{entry.variantName ? ` (${entry.variantName})` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="parcel-pricing-box">
                  <div className="price-stack">
                    <strong className="current-price">Rp {item.price.toLocaleString('id-ID')}</strong>
                    {item.originalPrice && item.originalPrice > item.price && <div className="original-price-row">
                      <del className="original-price">Rp {item.originalPrice.toLocaleString('id-ID')}</del>
                      <span className="save-pill">Hemat Rp {savings.toLocaleString('id-ID')}</span>
                    </div>}
                  </div>
                </div>

                <div className="parcel-card-footer">
                  <button
                    className="btn btn-primary full"
                    onClick={() => handleAddToCart(item)}
                  >
                    Tambah ke Keranjang
                  </button>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary full parcel-wa-btn"
                  >
                    Pesan via WhatsApp
                  </a>
                </div>
              </article>
            );
          })}
        </section>

        <section className="parcel-cta">
          <div>
            <span className="eyebrow light">Butuh Kustomisasi?</span>
            <h2>Ceritakan kebutuhan parcel dan anggaran Anda.</h2>
            <p>Kami siap membantu menyesuaikan komposisi parcel sesuai anggaran dan selera Anda.</p>
          </div>
          <a
            href={`https://wa.me/${import.meta.env.VITE_STORE_WHATSAPP_NUMBER || ''}?text=Halo%20Glosir,%20saya%20butuh%20konsultasi%20custom%20paket%20parcel%20dan%20hajatan`}
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
