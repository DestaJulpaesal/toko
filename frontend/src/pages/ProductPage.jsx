import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import CatalogImage from '../components/CatalogImage';
import ProductCard from '../components/ProductCard';
import { PUBLIC_CATALOG_CACHE_KEY, categoriesFromProducts, stripSensitive } from '../utils/catalogStorage';
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
  const { addItem, totalItems } = useCart();
  const [activeFilter, setActiveFilter] = useState(searchParams.get('category') || '');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
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
            <span style={{ fontSize: '0.85rem', color: '#1f7a4a', fontWeight: 800, textTransform: 'uppercase' }}>Katalog Produk</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#111827', margin: '4px 0 0' }}>Belanja Grosir & Eceran</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/cart" className="btn btn-primary" style={{ minHeight: '44px', fontWeight: 700, borderRadius: '12px' }}>
              Keranjang ({totalItems})
            </Link>
          </div>
        </header>

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
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
