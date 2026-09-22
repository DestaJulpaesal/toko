import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import CatalogImage from '../components/CatalogImage';
<<<<<<< HEAD
=======
import { PUBLIC_CATALOG_CACHE_KEY, stripSensitive } from '../utils/catalogStorage';
>>>>>>> cbd8857 (push fitur notifikasi email)

export default function ProductPage() {
  const { addItem, totalItems } = useCart();
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addedProduct, setAddedProduct] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  const { toggleFavorite, isFavorite } = useFavorites();
  const filters = ['Semua', 'Promo', ...new Set(products.map((product) => product.category).filter(Boolean))];

  useEffect(() => {
    try {
<<<<<<< HEAD
      const cachedProducts = JSON.parse(localStorage.getItem('glosir_products_cache') || '[]');
      if (Array.isArray(cachedProducts) && cachedProducts.length > 0) setProducts(cachedProducts);
=======
      const cachedProducts = JSON.parse(localStorage.getItem(PUBLIC_CATALOG_CACHE_KEY) || '[]');
      if (Array.isArray(cachedProducts) && cachedProducts.length > 0) setProducts(stripSensitive(cachedProducts));
>>>>>>> cbd8857 (push fitur notifikasi email)
    } catch {
      // Ignore an invalid local cache and use the API response.
    }

    Promise.all([apiFetch('/products'), apiFetch('/parcels'), apiFetch('/event-packages')])
      .then(async ([productResponse, parcelResponse, eventResponse]) => {
        const [productData, parcelData, eventData] = await Promise.all([productResponse.json(), parcelResponse.json(), eventResponse.json()]);
        const catalogProducts = productData.success && Array.isArray(productData.products) ? productData.products : [];
        const catalogParcels = parcelData.success && Array.isArray(parcelData.parcels) ? parcelData.parcels.map((parcel) => ({
          id: `parcel-${parcel.id}`,
          parcelId: parcel.id,
          name: parcel.name,
          category: parcel.type === 'CUSTOM' ? 'Acara' : 'Parsel',
          price: Number(parcel.price || 0),
          originalPrice: null,
          discountPercent: 0,
          badge: parcel.type === 'CUSTOM' ? 'Paket Acara' : 'Parsel',
          stock: null,
          description: parcel.description || 'Paket siap berbagi dari Glosir.',
          items: parcel.items || [],
          detailPath: '/parsel',
          imageUrl: parcel.imageUrl || null,
        })) : [];
        const catalogEvents = eventData.success && Array.isArray(eventData.packages) ? eventData.packages.map((item) => ({
          id: `event-${item.id}`,
          eventPackageId: item.id,
          name: item.name,
          category: 'Paket Acara',
          price: Number(item.price || 0),
          originalPrice: null,
          discountPercent: 0,
          badge: item.isCustom ? 'Custom Acara' : 'Paket Acara',
          stock: null,
          description: item.description || 'Paket kebutuhan acara pilihan Glosir.',
          items: (item.items || []).map((entry) => ({ id: entry.id, quantity: entry.quantity, productName: entry.variant?.product?.name, variantName: entry.variant?.name })),
          detailPath: '/paket-acara',
          imageUrl: item.imageUrl || null,
        })) : [];
        const merged = [...catalogProducts, ...catalogParcels, ...catalogEvents];
        setProducts(merged);
<<<<<<< HEAD
        localStorage.setItem('glosir_products_cache', JSON.stringify(merged));
=======
        localStorage.setItem(PUBLIC_CATALOG_CACHE_KEY, JSON.stringify(stripSensitive(merged)));
>>>>>>> cbd8857 (push fitur notifikasi email)
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
      return product.category === activeFilter;
    })
    .sort((first, second) => sort === 'low' ? first.price - second.price : sort === 'high' ? second.price - first.price : 0);

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
            <a href={`https://wa.me/${import.meta.env.VITE_STORE_WHATSAPP_NUMBER || ''}`} target="_blank" rel="noreferrer" className="btn btn-secondary">Pesan via WhatsApp</a>
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
              <Link to={product.detailPath || `/products/${product.id}`} className="catalog-image product-art-link">
                <CatalogImage src={product.imageUrl} alt={`Foto ${product.name}`}>
                  <><span className="product-art-label">{product.name.split(' ').slice(0, 2).join(' ')}</span><small>{product.category}</small></>
                </CatalogImage>
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
              {product.items?.length > 0 && (
                <ul className="catalog-package-items">
                  {product.items.slice(0, 4).map((entry) => (
                    <li key={entry.id}>{entry.quantity}× {entry.productName || entry.variant?.product?.name || 'Produk'}{entry.variantName || entry.variant?.name ? ` (${entry.variantName || entry.variant.name})` : ''}</li>
                  ))}
                  {product.items.length > 4 && <li>+{product.items.length - 4} item lainnya</li>}
                </ul>
              )}
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
                {product.stock !== null && <small>{product.stock} stok</small>}
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
