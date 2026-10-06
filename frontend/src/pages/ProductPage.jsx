import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import CatalogImage from '../components/CatalogImage';
import { PUBLIC_CATALOG_CACHE_KEY, stripSensitive } from '../utils/catalogStorage';
import { buildProductShareUrl, shareProduct } from '../utils/shareLink';
import { 
  Search, 
  Star, 
  ShoppingCart, 
  Check, 
  X, 
  MessageCircle, 
  Sparkles, 
  ShoppingBag, 
  SlidersHorizontal,
  PackageCheck,
  Share2,
} from 'lucide-react';

export default function ProductPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const { addItem, totalItems } = useCart();
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addedProduct, setAddedProduct] = useState('');
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState('default');
  const { toggleFavorite, isFavorite } = useFavorites();
  const filters = ['Semua', 'Promo', ...new Set(products.map((product) => product.category).filter(Boolean))];

  useEffect(() => {
    try {
      const cachedProducts = JSON.parse(localStorage.getItem(PUBLIC_CATALOG_CACHE_KEY) || '[]');
      if (Array.isArray(cachedProducts) && cachedProducts.length > 0) setProducts(stripSensitive(cachedProducts));
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
        localStorage.setItem(PUBLIC_CATALOG_CACHE_KEY, JSON.stringify(stripSensitive(merged)));
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
            <span className="eyebrow-pill emerald"><ShoppingBag className="w-3.5 h-3.5 inline mr-1" /> Katalogue Retail & Wholesale</span>
            <h1 className="catalog-main-heading">Katalog Produk & Parsel Glosir</h1>
            <p className="catalog-subheading">Temukan kebutuhan harian, sembako, parsel hampers, dan paket acara dengan harga grosir terbaik.</p>
          </div>
          <div className="catalog-actions">
            <a href={`https://wa.me/${import.meta.env.VITE_STORE_WHATSAPP_NUMBER || ''}`} target="_blank" rel="noreferrer" className="btn btn-secondary shadow-sm">
              <MessageCircle className="w-4 h-4 inline mr-1.5 text-emerald-600" /> Pesan via WA
            </a>
            <Link to="/cart" className="btn btn-primary shadow-md">
              <ShoppingCart className="w-4 h-4 inline mr-1.5" /> Keranjang ({totalItems})
            </Link>
          </div>
        </header>

        {/* Filter Pills */}
        <div className="filter-row">
          {filters.map((filter) => (
            <button 
              key={filter} 
              onClick={() => setActiveFilter(filter)} 
              className={`filter-pill-btn ${filter === activeFilter ? 'active' : ''}`}
            >
              {filter === 'Promo' && <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-500" />}
              {filter}
            </button>
          ))}
        </div>

        {/* Catalog Tools: Search & Sort */}
        <div className="catalog-tools">
          <div className="catalog-search-bar">
            <Search className="catalog-search-icon" />
            <input 
              value={search} 
              onChange={(event) => setSearch(event.target.value)} 
              placeholder="Cari nama produk, kategori, atau parsel..." 
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch('')}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="catalog-sort-box">
            <SlidersHorizontal className="w-4 h-4 text-gray-500 mr-2" />
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Urutkan produk">
              <option value="default">Urutkan: Rekomendasi</option>
              <option value="low">Harga Terendah</option>
              <option value="high">Harga Tertinggi</option>
            </select>
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="catalog-grid">
          {visibleProducts.map((product) => (
            <article key={product.id} className="catalog-card">
              <button 
                className={`favorite-button ${isFavorite(product.id) ? 'active' : ''}`} 
                onClick={() => toggleFavorite(product)} 
                aria-label="Simpan produk"
              >
                <Star className={`w-4 h-4 ${isFavorite(product.id) ? 'fill-amber-400 text-amber-500' : 'text-gray-400'}`} />
              </button>
              <button
                type="button"
                className="favorite-button share-button"
                onClick={async () => {
                  await shareProduct(product);
                  setAddedProduct(`${product.name} link terbagi`);
                }}
                aria-label="Bagikan produk"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
              </button>
              
              <Link to={product.detailPath || `/products/${product.id}`} className="catalog-image product-art-link">
                <CatalogImage src={product.imageUrl} alt={`Foto ${product.name}`}>
                  <><span className="product-art-label">{product.name.split(' ').slice(0, 2).join(' ')}</span><small>{product.category}</small></>
                </CatalogImage>
              </Link>
              
              <div className="catalog-badges-wrap">
                {product.badge && <span className="catalog-badge">{product.badge}</span>}
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="discount-tag">
                    -{product.discountPercent || Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                  </span>
                )}
              </div>

              <Link to={`/products/${product.id}`} className="catalog-title-link">
                <h3>{product.name}</h3>
              </Link>
              <span className="catalog-category-name">{product.category}</span>
              
              {product.items?.length > 0 && (
                <ul className="catalog-package-items">
                  {product.items.slice(0, 4).map((entry) => (
                    <li key={entry.id}>
                      <PackageCheck className="w-3 h-3 text-emerald-600 inline mr-1" />
                      {entry.quantity}× {entry.productName || entry.variant?.product?.name || 'Produk'}{entry.variantName || entry.variant?.name ? ` (${entry.variantName || entry.variant.name})` : ''}
                    </li>
                  ))}
                  {product.items.length > 4 && <li className="more-items">+{product.items.length - 4} item lainnya</li>}
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
                {product.stock !== null && <small className="stock-label">{product.stock} stok tersedia</small>}
              </div>

              <div className="catalog-actions-row">
                <button className="btn btn-primary full catalog-add-btn" onClick={() => { addItem(product); setAddedProduct(product.name); }}>
                  <ShoppingCart className="w-4 h-4 inline mr-1.5" /> Tambah Ke Keranjang
                </button>
              </div>
            </article>
          ))}
        </div>

        {loading && <div className="catalog-empty loading-state">Memuat katalog produk...</div>}
        {!loading && visibleProducts.length === 0 && (
          <div className="catalog-empty">
            <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">Belum ada produk yang cocok dengan pencarian Anda.</p>
            <p className="text-sm text-gray-500">Coba ubah kata kunci atau pilih filter kategori lain.</p>
          </div>
        )}
        
        {addedProduct && (
          <div className="cart-toast" role="status">
            <Check className="w-5 h-5 text-emerald-600" />
            <span><strong>{addedProduct}</strong> ditambahkan ke keranjang.</span>
            <Link to="/cart" className="toast-link">Lihat keranjang</Link>
            <button onClick={() => setAddedProduct('')} aria-label="Tutup notifikasi" className="toast-close">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}
