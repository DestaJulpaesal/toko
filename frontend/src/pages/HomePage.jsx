import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, MessageCircle, Store, ChevronRight, ChevronLeft, Tag, PhoneCall, Plus, MapPin, Clock, Flame, UserRound, ClipboardCheck, WalletCards } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import ProductTile from '../components/ProductTile';
import { useCart } from '../context/CartContext';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { normalizeIndonesianPhone } from '../utils/phoneUtils';
import { showSuccess } from '../utils/noticeService';
import { readJsonStorage } from '../utils/catalogStorage';
import { sortPublicCategories } from '../utils/publicContentDefaults';
import { useFavorites } from '../context/FavoritesContext';
import HomeProductSectionPage from './HomeProductSectionPage';

const CATEGORY_META = {
  'Glosir': { icon: '🛒' },
  'Kebutuhan Dapur': { icon: '🍳' },
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
  'Minuman': { icon: '☕' },
  'Bahan Pokok': { icon: '🌾' },
  'Acara': { icon: '🎉' },
  'Parsel': { icon: '🎁' },
  'Paket Acara': { icon: '📦' },
};

const PUBLIC_HOMEPAGE_CACHE_KEY = 'glosir_public_homepage_v3';
let homepageRequestPromise;

function readHomepageCache() {
  const cached = readJsonStorage(localStorage, PUBLIC_HOMEPAGE_CACHE_KEY, null);
  if (!cached
    || !Array.isArray(cached.categories)
    || !Array.isArray(cached.promos)
    || !Array.isArray(cached.flashSaleProducts)
    || !Array.isArray(cached.bestsellerProducts)
    || !Array.isArray(cached.recommendedProducts)) return null;
  return cached;
}

function fetchHomepageData() {
  if (!homepageRequestPromise) {
    homepageRequestPromise = apiFetch('/homepage')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Homepage gagal dimuat (${response.status})`);
        return response.json();
      })
      .finally(() => {
        homepageRequestPromise = null;
      });
  }
  return homepageRequestPromise;
}

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
  const [activeProductSection, setActiveProductSection] = useState(null);
  const [homepageScrollPosition, setHomepageScrollPosition] = useState(0);
  const [initialHomepage] = useState(readHomepageCache);
  const [flashSaleProducts, setFlashSaleProducts] = useState(() => initialHomepage?.flashSaleProducts || []);
  const [bestsellerProducts, setBestsellerProducts] = useState(() => initialHomepage?.bestsellerProducts || []);
  const [recommendedProducts, setRecommendedProducts] = useState(() => initialHomepage?.recommendedProducts || []);
  const [categories, setCategories] = useState(() => initialHomepage?.categories || []);
  const [activePromos, setActivePromos] = useState(() => (initialHomepage?.promos || []).filter((promo) => promoIsActive(promo)));
  const [loading, setLoading] = useState(() => !initialHomepage);
  const [homepageError, setHomepageError] = useState('');
  const findHomePromo = (name) => activePromos.find((promo) => promo.name?.trim().toLowerCase() === name);
  
  const categoryScrollRef = useRef(null);
  
  const [showLeftArrow, setShowLeftArrow] = useState({
    categories: false,
  });
  const [showRightArrow, setShowRightArrow] = useState({
    categories: true,
  });
  
  const { addItem } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { storeProfile } = usePublicSettings();
  const storeWaNumber = normalizeIndonesianPhone(storeProfile.phone || import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '');
  const promoDemo8 = findHomePromo('promo demo 8');
  const promoDemo9 = findHomePromo('promo demo 9');
  const promoDemo10 = findHomePromo('promo demo 10');
  const visibleCategories = sortPublicCategories(categories);
  const activeSectionProducts = activeProductSection === 'flash-sale'
    ? flashSaleProducts
    : activeProductSection === 'recommended'
      ? recommendedProducts
      : bestsellerProducts;

  const openProductSection = (section) => {
    setHomepageScrollPosition(window.scrollY);
    setActiveProductSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeProductSection = () => {
    setActiveProductSection(null);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: homepageScrollPosition, behavior: 'smooth' });
    });
  };

  const returnToHomeStart = () => {
    setActiveProductSection(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    let cancelled = false;

    fetchHomepageData()
      .then((data) => {
        if (cancelled) return;

        const homepage = {
          categories: Array.isArray(data?.categories) ? data.categories : [],
          promos: Array.isArray(data?.promos) ? data.promos : [],
          flashSaleProducts: Array.isArray(data?.flashSaleProducts) ? data.flashSaleProducts : [],
          bestsellerProducts: Array.isArray(data?.bestsellerProducts) ? data.bestsellerProducts : [],
          recommendedProducts: Array.isArray(data?.recommendedProducts) ? data.recommendedProducts : [],
        };

        setCategories(homepage.categories);
        setActivePromos(homepage.promos.filter((promo) => promoIsActive(promo)));
        setFlashSaleProducts(homepage.flashSaleProducts);
        setBestsellerProducts(homepage.bestsellerProducts);
        setRecommendedProducts(homepage.recommendedProducts);
        setHomepageError('');
        setLoading(false);

        try {
          localStorage.setItem(PUBLIC_HOMEPAGE_CACHE_KEY, JSON.stringify(homepage));
        } catch (error) {
          console.warn('Homepage cache could not be saved:', error);
        }
      })
      .catch((error) => {
        console.error('Homepage data failed:', error);
        if (cancelled) return;
        setHomepageError(error.message || 'Data homepage gagal dimuat.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddToCart = (product, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    addItem(product);
    showSuccess(`"${product.name}" ditambahkan ke keranjang`);
  };

  const checkArrowVisibility = (ref, section) => {
    if (!ref.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref.current;
    
    setShowLeftArrow((prev) => ({
      ...prev,
      [section]: scrollLeft > 6,
    }));
    
    setShowRightArrow((prev) => ({
      ...prev,
      [section]: scrollLeft + clientWidth < scrollWidth - 10,
    }));
  };

  const handleScroll = (ref, section, direction) => {
    if (!ref.current) return;
    const scrollAmount = section === 'categories' ? 240 : 300;
    ref.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    
    setTimeout(() => checkArrowVisibility(ref, section), 320);
  };

  // Check arrow visibility on mount and when data changes
  useEffect(() => {
    checkArrowVisibility(categoryScrollRef, 'categories');
  }, [categories]);

  useEffect(() => {
    const handleResize = () => {
      checkArrowVisibility(categoryScrollRef, 'categories');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="glosir-public-page">
      <PublicHeader onHomeClick={returnToHomeStart} />

      <main className="glosir-home-content">
        {activeProductSection ? (
          <HomeProductSectionPage
            section={activeProductSection}
            products={activeSectionProducts}
            loading={loading}
            error={homepageError}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onAddToCart={handleAddToCart}
            onBack={closeProductSection}
          />
        ) : (
          <>
        {/* 1. Banner toko */}
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero-copy">
            <span className="home-hero-eyebrow">Sembako &amp; Grosir Bu Wida</span>
            <h1 id="home-hero-title" className="home-hero-title">
              <span className="home-hero-title-line">Belanja Sembako Lengkap</span>
              <span className="home-hero-title-line home-hero-title-highlight">Harga Tetap Hemat!</span>
            </h1>
            <p className="home-hero-description">
              Dari beras, minyak, gula, sampai telur tersedia untuk kebutuhan rumah maupun stok warung.
            </p>
            <div className="home-hero-actions">
              <Link to="/products" className="home-hero-button home-hero-button-primary">
                Mulai Belanja <ChevronRight size={19} aria-hidden="true" />
              </Link>
              <Link to="/products" className="home-hero-button home-hero-button-secondary">
                Lihat Katalog
              </Link>
            </div>
          </div>

          <div className="home-hero-product" aria-hidden="true">
            <span className="home-hero-product-glow" />
            <img src="/hero-products.png" alt="" />
          </div>

        </section>

        {/* 2. KATEGORI BELANJA */}
        <section className="glosir-category-section">
          <div className="section-title-wrap">
            <h2>Kategori Belanja</h2>
            <Link to="/products" className="view-all-link">Lihat Semua <ChevronRight size={16} /></Link>
          </div>

          <div className="home-category-slider-wrap">
            {showLeftArrow.categories && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleScroll(categoryScrollRef, 'categories', 'left');
                }}
                className="scroll-arrow scroll-arrow-left home-category-arrow"
                aria-label="Lihat kategori sebelumnya"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            <div
              className="category-browse-grid homepage-category-track"
              ref={categoryScrollRef}
              onScroll={() => checkArrowVisibility(categoryScrollRef, 'categories')}
            >
              {loading ? (
                <div className="products-loading">Memuat kategori...</div>
              ) : visibleCategories.length === 0 ? (
                <div className="products-empty">Belum ada kategori di database.</div>
              ) : visibleCategories.map((cat) => {
                const meta = CATEGORY_META[cat.name] || { icon: '🛍️' };
                const categoryImage = cat.imageUrl;
                return (
                  <Link
                    key={cat.id}
                    to={`/products?category=${encodeURIComponent(cat.name)}`}
                    className="category-big-card home-category-slide-item"
                    aria-label={`Lihat kategori ${cat.name}`}
                  >
                    <span className="category-icon-big">
                      {categoryImage ? (
                        <img
                          src={categoryImage}
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
                      <span className={categoryImage ? 'category-icon-fallback is-hidden' : 'category-icon-fallback'}>
                        {meta.icon}
                      </span>
                    </span>
                    <span className="category-card-name">{cat.name}</span>
                  </Link>
                );
              })}
            </div>

            {showRightArrow.categories && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleScroll(categoryScrollRef, 'categories', 'right');
                }}
                className="scroll-arrow scroll-arrow-right home-category-arrow"
                aria-label="Lihat kategori berikutnya"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </section>

        {promoDemo8 && <HomePromoBanner promo={promoDemo8} variant="fresh" />}

        {/* 4. FLASH SALE */}
        <section className="home-flash-sale">
          <div className="home-flash-sale-heading">
            <div className="home-flash-sale-title">
              <span className="home-flash-sale-icon"><Flame size={21} fill="currentColor" /></span>
              <div>
                <span className="home-flash-sale-eyebrow">Harga promo untuk produk pilihan</span>
                <h2>Flash Sale</h2>
                <p>Kesempatan hemat untuk produk pilihan.</p>
              </div>
            </div>
            <button type="button" onClick={() => openProductSection('flash-sale')} className="home-flash-sale-link">
              Lihat Semua <ChevronRight size={17} />
            </button>
          </div>

          <div className="home-flash-sale-content">
            <div className="home-flash-sale-grid-wrap">
              <div
                className="products-scroll-container home-flash-sale-list"
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
                  flashSaleProducts.slice(0, 12).map((product) => (
                    <ProductTile
                      key={product.id}
                      product={product}
                      badge={product.originalPrice > product.price
                        ? `-${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%`
                        : 'Flash Sale'}
                      badgeTone="is-flash"
                      onAdd={handleAddToCart}
                    />
                  ))
                )}
              </div>
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
              <button type="button" onClick={() => openProductSection('recommended')} className="home-discovery-view-all">Lihat Semua <ChevronRight size={16} /></button>
            </div>
            <div className="home-recommendations-wrap">
              <div className="home-recommendations-list">
                {loading ? (
                  <div className="products-loading">Memuat rekomendasi...</div>
                ) : recommendedProducts.length === 0 ? (
                  <div className="products-empty">Belum ada rekomendasi.</div>
                ) : (
                  recommendedProducts.slice(0, 12).map((product) => (
                    <ProductTile key={product.id} product={product} badge={product.badge} onAdd={handleAddToCart} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="home-discovery-panel home-bestsellers-panel">
            <div className="home-discovery-heading">
              <div>
                <span className="home-discovery-eyebrow">Favorit pelanggan</span>
                <h2>Produk Terlaris</h2>
                <p>Urutan dari transaksi selesai 90 hari; jika belum ada, gunakan pilihan toko.</p>
              </div>
              <button type="button" onClick={() => openProductSection('bestsellers')} className="home-discovery-view-all" aria-label="Lihat semua produk terlaris">
                Lihat semua <ChevronRight size={16} />
              </button>
            </div>
            <div className="home-bestsellers-list">
              {loading ? (
                <div className="products-loading">Memuat produk...</div>
              ) : bestsellerProducts.length === 0 ? (
                <div className="products-empty">Belum ada produk terlaris.</div>
              ) : (
                bestsellerProducts.slice(0, 3).map((product, index) => (
                  <article key={product.id} className="home-bestseller-row">
                    <span
                      className={`home-bestseller-rank${index < 3 ? ` is-top-rank is-top-rank-${index + 1}` : ''}`}
                      aria-label={`Peringkat ${index + 1}`}
                    >
                      {index + 1}
                    </span>
                    <Link
                      to={`/products/${product.id}`}
                      className="home-bestseller-link"
                      aria-label={`Lihat detail ${product.name}`}
                    >
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
                    </Link>
                    <button
                      className="home-bestseller-add"
                      onClick={(event) => handleAddToCart(product, event)}
                      aria-label={`Tambah ${product.name} ke keranjang`}
                    >
                      <Plus size={15} />
                      <span>Tambah</span>
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
            </div>
          </div>
        </section>

        {/* 6. INFO TOKO */}
        <section className="glosir-store-info-section">
          <div className="store-info-card">
            <div className="store-info-text">
              <span className="store-info-eyebrow"><Store size={14} /> Toko fisik Glosir</span>
              <div className="store-info-heading">
                <h2>{storeProfile.name || 'Toko Glosir'}</h2>
                {storeProfile.openingHours && <span className="store-open-badge"><span /> {storeProfile.openingHours}</span>}
              </div>
              <div className="store-info-details">
                <div className="store-info-detail">
                  <span className="store-info-detail-icon"><MapPin size={19} /></span>
                  <span><small>Alamat toko</small><strong>{storeProfile.address || 'Informasi alamat toko belum tersedia.'}</strong></span>
                </div>
                <div className="store-info-detail">
                  <span className="store-info-detail-icon"><Clock size={19} /></span>
                  <span><small>Jam operasional</small><strong>{storeProfile.openingHours || 'Informasi jam buka belum tersedia.'}</strong></span>
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
        </section>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
