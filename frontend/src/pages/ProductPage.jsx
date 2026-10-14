import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import CatalogImage from '../components/CatalogImage';
import ProductCard from '../components/ProductCard';
import { PUBLIC_CATALOG_CACHE_KEY, categoriesFromProducts, mergeCatalogCategories, readJsonStorage, stripSensitive } from '../utils/catalogStorage';
import { showSuccess } from '../utils/noticeService';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

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
  const [initialCatalog] = useState(() => {
    const cached = readJsonStorage(localStorage, PUBLIC_CATALOG_CACHE_KEY, []);
    return Array.isArray(cached) ? stripSensitive(cached) : [];
  });
  const [activeFilter, setActiveFilter] = useState(searchParams.get('category') || '');
  const [products, setProducts] = useState(initialCatalog);
  const [categories, setCategories] = useState(() => categoriesFromProducts(initialCatalog));
  const [categoriesLoading, setCategoriesLoading] = useState(() => initialCatalog.length === 0);
  const [loading, setLoading] = useState(() => initialCatalog.length === 0);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [sort, setSort] = useState('default');
  const [categoryScrollEdges, setCategoryScrollEdges] = useState({ left: false, right: false });
  const categoryScrollRef = useRef(null);
  const { toggleFavorite, isFavorite } = useFavorites();
  const filters = categories
    .map((category) => category.name)
    .sort((first, second) => {
      if (first === 'Glosir') return -1;
      if (second === 'Glosir') return 1;
      return first.localeCompare(second, 'id');
    });

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
  }, [filters.length, categoriesLoading]);

  useEffect(() => {
    const query = searchParams.get('search');
    setSearch(query || '');
    setActiveFilter(searchParams.get('category') || '');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    let remoteCategories = [];
    let catalogForCategories = initialCatalog;

    const fetchJson = async (path) => {
      const response = await apiFetch(path);
      if (!response.ok) throw new Error(`${path} gagal dimuat (${response.status})`);
      return response.json();
    };

    const publishCategories = () => {
      if (cancelled) return;
      setCategories(mergeCatalogCategories(remoteCategories, catalogForCategories));
    };

    fetchJson('/categories/public/list')
      .then((data) => {
        if (cancelled) return;
        remoteCategories = data?.success && Array.isArray(data.categories) ? data.categories : [];
        publishCategories();
      })
      .catch((error) => {
        console.error('Catalog category list failed:', error);
      })
      .finally(() => {
        if (!cancelled) {
          publishCategories();
          setCategoriesLoading(false);
        }
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
        publishCategories();
        try {
          localStorage.setItem(PUBLIC_CATALOG_CACHE_KEY, JSON.stringify(stripSensitive(merged)));
        } catch (error) {
          console.warn('Catalog cache could not be saved:', error);
        }
      })
      .catch((error) => console.error('Catalog content failed:', error))
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

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
              {categoriesLoading && <p className="category-loading" role="status">Memuat kategori...</p>}
              {filters.map((filter) => {
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
