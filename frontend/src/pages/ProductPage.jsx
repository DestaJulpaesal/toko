import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import CatalogImage from '../components/CatalogImage';
import ProductCard from '../components/ProductCard';
import { PUBLIC_CATALOG_CACHE_KEY, stripSensitive } from '../utils/catalogStorage';
<<<<<<< HEAD
import { showSuccess } from '../utils/noticeService';
import { Search } from 'lucide-react';

const CATEGORY_META = {
  'Semua': {
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=64&q=80',
    icon: '🏪',
  },
  'Promo': {
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=64&q=80',
    icon: '🏷️',
  },
  'Glosir': {
    image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=64&q=80',
    icon: '🛒',
  },
  'Kebutuhan Dapur': {
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=64&q=80',
    icon: '🍳',
  },
  'Minuman': {
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=64&q=80',
    icon: '☕',
  },
  'Bahan Pokok': {
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=64&q=80',
    icon: '🌾',
  },
  'Acara': {
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=64&q=80',
    icon: '🎉',
  },
  'Parsel': {
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=64&q=80',
    icon: '🎁',
  },
  'Paket Acara': {
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=64&q=80',
    icon: '📦',
  },
};

export default function ProductPage() {
  const [searchParams] = useSearchParams();
=======
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
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
  const { addItem, totalItems } = useCart();
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
<<<<<<< HEAD
  const [search, setSearch] = useState(searchParams.get('search') || '');
=======
  const [addedProduct, setAddedProduct] = useState('');
  const [search, setSearch] = useState(initialSearch);
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
  const [sort, setSort] = useState('default');
  const { toggleFavorite, isFavorite } = useFavorites();
  const filters = ['Semua', 'Promo', ...new Set(products.map((product) => product.category).filter(Boolean))];

  useEffect(() => {
    const query = searchParams.get('search');
    if (query !== null) {
      setSearch(query);
    }
  }, [searchParams]);

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
          unit: 'Paket',
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
          unit: 'Paket',
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

  const handleAddToCart = (product) => {
    addItem(product);
    showSuccess(`${product.name} dimasukkan ke keranjang`);
  };

  return (
    <div className="glosir-public-page">
      <PublicHeader />
      <div className="catalog-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
<<<<<<< HEAD
            <span style={{ fontSize: '0.85rem', color: '#1f7a4a', fontWeight: 800, textTransform: 'uppercase' }}>Katalog Produk</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#111827', margin: '4px 0 0' }}>Belanja Grosir & Eceran</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/cart" className="btn btn-primary" style={{ minHeight: '44px', fontWeight: 700, borderRadius: '12px' }}>
              Keranjang ({totalItems})
=======
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
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
            </Link>
          </div>
        </header>

<<<<<<< HEAD
        {/* Filter Kategori Tabs */}
        <div className="filter-row flex gap-2 overflow-x-auto pb-3 mb-4" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
          {filters.map((filter) => {
            const meta = CATEGORY_META[filter] || { icon: '🛍️' };
            const isActive = filter === activeFilter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border-none cursor-pointer ${
                  isActive ? 'bg-[#1f7a4a] text-white font-bold shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '999px',
                  fontSize: '0.92rem',
                  fontWeight: isActive ? 800 : 600,
                  background: isActive ? '#1f7a4a' : '#f3f4f6',
                  color: isActive ? '#ffffff' : '#374151',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  boxShadow: isActive ? '0 2px 6px rgba(31, 122, 74, 0.25)' : 'none',
                }}
              >
                {/* Thumbnail Gambar / Ikon Bulat */}
                <span
                  className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-200"
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'rgba(255, 255, 255, 0.25)' : '#e5e7eb',
                    fontSize: '0.8rem',
                  }}
                >
                  {meta.image ? (
                    <img
                      src={meta.image}
                      alt=""
                      className="w-full h-full object-cover rounded-full"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.nextElementSibling) {
                          e.currentTarget.nextElementSibling.style.display = 'inline';
                        }
                      }}
                    />
                  ) : null}
                  <span style={{ display: meta.image ? 'none' : 'inline', lineHeight: 1 }}>
                    {meta.icon || '🛍️'}
                  </span>
                </span>
                <span>{filter}</span>
              </button>
            );
          })}
        </div>

        {/* Pencarian & Urutan */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama barang..."
              style={{
                width: '100%',
                height: '46px',
                paddingLeft: '40px',
                paddingRight: '14px',
                borderRadius: '12px',
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Urutkan produk"
            style={{
              height: '46px',
              padding: '0 16px',
              borderRadius: '12px',
              border: '1px solid #d1d5db',
              fontSize: '0.92rem',
              background: '#ffffff',
            }}
          >
            <option value="default">Urutkan: Rekomendasi</option>
            <option value="low">Harga Termurah</option>
            <option value="high">Harga Tertinggi</option>
          </select>
        </div>

        {/* Grid Produk Style FreshMart: Gambar Besar, Harga Jelas, Tombol Tambah Besar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isFavorited={isFavorite(product.id)}
              onToggleFavorite={toggleFavorite}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#6b7280' }}>
            Memuat katalog produk...
          </div>
        )}

        {!loading && visibleProducts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#6b7280' }}>
            Belum ada produk yang cocok dengan pencarian.
=======
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
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
          </div>
        )}
      </div>
      <PublicFooter />
    </div>
  );
}

