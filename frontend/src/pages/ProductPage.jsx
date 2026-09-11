import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';

const filters = ['Semua', 'Glosir', 'Parsel', 'Promo', 'Hajatan'];

export default function ProductPage() {
  const { addItem, totalItems } = useCart();
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addedProduct, setAddedProduct] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const { toggleFavorite, isFavorite } = useFavorites();

  useEffect(() => {
    try {
      const cachedProducts = JSON.parse(localStorage.getItem('glosir_products_cache') || '[]');
      if (Array.isArray(cachedProducts) && cachedProducts.length > 0) setProducts(cachedProducts);
    } catch {
      // Ignore an invalid local cache and use the API response.
    }

    apiFetch('/products')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Product API unavailable'))))
      .then((data) => {
        if (data.success && Array.isArray(data.products)) {
          setProducts(data.products);
          localStorage.setItem('glosir_products_cache', JSON.stringify(data.products));
        } else {
          setProducts([]);
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleProducts = products
    .filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) || product.category.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (activeFilter === 'Semua') return true;
      if (activeFilter === 'Promo') {
        const hasDiscount = (product.originalPrice && product.originalPrice > product.price) || (product.discountPercent && product.discountPercent > 0);
        return hasDiscount || product.badge?.toLowerCase().includes('promo') || product.badge?.toLowerCase().includes('diskon');
      }
      if (activeFilter === 'Hajatan') return product.category === 'Acara';
      return product.category === activeFilter;
    })
    .sort((first, second) => sort === 'low' ? first.price - second.price : sort === 'high' ? second.price - first.price : first.id - second.id);

  return (
    <div className="public-page">
      <PublicHeader />
      <div className="catalog-shell">
        <header className="catalog-header">
          <div>
            <p className="eyebrow dark">Katalog</p>
            <h1>Produk Glosir & Parcel</h1>
          </div>
          <div className="catalog-actions">
            <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer" className="btn btn-secondary">Pesan via WhatsApp</a>
            <Link to="/cart" className="btn btn-primary">Keranjang ({totalItems})</Link>
          </div>
        </header>

        <div className="filter-row">
          {filters.map((filter) => (
            <button key={filter} onClick={() => setActiveFilter(filter)} className={`btn ${filter === activeFilter ? 'btn-primary' : 'btn-secondary'}`}>
              {filter}
            </button>
          ))}
        </div>

        <div className="catalog-tools">
          <label className="catalog-search"><span>cari</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk atau kategori..." /></label>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Urutkan produk">
            <option value="default">Urutkan: Rekomendasi</option>
            <option value="low">Harga terendah</option>
            <option value="high">Harga tertinggi</option>
          </select>
        </div>

        <div className="catalog-grid">
          {visibleProducts.map((product) => (
            <article key={product.id} className="catalog-card">
              <button className={`favorite-button ${isFavorite(product.id) ? 'active' : ''}`} onClick={() => toggleFavorite(product)} aria-label="Simpan produk">{isFavorite(product.id) ? '★' : '☆'}</button>
              <Link to={`/products/${product.id}`} className="catalog-image product-art-link">
                <span className="product-art-label">{product.name.split(' ').slice(0, 2).join(' ')}</span>
                <small>{product.category}</small>
              </Link>
              <div className="catalog-badges-wrap">
                <span className="catalog-badge">{product.badge}</span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="discount-tag">
                    -{product.discountPercent || Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                  </span>
                )}
              </div>
              <Link to={`/products/${product.id}`} className="catalog-title-link"><h3>{product.name}</h3></Link>
              <p>{product.category}</p>
              <div className="catalog-meta">
                <div className="price-stack">
                  <strong className="current-price">Rp {product.price.toLocaleString('id-ID')}</strong>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <div className="original-price-row">
                      <del className="original-price">Rp {product.originalPrice.toLocaleString('id-ID')}</del>
                      <span className="save-pill">Hemat Rp {(product.originalPrice - product.price).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>
                <small>{product.stock} stok</small>
              </div>
              <button className="btn btn-primary full" onClick={() => { addItem(product); setAddedProduct(product.name); }}>
                Tambah ke keranjang
              </button>
            </article>
          ))}
        </div>
        {loading && <div className="catalog-empty loading-state">Memuat katalog produk...</div>}
        {!loading && visibleProducts.length === 0 && <div className="catalog-empty">Belum ada produk di kategori ini.</div>}
        {addedProduct && <div className="cart-toast" role="status"><span className="toast-check">x</span><span><strong>{addedProduct}</strong> ditambahkan ke keranjang.</span><Link to="/cart">Lihat keranjang</Link><button onClick={() => setAddedProduct('')} aria-label="Tutup notifikasi">x</button></div>}
      </div>
      <PublicFooter />
    </div>
  );
}
