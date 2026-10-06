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
  const [customProducts, setCustomProducts] = useState([]);
  const [customQuantities, setCustomQuantities] = useState({});
  const [customOpen, setCustomOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const loadPackages = async () => {
      try {
        const [packagesResponse, productsResponse] = await Promise.all([
          apiFetch('/event-packages'),
          apiFetch('/products'),
        ]);
        const data = await packagesResponse.json();
        const productsData = await productsResponse.json();
        if (packagesResponse.ok && data.success && Array.isArray(data.packages)) setPackages(data.packages);
        if (productsResponse.ok && productsData.success && Array.isArray(productsData.products)) {
          const availableProducts = productsData.products.flatMap((product) => (product.variants?.length
            ? product.variants.map((variant) => ({
              id: variant.id,
              name: `${product.name}${variant.name ? ` (${variant.name})` : ''}`,
              price: Number(variant.price || 0),
              stock: Number(variant.stock || 0),
              sku: variant.sku || product.sku,
              category: product.category,
            }))
            : [{
              id: product.variantId || product.id,
              name: product.name,
              price: Number(product.price || 0),
              stock: Number(product.stock || 0),
              sku: product.sku,
              category: product.category,
            }]));
          setCustomProducts(availableProducts.filter((product) => (
            product.stock > 0
            && !['parsel', 'acara'].includes(String(product.category || '').trim().toLowerCase())
          )));
        }
      } catch {
        setPackages([]);
        setCustomProducts([]);
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

  const customItems = customProducts
    .filter((product) => Number(customQuantities[product.id] || 0) > 0)
    .map((product) => ({ ...product, quantity: Number(customQuantities[product.id]) }));
  const customTotal = customItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const customWhatsAppUrl = `https://wa.me/${storeWhatsappNumber}?text=${encodeURIComponent([
    'Halo Toko Glosir, saya ingin memesan Custom Paket Acara.',
    '',
    ...customItems.map((item, index) => `${index + 1}. ${item.name} — ${item.quantity} ${item.quantity === 1 ? 'unit' : 'unit'} × Rp ${item.price.toLocaleString('id-ID')}`),
    '',
    `Estimasi total: Rp ${customTotal.toLocaleString('id-ID')}`,
    'Mohon konfirmasi ketersediaan dan detail pesanan saya.',
  ].join('\n'))}`;

  const updateCustomQuantity = (product, value) => {
    const quantity = Math.min(Math.max(Number.parseInt(value, 10) || 0, 0), product.stock);
    setCustomQuantities((current) => ({ ...current, [product.id]: quantity }));
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
          <article className="parcel-feature-card event-custom-card">
            <div className="parcel-art parcel-art-green">
              <div className="parcel-art-content"><span>GLOSIR</span><small>CUSTOM ACARA</small></div>
            </div>
            <div className="catalog-badges-wrap"><span className="catalog-badge">Custom Paket Acara</span></div>
            <h2>Susun Paket Acara Sendiri</h2>
            <p>Pilih produk biasa sesuai kebutuhan acara. Harga yang tampil adalah harga public dan hanya produk dengan stok tersedia yang ditampilkan.</p>
            <div className="parcel-card-footer">
              <button type="button" className="btn btn-primary full" onClick={() => setCustomOpen((current) => !current)}>
                {customOpen ? 'Tutup Pilihan Produk' : 'Pilih Produk Custom'}
              </button>
            </div>
          </article>

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

        {customOpen && (
          <section className="event-custom-builder" aria-labelledby="custom-package-title">
            <div className="event-custom-builder-head">
              <div><span className="eyebrow dark">Custom Paket Acara</span><h2 id="custom-package-title">Pilih isi paket sendiri</h2><p>Atur jumlah produk sesuai kebutuhan. Stok maksimal ditampilkan di setiap produk.</p></div>
              <strong>Estimasi Rp {customTotal.toLocaleString('id-ID')}</strong>
            </div>
            <div className="event-custom-products">
              {customProducts.map((product) => (
                <label key={product.id} className={`event-custom-product${customQuantities[product.id] ? ' selected' : ''}`}>
                  <span><strong>{product.name}</strong><small>{product.category || 'Produk'} · stok {product.stock} · Rp {product.price.toLocaleString('id-ID')}</small></span>
                  <input type="number" min="0" max={product.stock} value={customQuantities[product.id] || ''} onChange={(event) => updateCustomQuantity(product, event.target.value)} placeholder="0" aria-label={`Jumlah ${product.name}`} />
                </label>
              ))}
              {!customProducts.length && <p className="catalog-empty">Belum ada produk biasa dengan stok tersedia.</p>}
            </div>
            <div className="event-custom-builder-actions">
              <span>{customItems.length} produk dipilih</span>
              <a className={`btn btn-primary${customItems.length ? '' : ' disabled'}`} href={customItems.length ? customWhatsAppUrl : undefined} onClick={(event) => { if (!customItems.length) event.preventDefault(); }} target="_blank" rel="noreferrer">Kirim Custom ke WhatsApp →</a>
            </div>
          </section>
        )}

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
