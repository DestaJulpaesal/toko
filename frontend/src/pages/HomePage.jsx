import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
<<<<<<< HEAD
import { ShoppingBag, MessageCircle, Store, ChevronRight, ChevronLeft, Tag, PhoneCall, Plus, MapPin, Clock, Flame, UserRound, ClipboardCheck, WalletCards } from 'lucide-react';
=======
<<<<<<< HEAD
import { ShoppingBag, MessageCircle, Store, ChevronRight, Tag, PhoneCall, Plus } from 'lucide-react';
=======
import { ArrowRight, Check, ChevronRight, PackageCheck, Search, ShieldCheck, Sparkles, Store, Truck } from 'lucide-react';
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
>>>>>>> c2ec320499ee90c945e8fad84d2b37f5f3c754b8
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import CatalogImage from '../components/CatalogImage';
import { apiFetch } from '../services/api';
import { useCart } from '../context/CartContext';
import { showSuccess } from '../utils/noticeService';
import { PUBLIC_CATALOG_CACHE_KEY, categoriesFromProducts, readJsonStorage, stripSensitive } from '../utils/catalogStorage';

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
  'Camilan': { icon: '🍪' },
  'Makanan Ringan': { icon: '🍿' },
  'Perawatan Rumah': { icon: '🧹' },
  'Rumah Tangga': { icon: '🧹' },
  'Sabun & Kebersihan': { icon: '🧼' },
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
};

<<<<<<< HEAD
const defaultCategories = [
  { name: 'Sembako & Beras', icon: '🌾' },
  { name: 'Minyak & Bumbu Dapur', icon: '🍳' },
  { name: 'Minuman & Kopi', icon: '☕' },
  { name: 'Makanan Ringan', icon: '🍪' },
  { name: 'Sabun & Kebersihan', icon: '🧼' },
  { name: 'Promo Mingguan', icon: '🏷️' },
];

function promoIsActive(promo, now = Date.now()) {
  const startsAt = promo.startsAt ? new Date(promo.startsAt).getTime() : null;
  const endsAt = promo.endsAt ? new Date(promo.endsAt).getTime() : null;

  return promo.isActive !== false
    && (startsAt === null || (Number.isFinite(startsAt) && startsAt <= now))
    && (endsAt === null || (Number.isFinite(endsAt) && endsAt >= now));
}

function formatPromoDiscount(promo) {
  const value = Number(promo.discountValue || 0);
  if (promo.discountType === 'PERCENT') return `Diskon ${value}%`;
  return `Potongan Rp ${value.toLocaleString('id-ID')}`;
}

function HomePromoBanner({ promo, variant }) {
  const variants = {
    fresh: {
      eyebrow: 'Belanja kebutuhan harian',
      message: 'Pilihan hemat untuk belanja hari ini.',
      illustration: ['🥬', '🍅', '🥕'],
      artLabel: 'Segar setiap hari',
    },
    voucher: {
      eyebrow: 'Promo pilihan Glosir',
      message: 'Gunakan promonya, belanja jadi lebih ringan.',
      illustration: ['🛍️', '🏷️', '✨'],
      artLabel: 'Harga spesial',
    },
    festive: {
      eyebrow: 'Momen spesial, harga spesial',
      message: 'Temukan penawaran menarik untuk kebutuhanmu.',
      illustration: ['🎁', '🌟', '🧺'],
      artLabel: 'Jangan lewatkan',
    },
  };
  const content = variants[variant];

  return (
    <section className={`home-promo-banner home-promo-banner--${variant}`} aria-label={`Promo ${promo.name}`}>
      <div className="home-promo-copy">
        <span className="home-promo-eyebrow"><Tag size={14} /> {content.eyebrow}</span>
        <h2>{promo.name}</h2>
        <p>{promo.description || content.message}</p>
        <div className="home-promo-actions">
          <span className="home-promo-discount">{formatPromoDiscount(promo)}</span>
          <Link to="/promo" className="home-promo-link">
            Lihat Promo <ChevronRight size={17} />
          </Link>
        </div>
      </div>
      <div className="home-promo-art" aria-hidden="true">
        <span className="home-promo-art-label">{content.artLabel}</span>
        <span className="home-promo-art-emoji">{content.illustration[0]}</span>
        <span className="home-promo-art-accent home-promo-art-accent--one">{content.illustration[1]}</span>
        <span className="home-promo-art-accent home-promo-art-accent--two">{content.illustration[2]}</span>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [flashSaleProducts, setFlashSaleProducts] = useState([]);
  const [bestsellerProducts, setBestsellerProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [activePromos, setActivePromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const findHomePromo = (name) => activePromos.find((promo) => promo.name?.trim().toLowerCase() === name);
  
  const flashSaleScrollRef = useRef(null);
  const recommendedScrollRef = useRef(null);
  
  const [showLeftArrow, setShowLeftArrow] = useState({
    flashSale: false,
    recommended: false,
  });
  const [showRightArrow, setShowRightArrow] = useState({
    flashSale: true,
    recommended: true,
  });
  
  const { addItem } = useCart();
  const storeWaNumber = import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '';
<<<<<<< HEAD
  const promoDemo8 = findHomePromo('promo demo 8');
  const promoDemo9 = findHomePromo('promo demo 9');
  const promoDemo10 = findHomePromo('promo demo 10');

  useEffect(() => {
    let cancelled = false;
    let categoryRequestSettled = false;
    const cachedProducts = readJsonStorage(localStorage, PUBLIC_CATALOG_CACHE_KEY, []);
    const safeCachedProducts = Array.isArray(cachedProducts) ? stripSensitive(cachedProducts) : [];
    let fallbackCategories = categoriesFromProducts(safeCachedProducts);
=======
=======
const formatPrice = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [promotions, setPromotions] = useState([]);
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce

  useEffect(() => {
    const loadContent = async () => {
      try {
<<<<<<< HEAD
        const [productsRes, promosRes] = await Promise.all([
          apiFetch('/products').then((res) => res.json()).catch(() => null),
          apiFetch('/promos').then((res) => res.json()).catch(() => null),
        ]);
>>>>>>> c2ec320499ee90c945e8fad84d2b37f5f3c754b8

    apiFetch('/categories/public/list')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Kategori gagal dimuat (${response.status})`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          const remoteCategories = data?.success && Array.isArray(data.categories) ? data.categories : [];
          categoryRequestSettled = true;
          setCategories(remoteCategories.length > 0 ? remoteCategories : fallbackCategories);
        }
      })
      .catch((error) => {
        console.error('Homepage category list failed:', error);
        categoryRequestSettled = true;
        if (!cancelled) setCategories(fallbackCategories);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });

    apiFetch('/promos?activeOnly=true')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Promo gagal dimuat (${response.status})`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          const promos = data?.success && Array.isArray(data.promos) ? data.promos : [];
          setActivePromos(promos.filter((promo) => promoIsActive(promo)));
        }
<<<<<<< HEAD
      })
      .catch((error) => {
        console.error('Homepage promo list failed:', error);
        if (!cancelled) setActivePromos([]);
      });

    Promise.all([
      apiFetch('/products').then((res) => res.json()).catch(() => null),
      apiFetch('/products/public/flash-sale').then((res) => res.json()).catch(() => null),
      apiFetch('/products/public/bestseller').then((res) => res.json()).catch(() => null),
      apiFetch('/products/public/recommended').then((res) => res.json()).catch(() => null),
    ]).then(([productsRes, flashSaleRes, bestsellerRes, recommendedRes]) => {
          if (cancelled) return;
          const rawProducts = productsRes?.success && Array.isArray(productsRes.products) ? productsRes.products : [];
          const rawFlashSale = flashSaleRes?.success && Array.isArray(flashSaleRes.products) ? flashSaleRes.products : [];
          const rawBestseller = bestsellerRes?.success && Array.isArray(bestsellerRes.products) ? bestsellerRes.products : [];
          const rawRecommended = recommendedRes?.success && Array.isArray(recommendedRes.products) ? recommendedRes.products : [];

          if (!categoryRequestSettled && rawProducts.length > 0) {
            fallbackCategories = categoriesFromProducts(rawProducts);
          }

          if (rawFlashSale.length > 0) {
            setFlashSaleProducts(
              rawFlashSale.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category || 'Sembako',
                price: Number(p.price || 0),
                originalPrice: Number(p.originalPrice || 0),
                imageUrl: p.imageUrl || null,
                badge: 'Flash Sale',
              }))
            );
          }

          if (rawBestseller.length > 0) {
            setBestsellerProducts(
              rawBestseller.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category || 'Sembako',
                price: Number(p.price || 0),
                originalPrice: Number(p.originalPrice || 0),
                imageUrl: p.imageUrl || null,
                badge: 'Terlaris',
              }))
            );
          }

          if (rawRecommended.length > 0) {
            setRecommendedProducts(
              rawRecommended.map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category || 'Sembako',
                price: Number(p.price || 0),
                originalPrice: Number(p.originalPrice || 0),
                imageUrl: p.imageUrl || null,
                badge: 'Rekomendasi',
              }))
            );
          }

          setLoading(false);
        }).catch((error) => {
          console.error('Homepage catalog content failed:', error);
          if (cancelled) return;
          setFlashSaleProducts([]);
          setBestsellerProducts([]);
          setRecommendedProducts([]);
          setActivePromos([]);
          setLoading(false);
        });

    return () => {
      cancelled = true;
=======
      } catch {
        setFeaturedProducts([]);
        setActivePromos([]);
      } finally {
        setLoading(false);
=======
        const [productsResponse, promosResponse, parcelsResponse] = await Promise.all([
          apiFetch('/products').then((response) => response.json()).catch(() => null),
          apiFetch('/promos').then((response) => response.json()).catch(() => null),
          apiFetch('/parcels').then((response) => response.json()).catch(() => null),
        ]);

        const products = productsResponse?.success && Array.isArray(productsResponse.products)
          ? productsResponse.products
          : [];
        const parcels = parcelsResponse?.success && Array.isArray(parcelsResponse.parcels)
          ? parcelsResponse.parcels
          : [];
        const promos = promosResponse?.success && Array.isArray(promosResponse.promos)
          ? promosResponse.promos
          : [];

        setProductCategories([...new Set(products.map((product) => product.category).filter(Boolean))].slice(0, 6));
        setFeaturedProducts(products.length > 0
          ? products.slice(0, 4)
          : parcels.slice(0, 4).map((parcel) => ({
            ...parcel,
            id: `parcel-${parcel.id}`,
            category: parcel.type === 'CUSTOM' ? 'Paket acara' : 'Parsel',
            detailPath: '/parsel',
          })));
        setPromotions(promos.slice(0, 3).map((promo) => ({
          id: promo.id || promo.name,
          title: promo.name,
          description: promo.description || 'Lihat detail penawaran di katalog promo Glosir.',
          tag: promo.discountType === 'PERCENT'
            ? `${promo.discountValue}% OFF`
            : `Hemat ${formatPrice(promo.discountValue)}`,
        })));
      } catch {
        setFeaturedProducts([]);
        setProductCategories([]);
        setPromotions([]);
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
      }
>>>>>>> c2ec320499ee90c945e8fad84d2b37f5f3c754b8
    };
  }, []);

<<<<<<< HEAD
  const handleAddToCart = (product, e) => {
    e.preventDefault();
    addItem(product);
    showSuccess(`"${product.name}" ditambahkan ke keranjang`);
  };

  const checkArrowVisibility = (ref, section) => {
    if (!ref.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref.current;
    
    setShowLeftArrow((prev) => ({
      ...prev,
      [section]: scrollLeft > 0,
    }));
    
    setShowRightArrow((prev) => ({
      ...prev,
      [section]: scrollLeft + clientWidth < scrollWidth - 10,
    }));
  };

  const handleScroll = (ref, section, direction) => {
    if (!ref.current) return;
    const scrollAmount = 300;
    ref.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    
    setTimeout(() => checkArrowVisibility(ref, section), 100);
  };

  // Check arrow visibility on mount and when data changes
  useEffect(() => {
    checkArrowVisibility(flashSaleScrollRef, 'flashSale');
    checkArrowVisibility(recommendedScrollRef, 'recommended');
  }, [flashSaleProducts, bestsellerProducts, recommendedProducts]);

  return (
    <div className="glosir-public-page">
      <PublicHeader />

      <main className="glosir-home-content">
        {/* 1. HERO SEDERHANA */}
        <section className="glosir-hero">
          <div className="glosir-hero-inner">
            <span className="hero-eyebrow">Toko Sembako & Grosir Kampung</span>
            <h1 className="hero-title">Pesan dari rumah, ambil di toko.</h1>
            <p className="hero-subtitle">
              Pilih kebutuhan harian dan sembako lewat HP tanpa repot antre. Belanja disiapkan, tinggal ambil dan bayar di toko.
            </p>
            <div className="hero-cta-wrap">
              <Link to="/products" className="btn-hero-primary">
                Mulai Belanja <ChevronRight size={20} />
              </Link>
            </div>
          </div>
        </section>

        {/* 2. KATEGORI BELANJA */}
        <section className="glosir-category-section">
          <div className="section-title-wrap">
            <h2>Kategori Belanja</h2>
            <Link to="/products" className="view-all-link">Lihat Semua <ChevronRight size={16} /></Link>
          </div>
          <div className="category-browse-grid">
            {categoriesLoading && <p className="category-loading" role="status">Memuat kategori...</p>}
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat.name] || { icon: '🛍️' };
              return (
                <Link
                  key={cat.id}
                  to={`/products?category=${encodeURIComponent(cat.name)}`}
                  className="category-big-card"
                  aria-label={`Lihat kategori ${cat.name}`}
                >
                  <span className="category-icon-big">
                    {meta.image ? (
                      <img
                        src={meta.image}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            e.currentTarget.nextElementSibling.style.display = 'inline';
                          }
                        }}
                      />
                    ) : null}
                    <span className={meta.image ? 'category-icon-fallback is-hidden' : 'category-icon-fallback'}>
                      {meta.icon}
                    </span>
                  </span>
                  <span className="category-card-name">{cat.name}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {promoDemo8 && <HomePromoBanner promo={promoDemo8} variant="fresh" />}

        {/* 4. FLASH SALE */}
        <section className="home-flash-sale">
          <div className="home-flash-sale-heading">
            <div className="home-flash-sale-title">
              <span className="home-flash-sale-icon"><Flame size={21} fill="currentColor" /></span>
              <div>
                <span className="home-flash-sale-eyebrow">Harga spesial, waktu terbatas</span>
                <h2>Flash Sale</h2>
                <p>Kesempatan hemat untuk produk pilihan.</p>
              </div>
            </div>
            <Link to="/products" className="home-flash-sale-link">
              Jelajahi Katalog <ChevronRight size={17} />
            </Link>
          </div>

          <div className="home-flash-sale-content">
            <div className="home-flash-sale-track-wrap">
              {showLeftArrow.flashSale && (
                <button
                  onClick={() => handleScroll(flashSaleScrollRef, 'flashSale', 'left')}
                  className="scroll-arrow scroll-arrow-left"
                  aria-label="Scroll ke kiri"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              <div
                className="products-scroll-container home-flash-sale-list"
                ref={flashSaleScrollRef}
                onScroll={() => checkArrowVisibility(flashSaleScrollRef, 'flashSale')}
              >
                {loading ? (
                  <div className="home-flash-sale-empty" role="status">
                    <span className="home-flash-sale-empty-icon"><Flame size={22} /></span>
                    <span>Memuat penawaran spesial...</span>
                  </div>
                ) : flashSaleProducts.length === 0 ? (
                  <div className="home-flash-sale-empty">
                    <span className="home-flash-sale-empty-icon"><Tag size={22} /></span>
                    <span>
                      <strong>Belum ada Flash Sale saat ini</strong>
                      <small>Yuk, cek katalog untuk menemukan produk pilihan lainnya.</small>
                    </span>
                    <Link to="/products">Lihat produk <ChevronRight size={15} /></Link>
                  </div>
                ) : (
                  flashSaleProducts.map((product) => (
                    <article key={product.id} className="fresh-product-card home-flash-sale-card">
                      <span className="home-flash-sale-badge">
                        {product.originalPrice > product.price
                          ? `-${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%`
                          : 'Flash Sale'}
                      </span>
                      <div className="product-photo-box home-flash-sale-photo">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="product-real-img" loading="lazy" />
                        ) : (
                          <span className="product-placeholder-icon">🛍️</span>
                        )}
                      </div>
                      <div className="product-details">
                        <span className="product-category-label">{product.category}</span>
                        <h3 className="product-card-title">{product.name}</h3>
                        {product.originalPrice > product.price && (
                          <del className="home-flash-sale-original-price">
                            Rp {product.originalPrice.toLocaleString('id-ID')}
                          </del>
                        )}
                        <div className="product-price-fresh">
                          Rp {product.price.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <button
                        className="btn-add-cart-fresh"
                        onClick={(e) => handleAddToCart(product, e)}
                        aria-label={`Tambah ${product.name} ke keranjang`}
                      >
                        <Plus size={18} /> Tambah ke Keranjang
                      </button>
                    </article>
                  ))
                )}
              </div>

              {showRightArrow.flashSale && (
                <button
                  onClick={() => handleScroll(flashSaleScrollRef, 'flashSale', 'right')}
                  className="scroll-arrow scroll-arrow-right"
                  aria-label="Scroll ke kanan"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          </div>
        </section>

        {promoDemo9 && <HomePromoBanner promo={promoDemo9} variant="voucher" />}

        {/* 5. PRODUK TERLARIS & REKOMENDASI */}
        <section className="home-product-discovery" aria-label="Produk pilihan Glosir">
          <div className="home-discovery-panel home-recommendations-panel">
            <div className="home-discovery-heading">
              <div>
                <span className="home-discovery-eyebrow">Pilihan untukmu</span>
                <h2>Rekomendasi untuk Anda</h2>
                <p>Temukan kebutuhan pilihan dengan mudah.</p>
              </div>
              <Link to="/products" className="home-discovery-view-all">Lihat Semua <ChevronRight size={16} /></Link>
            </div>
            <div className="home-recommendations-wrap">
              {showLeftArrow.recommended && (
                <button
                  onClick={() => handleScroll(recommendedScrollRef, 'recommended', 'left')}
                  className="scroll-arrow scroll-arrow-left"
                  aria-label="Rekomendasi sebelumnya"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div
                className="products-scroll-container home-recommendations-list"
                ref={recommendedScrollRef}
                onScroll={() => checkArrowVisibility(recommendedScrollRef, 'recommended')}
              >
                {loading ? (
                  <div className="products-loading">Memuat rekomendasi...</div>
                ) : recommendedProducts.length === 0 ? (
                  <div className="products-empty">Belum ada rekomendasi.</div>
                ) : (
                  recommendedProducts.map((product) => (
                    <article key={product.id} className="fresh-product-card home-recommendation-card">
                      {product.badge && <span className="product-badge-fresh">{product.badge}</span>}
                      <div className="product-photo-box">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="product-real-img" loading="lazy" />
                        ) : (
                          <span className="product-placeholder-icon">🛍️</span>
                        )}
                      </div>
                      <div className="product-details">
                        <span className="product-category-label">{product.category}</span>
                        <h3 className="product-card-title">{product.name}</h3>
                        <div className="product-price-fresh">Rp {product.price.toLocaleString('id-ID')}</div>
                        {product.originalPrice > product.price && (
                          <del className="home-product-original-price">Rp {product.originalPrice.toLocaleString('id-ID')}</del>
                        )}
                      </div>
                      <button
                        className="btn-add-cart-fresh"
                        onClick={(event) => handleAddToCart(product, event)}
                        aria-label={`Tambah ${product.name} ke keranjang`}
                      >
                        <Plus size={18} /> Tambah
                      </button>
                    </article>
                  ))
                )}
              </div>
              {showRightArrow.recommended && (
                <button
                  onClick={() => handleScroll(recommendedScrollRef, 'recommended', 'right')}
                  className="scroll-arrow scroll-arrow-right"
                  aria-label="Rekomendasi berikutnya"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="home-discovery-panel home-bestsellers-panel">
            <div className="home-discovery-heading">
              <div>
                <span className="home-discovery-eyebrow">Favorit pelanggan</span>
                <h2>Produk Terlaris</h2>
                <p>Barang yang paling sering dibeli pelanggan.</p>
              </div>
              <Link to="/products" className="home-discovery-view-all" aria-label="Lihat semua produk">
                Lihat semua <ChevronRight size={16} />
              </Link>
            </div>
            <div className="home-bestsellers-list">
              {loading ? (
                <div className="products-loading">Memuat produk...</div>
              ) : bestsellerProducts.length === 0 ? (
                <div className="products-empty">Belum ada produk terlaris.</div>
              ) : (
                bestsellerProducts.slice(0, 6).map((product, index) => (
                  <article key={product.id} className="home-bestseller-row">
                    <span
                      className={`home-bestseller-rank${index < 3 ? ` is-top-rank is-top-rank-${index + 1}` : ''}`}
                      aria-label={`Peringkat ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                    <div className="home-bestseller-image">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">🛍️</span>
                      )}
                    </div>
                    <div className="home-bestseller-copy">
                      <span>{product.category}</span>
                      <h3>{product.name}</h3>
                      <strong>Rp {product.price.toLocaleString('id-ID')}</strong>
                    </div>
                    <button
                      className="home-bestseller-add"
                      onClick={(event) => handleAddToCart(product, event)}
                      aria-label={`Tambah ${product.name} ke keranjang`}
                    >
                      <Plus size={18} />
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        {promoDemo10 && <HomePromoBanner promo={promoDemo10} variant="festive" />}

        {/* 5. CARA PESAN 3 LANGKAH (PENTING) */}
        <section className="glosir-how-to-order">
          <div className="how-title-wrap">
            <span className="how-eyebrow">Mudah & Tanpa Ribet</span>
            <h2>Cara Belanja di Glosir</h2>
            <p>Cukup ikuti 3 langkah ini. Tidak perlu membuat akun.</p>
          </div>
          <div className="how-steps-grid">
            <div className="how-step-card">
              <div className="how-step-badge">1</div>
              <div className="how-step-icon">
                <ShoppingBag size={36} />
              </div>
              <h3>Pilih Barang</h3>
              <p>Pilih barang yang dibutuhkan, lalu masukkan ke keranjang.</p>
            </div>

            <div className="how-step-card">
              <div className="how-step-badge">2</div>
              <div className="how-step-icon">
                <MessageCircle size={36} />
              </div>
              <h3>Kirim Pesanan</h3>
              <p>Isi nama dan nomor HP, lalu kirim pesanan lewat WhatsApp toko.</p>
            </div>

            <div className="how-step-card">
              <div className="how-step-badge">3</div>
              <div className="how-step-icon">
                <Store size={36} />
              </div>
<<<<<<< HEAD
              <h3>Ambil dan Bayar</h3>
              <p>Datang ke toko, cek barang yang sudah disiapkan, lalu bayar.</p>
            </div>
          </div>
          <div className="how-benefits" aria-label="Keuntungan belanja di Glosir">
            <div className="how-benefit-item">
              <span className="how-benefit-icon"><UserRound size={23} /></span>
              <span><strong>Tanpa daftar akun</strong><small>Langsung pilih barang</small></span>
            </div>
            <div className="how-benefit-item">
              <span className="how-benefit-icon"><ClipboardCheck size={23} /></span>
              <span><strong>Cek barang dahulu</strong><small>Sebelum melakukan pembayaran</small></span>
            </div>
            <div className="how-benefit-item">
              <span className="how-benefit-icon"><WalletCards size={23} /></span>
              <span><strong>Bayar di toko</strong><small>Setelah barang siap</small></span>
            </div>
            <div className="how-benefit-item">
              <span className="how-benefit-icon"><MessageCircle size={23} /></span>
              <span><strong>Bisa tanya dulu</strong><small>Hubungi toko lewat WhatsApp</small></span>
=======
              <h3>Ambil & Bayar di Toko</h3>
              <p>Barang disiapkan pemilik toko. Anda tinggal datang, periksa barang, dan bayar di kasir.</p>
=======
  const heroProduct = featuredProducts[0];

  return (
    <div className="public-page home-page">
      <PublicHeader />

      <main className="home-shell">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <span className="home-eyebrow"><Store size={15} /> Pusat grosir untuk rumah dan usaha</span>
            <h1 id="home-title">Belanja harian, <span>lebih ringan.</span></h1>
            <p className="home-hero-description">
              Sembako, kebutuhan rumah, parsel, sampai paket acara. Pilih yang dibutuhkan, cek harganya, lalu pesan dengan mudah.
            </p>
            <div className="home-hero-actions">
              <Link to="/products" className="home-primary-link">Mulai belanja <ArrowRight size={17} /></Link>
              <Link to="/parsel" className="home-secondary-link">Lihat parsel</Link>
>>>>>>> c2ec320499ee90c945e8fad84d2b37f5f3c754b8
            </div>
            <div className="home-trust-list" aria-label="Keunggulan Glosir">
              <span><Check size={15} /> Harga transparan</span>
              <span><Check size={15} /> Eceran dan grosir</span>
              <span><Check size={15} /> Pesan praktis</span>
            </div>
          </div>

          <div className="home-hero-spotlight">
            <div className="home-hero-photo">
              {heroProduct?.imageUrl ? (
                <img src={heroProduct.imageUrl} alt={heroProduct.name} fetchPriority="high" />
              ) : (
                <div className="home-hero-placeholder">
                  <span className="home-placeholder-mark">G</span>
                  <span>Rumah <b>•</b> Warung <b>•</b> Acara</span>
                  <PackageCheck size={40} strokeWidth={1.25} />
                </div>
              )}
              <span className="home-photo-note">Pilihan Glosir</span>
            </div>
            {heroProduct && (
              <div className="home-spotlight-caption">
                <div>
                  <span>{heroProduct.category || 'Kebutuhan pilihan'}</span>
                  <strong>{heroProduct.name}</strong>
                </div>
                <b>{formatPrice(heroProduct.price)}</b>
              </div>
            )}
          </div>
        </section>

        {productCategories.length > 0 && (
          <nav className="home-category-nav" aria-label="Kategori produk">
            <span className="home-category-label">Jelajahi lorong</span>
            {productCategories.map((category) => (
              <Link key={category} to={`/products?search=${encodeURIComponent(category)}`}>
                {category}<ChevronRight size={14} />
              </Link>
            ))}
            <Link to="/products" className="home-all-categories">Semua produk <ArrowRight size={14} /></Link>
          </nav>
        )}

        <section className="home-products-section" aria-labelledby="home-products-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker">Dari katalog Glosir</span>
              <h2 id="home-products-title">Pilihan untuk hari ini</h2>
            </div>
            <Link to="/products" className="home-text-link">Lihat semua produk <ArrowRight size={16} /></Link>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="home-product-grid">
              {featuredProducts.map((product) => (
                <article key={product.id} className="home-product-card">
                  <Link to={product.detailPath || `/products/${product.id}`} className="home-product-image" aria-label={`Lihat ${product.name}`}>
                    <CatalogImage src={product.imageUrl} alt={product.name}>
                      <div className="home-product-placeholder" aria-hidden="true">
                        <PackageCheck size={30} strokeWidth={1.3} />
                        <span>{product.category || 'Produk Glosir'}</span>
                      </div>
                    </CatalogImage>
                    {product.badge && <span className="home-product-badge">{product.badge}</span>}
                  </Link>
                  <div className="home-product-details">
                    <span className="home-product-category">{product.category || 'Kebutuhan harian'}</span>
                    <Link to={product.detailPath || `/products/${product.id}`} className="home-product-name">{product.name}</Link>
                    <div className="home-product-bottom">
                      <strong>{formatPrice(product.price)}</strong>
                      <Link to={product.detailPath || `/products/${product.id}`} aria-label={`Buka ${product.name}`}>
                        <ArrowRight size={17} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
            </div>
          ) : (
            <div className="home-products-empty">
              <PackageCheck size={26} />
              <div>
                <strong>Katalog sedang disiapkan</strong>
                <p>Produk pilihan Glosir akan muncul di sini. Sementara itu, jelajahi seluruh katalog.</p>
              </div>
              <Link to="/products">Buka katalog <ArrowRight size={16} /></Link>
            </div>
          )}
        </section>

        <section className="home-service-band" aria-label="Layanan Glosir">
          <div className="home-service-item">
            <span className="home-service-icon service-green"><ShieldCheck size={20} /></span>
            <div><strong>Belanja lebih yakin</strong><span>Informasi produk dan harga tampil jelas.</span></div>
          </div>
          <div className="home-service-item">
            <span className="home-service-icon service-yellow"><Truck size={20} /></span>
            <div><strong>Untuk rumah dan warung</strong><span>Pilihan eceran maupun kebutuhan grosir.</span></div>
          </div>
          <div className="home-service-item">
            <span className="home-service-icon service-blue"><Sparkles size={20} /></span>
            <div><strong>Parsel dan paket acara</strong><span>Siap untuk berbagi dan momen spesial.</span></div>
          </div>
        </section>

<<<<<<< HEAD
        {/* 6. INFO TOKO */}
        <section className="glosir-store-info-section">
          <div className="store-info-card">
            <div className="store-info-text">
              <span className="store-info-eyebrow"><Store size={14} /> Toko fisik Glosir</span>
              <div className="store-info-heading">
                <h2>Toko Glosir Kampung</h2>
                <span className="store-open-badge"><span /> Buka setiap hari</span>
              </div>
              <div className="store-info-details">
                <div className="store-info-detail">
                  <span className="store-info-detail-icon"><MapPin size={19} /></span>
                  <span><small>Alamat toko</small><strong>Jl. Raya Kampung Glosir No. 1, RT 02 / RW 03</strong><span className="store-detail-hint">Dekat Masjid Jami</span></span>
                </div>
                <div className="store-info-detail">
                  <span className="store-info-detail-icon"><Clock size={19} /></span>
                  <span><small>Jam operasional</small><strong>08:00–21:00 WIB</strong><span className="store-detail-hint">Setiap hari</span></span>
                </div>
              </div>
              <p className="store-pickup-note">
                <span>Pesanan sebelum <strong>20:00</strong> disiapkan di hari yang sama.</span>
              </p>
            </div>
            <div className="store-info-actions">
              <span className="store-contact-caption">Ada yang ingin ditanyakan?</span>
              <a
                href={`https://wa.me/${storeWaNumber}?text=${encodeURIComponent('Halo Glosir, saya ingin bertanya tentang lokasi dan stok toko.')}`}
                target="_blank"
                rel="noreferrer"
                className="btn-store-wa"
              >
                <PhoneCall size={20} /> Hubungi WhatsApp Toko
              </a>
            </div>
          </div>
=======
        <section className="home-promotions-section" aria-labelledby="home-promotions-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker">Belanja lebih hemat</span>
              <h2 id="home-promotions-title">Promo dan penawaran</h2>
            </div>
            <Link to="/promo" className="home-text-link">Semua promo <ArrowRight size={16} /></Link>
          </div>
          {promotions.length > 0 ? (
            <div className="home-promo-grid">
              {promotions.map((promo) => (
                <Link key={promo.id} to="/promo" className="home-promo-item">
                  <span>{promo.tag}</span>
                  <strong>{promo.title}</strong>
                  <small>{promo.description}</small>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="home-promo-empty">
              <div><strong>Temukan penawaran terbaru</strong><span>Cek promo aktif dan pilih yang paling sesuai dengan kebutuhanmu.</span></div>
              <Link to="/promo">Jelajahi promo <ArrowRight size={16} /></Link>
            </div>
          )}
        </section>

        <section className="home-parcel-banner">
          <div>
            <span>Untuk momen yang ingin dirayakan</span>
            <h2>Parsel dan paket acara, dibuat lebih mudah.</h2>
          </div>
          <Link to="/paket-acara">Lihat pilihan paket <ArrowRight size={16} /></Link>
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
