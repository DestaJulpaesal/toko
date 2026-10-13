import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, MessageCircle, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { PUBLIC_CATALOG_CACHE_KEY, readJsonStorage, stripSensitive } from '../utils/catalogStorage';
import { showSuccess } from '../utils/noticeService';

function readCachedProduct(id) {
  const products = readJsonStorage(localStorage, PUBLIC_CATALOG_CACHE_KEY, []);
  return Array.isArray(products)
    ? stripSensitive(products).find((product) => product.id === id) || null
    : null;
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState(() => readCachedProduct(id));
  const [loading, setLoading] = useState(() => !readCachedProduct(id));
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const cachedProduct = readCachedProduct(id);

    setProduct(cachedProduct);
    setLoading(!cachedProduct);
    setError('');
    setQuantity(1);

    apiFetch(`/products/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data?.success || !data.product) {
          throw new Error(data?.message || `Produk gagal dimuat (${response.status})`);
        }
        if (!cancelled) {
          const freshProduct = stripSensitive(data.product);
          setProduct(freshProduct);
          const freshStock = Math.max(0, Number(freshProduct.stock || 0));
          if (freshStock > 0) setQuantity((current) => Math.min(current, freshStock));
        }
      })
      .catch((requestError) => {
        console.error('Product detail failed to load:', requestError);
        if (cancelled) return;
        if (!cachedProduct) setError(requestError.message || 'Detail produk gagal dimuat.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const availableStock = Math.max(0, Number(product?.stock || 0));
  const canAddToCart = Boolean(product) && availableStock > 0;
  const discountPercent = product?.discountPercent
    || (product?.originalPrice > product?.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0);

  const addToCart = () => {
    const quantityToAdd = Math.min(quantity, availableStock);
    for (let index = 0; index < quantityToAdd; index += 1) addItem(product);
    showSuccess(`${quantityToAdd} ${product.name} dimasukkan ke keranjang`);
  };

  if (!product && loading) {
    return (
      <div className="public-page">
        <PublicHeader />
        <main className="detail-empty detail-state" role="status">
          <span className="detail-state-icon"><ShoppingBag size={23} /></span>
          <strong>Menyiapkan detail produk</strong>
          <span className="detail-state-message">Sebentar ya, kami sedang memuat informasinya.</span>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="public-page">
        <PublicHeader />
        <main className="detail-empty detail-state">
          <span className="detail-state-icon"><ShoppingBag size={23} /></span>
          <h1>{error ? 'Detail produk belum bisa dimuat' : 'Produk tidak ditemukan'}</h1>
          {error && <p className="detail-state-message">{error}</p>}
          <Link to="/products" className="btn btn-primary">Kembali ke produk</Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="detail-shell">
        <div className="detail-breadcrumb">
          <Link to="/">Beranda</Link><span>/</span><Link to="/products">Produk</Link><span>/</span>
          <span className="detail-breadcrumb-current">{product.name}</span>
        </div>
        <section className="detail-layout">
          <div className="detail-product-media">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} />
            ) : (
              <div className="detail-product-placeholder" aria-label={`Foto ${product.name} belum tersedia`}>
                <span className="detail-placeholder-icon"><ShoppingBag size={34} strokeWidth={1.5} /></span>
                <strong>Foto produk belum tersedia</strong>
              </div>
            )}
            {discountPercent > 0 && <span className="detail-image-discount">Diskon {discountPercent}%</span>}
          </div>
          <div className="detail-copy">
            <div className="detail-category-row">
              <span className="detail-category-chip">{product.category}</span>
              <span className={`detail-availability${availableStock === 0 ? ' unavailable' : ''}`}>
                <span />
                {availableStock > 0 ? 'Tersedia' : 'Stok habis'}
              </span>
            </div>
            <h1>{product.name}</h1>
            <p className="detail-short-note">Informasi harga dan ketersediaan produk.</p>
            <div className="detail-price-box">
              <span className="detail-price-caption">Harga produk</span>
              <strong className="detail-price">Rp {Number(product.price || 0).toLocaleString('id-ID')}</strong>
              {product.originalPrice > product.price && (
                <div className="detail-discount-row">
                  <del className="original-price">Rp {Number(product.originalPrice).toLocaleString('id-ID')}</del>
                  <span className="save-pill">
                    Hemat Rp {(Number(product.originalPrice) - Number(product.price)).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>
            <p className="detail-description">
              {product.description || `Produk ${product.name} tersedia di kategori ${product.category || 'Glosir'}.`}
            </p>
            <div className="detail-stock-card">
              <span className={`detail-stock-icon${availableStock === 0 ? ' is-out-of-stock' : ''}`}>
                {availableStock > 0 ? <Check size={16} /> : <span className="stock-dot is-unavailable" />}
              </span>
              <span>
                <strong>{availableStock > 0 ? 'Stok tersedia' : 'Stok sedang habis'}</strong>
                <small>{availableStock > 0 ? `${availableStock} produk siap dipesan` : 'Coba cek kembali nanti'}</small>
              </span>
            </div>
            <div className="detail-actions">
              <label className="detail-quantity-label">
                <span>Jumlah</span>
                <span className="quantity-stepper" aria-label="Jumlah produk">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    aria-label="Kurangi jumlah"
                    disabled={quantity <= 1}
                  >
                    <Minus size={15} />
                  </button>
                  <strong aria-live="polite">{quantity}</strong>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(availableStock, value + 1))}
                    aria-label="Tambah jumlah"
                    disabled={quantity >= availableStock}
                  >
                    <Plus size={15} />
                  </button>
                </span>
              </label>
              <button className="btn btn-primary detail-add-button" onClick={addToCart} disabled={!canAddToCart}>
                <ShoppingBag size={18} />
                {availableStock > 0 ? 'Tambah ke keranjang' : 'Stok habis'}
              </button>
            </div>
            {loading && <p className="detail-refresh-note" role="status">Memperbarui informasi produk...</p>}
            <a href={`https://wa.me/${import.meta.env.VITE_STORE_WHATSAPP_NUMBER || ''}?text=${encodeURIComponent(`Halo Glosir, saya ingin bertanya tentang ${product.name}.`)}`} target="_blank" rel="noreferrer" className="detail-whatsapp">
              <span className="detail-whatsapp-mark"><MessageCircle size={16} /></span>
              <span><strong>Butuh info lebih lanjut?</strong><small>Tanyakan produk ini lewat WhatsApp</small></span>
              <ArrowLeft size={16} className="detail-whatsapp-arrow" />
            </a>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
