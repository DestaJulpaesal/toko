import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, MessageCircle, Store, ChevronRight, ChevronLeft, Tag, PhoneCall, Plus, MapPin, Clock, Flame, UserRound, ClipboardCheck, WalletCards } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { useCart } from '../context/CartContext';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { normalizeIndonesianPhone } from '../utils/phoneUtils';
import { showSuccess } from '../utils/noticeService';
import { readJsonStorage } from '../utils/catalogStorage';
import { publicCategoriesOrDefault, sortPublicCategories } from '../utils/publicContentDefaults';

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

const PUBLIC_HOMEPAGE_CACHE_KEY = 'glosir_public_homepage_v1';
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
  const [initialHomepage] = useState(readHomepageCache);
  const [flashSaleProducts, setFlashSaleProducts] = useState(() => initialHomepage?.flashSaleProducts || []);
  const [bestsellerProducts, setBestsellerProducts] = useState(() => initialHomepage?.bestsellerProducts || []);
  const [recommendedProducts, setRecommendedProducts] = useState(() => initialHomepage?.recommendedProducts || []);
  const [categories, setCategories] = useState(() => publicCategoriesOrDefault(initialHomepage?.categories || []));
  const [activePromos, setActivePromos] = useState(() => (initialHomepage?.promos || []).filter((promo) => promoIsActive(promo)));
  const [loading, setLoading] = useState(() => !initialHomepage);
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
  const { storeProfile } = usePublicSettings();
  const storeWaNumber = normalizeIndonesianPhone(storeProfile.phone || import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '');
  const promoDemo8 = findHomePromo('promo demo 8');
  const promoDemo9 = findHomePromo('promo demo 9');
  const promoDemo10 = findHomePromo('promo demo 10');
  const visibleCategories = sortPublicCategories(publicCategoriesOrDefault(categories));

  useEffect(() => {
    let cancelled = false;

    fetchHomepageData()
      .then((data) => {
        if (cancelled) return;

        const homepage = {
          categories: publicCategoriesOrDefault(Array.isArray(data?.categories) ? data.categories : []),
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
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          <div className="category-browse-grid homepage-category-grid">
            {visibleCategories.map((cat) => {
              const meta = CATEGORY_META[cat.name] || { icon: '🛍️' };
              const categoryImage = cat.imageUrl;
              return (
                <Link
                  key={cat.id}
                  to={`/products?category=${encodeURIComponent(cat.name)}`}
                  className="category-big-card"
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
      </main>

      <PublicFooter />
    </div>
  );
}
