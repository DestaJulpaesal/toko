import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import CatalogImage from '../components/CatalogImage';
import ProductCard from '../components/ProductCard';
<<<<<<< HEAD
import { PUBLIC_CATALOG_CACHE_KEY, categoriesFromProducts, stripSensitive } from '../utils/catalogStorage';
=======
import { PUBLIC_CATALOG_CACHE_KEY, stripSensitive } from '../utils/catalogStorage';
<<<<<<< HEAD
>>>>>>> c2ec320499ee90c945e8fad84d2b37f5f3c754b8
import { showSuccess } from '../utils/noticeService';
import { ChevronRight, Search } from 'lucide-react';

const CATEGORY_META = {
  'Glosir': {
    image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=64&q=80',
    icon: '🛒',
  },
  'Kebutuhan Dapur': {
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=64&q=80',
    icon: '🍳',
  },
  'Buah & Sayuran': { icon: '🍎' },
  'Buah dan Sayuran': { icon: '🍎' },
  'Sayur & Buah': { icon: '🥬' },
  'Susu & Telur': { icon: '🥛' },
  'Roti & Kue': { icon: '🥐' },
  'Daging & Ikan': { icon: '🐟' },
  'Minuman': {
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=64&q=80',
    icon: '☕',
  },
  'Bahan Pokok': {
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=64&q=80',
    icon: '🌾',
  },
  'Camilan': { icon: '🍪' },
  'Makanan Ringan': { icon: '🍿' },
  'Perawatan Rumah': { icon: '🧹' },
  'Rumah Tangga': { icon: '🧹' },
  'Sabun & Kebersihan': { icon: '🧼' },
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
  const [activeFilter, setActiveFilter] = useState(searchParams.get('category') || '');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
<<<<<<< HEAD
  const [search, setSearch] = useState(searchParams.get('search') || '');
=======
  const [addedProduct, setAddedProduct] = useState('');
  const [search, setSearch] = useState(initialSearch);
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
  const [sort, setSort] = useState('default');
  const { toggleFavorite, isFavorite } = useFavorites();
  const filters = categories.map((cat) => cat.name);

  useEffect(() => {
    const query = searchParams.get('search');
    setSearch(query || '');
    setActiveFilter(searchParams.get('category') || '');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    let categoriesLoaded = false;
    let catalogForCategories = [];

    try {
      const cachedProducts = JSON.parse(localStorage.getItem(PUBLIC_CATALOG_CACHE_KEY) || '[]');
      if (Array.isArray(cachedProducts) && cachedProducts.length > 0) {
        catalogForCategories = stripSensitive(cachedProducts);
        setProducts(catalogForCategories);
      }
    } catch {
      // Ignore an invalid local cache and use the API response.
    }

    const fetchJson = async (path) => {
      const response = await apiFetch(path);
      if (!response.ok) throw new Error(`${path} gagal dimuat (${response.status})`);
      return response.json();
    };

    fetchJson('/categories/public/list')
      .then((data) => {
        if (!cancelled) {
          const remoteCategories = data?.success && Array.isArray(data.categories) ? data.categories : [];
          categoriesLoaded = true;
          setCategories(remoteCategories.length > 0 ? remoteCategories : categoriesFromProducts(catalogForCategories));
        }
      })
      .catch((error) => {
        console.error('Catalog category list failed:', error);
        categoriesLoaded = true;
        if (!cancelled) setCategories(categoriesFromProducts(catalogForCategories));
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });

    Promise.allSettled([
      fetchJson('/products'),
      fetchJson('/parcels'),
      fetchJson('/event-packages'),
    ])
      .then((results) => {
        if (cancelled) return;

        const [productResult, parcelResult, eventResult] = results;
        const productData = productResult.status === 'fulfilled' ? productResult.value : null;
        const parcelData = parcelResult.status === 'fulfilled' ? parcelResult.value : null;
        const eventData = eventResult.status === 'fulfilled' ? eventResult.value : null;

        if (!productData && !parcelData && !eventData) {
          console.error('Catalog products, parcels, and event packages failed to load.', results);
          return;
        }

        const catalogProducts = productData?.success && Array.isArray(productData.products) ? productData.products : [];
        const catalogParcels = parcelData?.success && Array.isArray(parcelData.parcels) ? parcelData.parcels.map((parcel) => ({
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
        const catalogEvents = eventData?.success && Array.isArray(eventData.packages) ? eventData.packages.map((item) => ({
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
        catalogForCategories = merged;
        setProducts(merged);
        if (!categoriesLoaded) setCategories(categoriesFromProducts(merged));
        localStorage.setItem(PUBLIC_CATALOG_CACHE_KEY, JSON.stringify(stripSensitive(merged)));
      })
      .catch((error) => console.error('Catalog content failed:', error))
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleProducts = products
    .filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) || product.category.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (!activeFilter) return true;
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
      <main className="catalog-shell" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
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
        <section className="glosir-category-section catalog-category-section" aria-labelledby="catalog-category-heading">
          <div className="section-title-wrap">
            <h2 id="catalog-category-heading">Kategori Belanja</h2>
            <button type="button" className="view-all-link catalog-view-all" onClick={() => setActiveFilter('')}>
              Lihat Semua <ChevronRight size={16} />
            </button>
          </div>
          <div className="category-browse-grid" aria-label="Pilih kategori produk">
            {categoriesLoading && <p className="category-loading" role="status">Memuat kategori...</p>}
            {!categoriesLoading && filters.map((filter) => {
              const meta = CATEGORY_META[filter] || { icon: '🛍️' };
              const isActive = filter === activeFilter;
=======
<<<<<<< HEAD
        {/* Filter Kategori Tabs */}
        <div className="filter-row flex gap-2 overflow-x-auto pb-3 mb-4" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
          {filters.map((filter) => {
            const meta = CATEGORY_META[filter] || { icon: '🛍️' };
            const isActive = filter === activeFilter;
>>>>>>> c2ec320499ee90c945e8fad84d2b37f5f3c754b8

              return (
                <button
                  key={filter}
                  type="button"
                  className={`category-big-card${isActive ? ' is-active' : ''}`}
                  onClick={() => setActiveFilter(isActive ? '' : filter)}
                  aria-pressed={isActive}
                  aria-label={`Tampilkan produk kategori ${filter}`}
                >
                  <span className="category-icon-big">
                    {meta.image ? (
                      <img
                        src={meta.image}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                          event.currentTarget.nextElementSibling?.classList.remove('is-hidden');
                        }}
                      />
                    ) : null}
                    <span className={meta.image ? 'category-icon-fallback is-hidden' : 'category-icon-fallback'}>
                      {meta.icon}
                    </span>
                  </span>
                  <span className="category-card-name">{filter}</span>
                </button>
              );
            })}
          </div>
        </section>

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
      </main>
      <PublicFooter />
    </div>
  );
}
