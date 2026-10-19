import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import CatalogImage from '../components/CatalogImage';
import ProductCard from '../components/ProductCard';
import { PUBLIC_CATALOG_CACHE_KEY, readJsonStorage, stripSensitive } from '../utils/catalogStorage';
import { publicCategoriesOrDefault, sortPublicCategories } from '../utils/publicContentDefaults';
import { showSuccess } from '../utils/noticeService';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

const publicCatalogRequests = new Map();

function fetchCatalogJson(path) {
  if (!publicCatalogRequests.has(path)) {
    const request = apiFetch(path)
      .then(async (response) => {
        if (!response.ok) throw new Error(`${path} gagal dimuat (${response.status})`);
        return response.json();
      })
      .finally(() => publicCatalogRequests.delete(path));
    publicCatalogRequests.set(path, request);
  }
  return publicCatalogRequests.get(path);
}

const CATEGORY_META = {
  'Glosir': { icon: '🛒' },
  'Kebutuhan Dapur': { icon: '🍳' },
  'Buah & Sayuran': { icon: '🍎' },
  'Buah dan Sayuran': { icon: '🍎' },
  'Sayur & Buah': { icon: '🥬' },
  'Susu & Telur': { icon: '🥛' },
  'Roti & Kue': { icon: '🥐' },
  'Daging & Ikan': { icon: '🐟' },
  'Minuman': { icon: '☕' },
  'Bahan Pokok': { icon: '🌾' },
  'Camilan': { icon: '🍪' },
  'Makanan Ringan': { icon: '🍿' },
  'Perawatan Rumah': { icon: '🧹' },
  'Rumah Tangga': { icon: '🧹' },
  'Sabun & Kebersihan': { icon: '🧼' },
  'Acara': { icon: '🎉' },
  'Parsel': { icon: '🎁' },
  'Paket Acara': { icon: '📦' },
};

export default function ProductPage() {
  const [searchParams] = useSearchParams();
  const { addItem, totalItems } = useCart();
  const [initialCatalog] = useState(() => {
    const cached = readJsonStorage(localStorage, PUBLIC_CATALOG_CACHE_KEY, []);
    return Array.isArray(cached) ? stripSensitive(cached) : [];
  });
  const [activeFilter, setActiveFilter] = useState(searchParams.get('category') || '');
  const [products, setProducts] = useState(initialCatalog);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(() => initialCatalog.length === 0);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [sort, setSort] = useState('default');
  const [categoryScrollEdges, setCategoryScrollEdges] = useState({ left: false, right: false });
  const categoryScrollRef = useRef(null);
  const { toggleFavorite, isFavorite } = useFavorites();
  const filters = sortPublicCategories(publicCategoriesOrDefault(categories))
    .map((category) => category.name)

  const updateCategoryScrollEdges = () => {
    const element = categoryScrollRef.current;
    if (!element) return;

    const left = element.scrollLeft > 1;
    const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
    setCategoryScrollEdges((current) => (
      current.left === left && current.right === right ? current : { left, right }
    ));
  };

  const scrollCategories = (direction) => {
    categoryScrollRef.current?.scrollBy({
      left: direction === 'left' ? -240 : 240,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    const element = categoryScrollRef.current;
    if (!element) return undefined;

    updateCategoryScrollEdges();
    const resizeObserver = new ResizeObserver(updateCategoryScrollEdges);
    resizeObserver.observe(element);
    window.addEventListener('resize', updateCategoryScrollEdges);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCategoryScrollEdges);
    };
  }, [filters.length]);

  useEffect(() => {
    const query = searchParams.get('search');
    setSearch(query || '');
    setActiveFilter(searchParams.get('category') || '');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    fetchCatalogJson('/categories/public/list')
      .then((data) => {
        if (cancelled) return;
        if (!data?.success || !Array.isArray(data.categories)) throw new Error('Daftar kategori tidak valid.');
        setCategories(data.categories);
      })
      .catch((error) => {
        console.error('Catalog category list failed:', error);
      });

    let catalogProducts = initialCatalog;
    let catalogParcels = [];
    let catalogEvents = [];

    const publishCatalog = () => {
      if (cancelled) return;
      const merged = [...catalogProducts, ...catalogParcels, ...catalogEvents];
      setProducts(merged);
      try {
        localStorage.setItem(PUBLIC_CATALOG_CACHE_KEY, JSON.stringify(stripSensitive(merged)));
      } catch (error) {
        console.warn('Catalog cache could not be saved:', error);
      }
    };

    fetchCatalogJson('/products')
      .then((data) => {
        if (!data?.success || !Array.isArray(data.products)) throw new Error('Daftar produk tidak valid.');
        if (cancelled) return;
        catalogProducts = data.products;
        publishCatalog();
      })
      .catch((error) => console.error('Catalog products failed to load:', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    fetchCatalogJson('/parcels')
      .then((data) => {
        if (!data?.success || !Array.isArray(data.parcels)) throw new Error('Daftar parsel tidak valid.');
        if (cancelled) return;
        catalogParcels = data.parcels.map((parcel) => ({
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
        }));
        publishCatalog();
      })
      .catch((error) => console.error('Catalog parcels failed to load:', error));

    fetchCatalogJson('/event-packages')
      .then((data) => {
        if (!data?.success || !Array.isArray(data.packages)) throw new Error('Daftar paket acara tidak valid.');
        if (cancelled) return;
        catalogEvents = data.packages.map((item) => ({
          id: `event-${item.id}`,
          eventPackageId: item.id,
          name: item.name,
          category: 'Acara',
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
        }));
        publishCatalog();
      })
      .catch((error) => console.error('Catalog event packages failed to load:', error));

    return () => {
      cancelled = true;
    };
  }, [initialCatalog]);

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
      <main className="catalog-shell catalog-page-shell">
        <header className="catalog-page-heading">
          <div>
            <span className="catalog-page-eyebrow">Katalog Produk</span>
            <h1>Belanja Grosir & Eceran</h1>
          </div>
          <div className="catalog-page-heading-actions">
            <Link to="/cart" className="btn btn-primary">
              Keranjang ({totalItems})
            </Link>
          </div>
        </header>

        <section className="glosir-category-section catalog-category-section" aria-labelledby="catalog-category-heading">
          <div className="section-title-wrap">
            <h2 id="catalog-category-heading">Kategori Belanja</h2>
          </div>
          <div className="catalog-category-track-wrap">
            {categoryScrollEdges.left && (
              <button
                type="button"
                className="catalog-category-arrow catalog-category-arrow-left"
                onClick={() => scrollCategories('left')}
                aria-label="Lihat kategori sebelumnya"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div
              className="category-browse-grid catalog-category-track"
              aria-label="Pilih kategori produk"
              ref={categoryScrollRef}
              onScroll={updateCategoryScrollEdges}
            >
              {filters.map((filter) => {
                const meta = CATEGORY_META[filter] || { icon: '🛍️' };
                const categoryImage = categories.find((category) => category.name === filter)?.imageUrl;
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
                      {categoryImage ? (
                        <img
                          src={categoryImage}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                            event.currentTarget.nextElementSibling?.classList.remove('is-hidden');
                          }}
                        />
                      ) : null}
                      <span className={categoryImage ? 'category-icon-fallback is-hidden' : 'category-icon-fallback'}>
                        {meta.icon}
                      </span>
                    </span>
                    <span className="category-card-name">{filter}</span>
                    {isActive && <span className="category-selected-mark">Dipilih</span>}
                  </button>
                );
              })}
            </div>
            {categoryScrollEdges.right && (
              <button
                type="button"
                className="catalog-category-arrow catalog-category-arrow-right"
                onClick={() => scrollCategories('right')}
                aria-label="Lihat kategori berikutnya"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </section>

        {activeFilter && (
          <div className="category-active-banner" aria-live="polite">
            <div className="category-active-copy">
              <span className="category-active-pill">Sedang melihat</span>
              <strong>{activeFilter}</strong>
              <span className="category-active-count">
                {loading ? 'Memuat produk...' : `${visibleProducts.length} produk ditemukan`}
              </span>
            </div>
            <button type="button" className="category-clear-filter" onClick={() => setActiveFilter('')}>
              Lihat semua kategori
            </button>
          </div>
        )}

        {/* Pencarian & Urutan */}
        <div className="catalog-page-tools">
          <div className="catalog-page-search">
            <Search size={18} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama barang..."
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Urutkan produk"
          >
            <option value="default">Urutkan: Rekomendasi</option>
            <option value="low">Harga Termurah</option>
            <option value="high">Harga Tertinggi</option>
          </select>
        </div>

        {/* Grid Produk Style FreshMart: Gambar Besar, Harga Jelas, Tombol Tambah Besar */}
        <div className="catalog-page-product-grid">
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
