import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
<<<<<<< HEAD
import { ShoppingBag, MessageCircle, Store, ChevronRight, Tag, PhoneCall, Plus } from 'lucide-react';
=======
import { ArrowRight, Check, ChevronRight, PackageCheck, Search, ShieldCheck, Sparkles, Store, Truck } from 'lucide-react';
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import CatalogImage from '../components/CatalogImage';
import { apiFetch } from '../services/api';
import { useCart } from '../context/CartContext';
import { showSuccess } from '../utils/noticeService';

<<<<<<< HEAD
const defaultCategories = [
  { name: 'Sembako & Beras', icon: '🌾' },
  { name: 'Minyak & Bumbu Dapur', icon: '🍳' },
  { name: 'Minuman & Kopi', icon: '☕' },
  { name: 'Makanan Ringan', icon: '🍪' },
  { name: 'Sabun & Kebersihan', icon: '🧼' },
  { name: 'Promo Mingguan', icon: '🏷️' },
];

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [activePromos, setActivePromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const storeWaNumber = import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '';
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

        const rawProducts = productsRes?.success && Array.isArray(productsRes.products) ? productsRes.products : [];
        const rawPromos = promosRes?.success && Array.isArray(promosRes.promos) ? promosRes.promos : [];

        if (rawProducts.length > 0) {
          setFeaturedProducts(
            rawProducts.slice(0, 8).map((p) => ({
              id: p.id,
              variantId: p.variants?.[0]?.id || p.id,
              name: p.name,
              category: p.category || 'Sembako',
              price: Number(p.variants?.[0]?.sellPrice || p.price || 0),
              originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
              unit: p.unit || p.variants?.[0]?.unit || 'Pcs',
              badge: p.badge || (p.discountPercent ? `Diskon ${p.discountPercent}%` : ''),
              imageUrl: p.imageUrl || null,
            }))
          );
        }

        if (rawPromos.length > 0) {
          setActivePromos(rawPromos.filter((p) => p.isActive !== false));
        }
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
    };

    loadContent();
  }, []);

<<<<<<< HEAD
  const handleAddToCart = (product, e) => {
    e.preventDefault();
    addItem(product);
    showSuccess(`"${product.name}" ditambahkan ke keranjang`);
  };

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

        {/* 2. BANNER PROMO SATU BARIS (Hanya jika ada promo aktif dari database) */}
        {activePromos.length > 0 && (
          <section className="glosir-promo-strip">
            <div className="promo-strip-content">
              <Tag size={18} className="promo-icon" />
              <span>
                <strong>Promo Minggu Ini:</strong> {activePromos[0].name} - {activePromos[0].description || 'Belanja lebih hemat hari ini di Glosir.'}
              </span>
              <Link to="/promo" className="promo-strip-link">Lihat Promo</Link>
            </div>
          </section>
        )}

        {/* 3. KATEGORI DENGAN FOTO / IKON BESAR (2 Kolom di HP) */}
        <section className="glosir-category-section">
          <div className="section-title-wrap">
            <h2>Kategori Belanja</h2>
            <Link to="/products" className="view-all-link">Lihat Semua Kategori →</Link>
          </div>
          <div className="category-big-grid">
            {defaultCategories.map((cat) => (
              <Link
                key={cat.name}
                to={`/products?category=${encodeURIComponent(cat.name)}`}
                className="category-big-card"
              >
                <div className="category-icon-big">{cat.icon}</div>
                <div className="category-card-text">
                  <h3>{cat.name}</h3>
                  <span>Buka Kategori</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 4. PRODUK LARIS / PROMO MINGGU INI (Scroll horizontal geser ke samping di HP) */}
        <section className="glosir-products-section">
          <div className="section-title-wrap">
            <div>
              <h2>Produk Laris</h2>
              <p className="section-desc">Kebutuhan dapur dan sembako yang paling sering dibeli warga.</p>
            </div>
            <Link to="/products" className="view-all-link">Lihat Semua Produk →</Link>
          </div>

          <div className="products-scroll-container">
            {loading ? (
              <div className="products-loading">Memuat produk...</div>
            ) : featuredProducts.length === 0 ? (
              <div className="products-empty">Belum ada produk unggulan.</div>
            ) : (
              featuredProducts.map((product) => (
                <div key={product.id} className="fresh-product-card">
                  {product.badge && <span className="product-badge-fresh">{product.badge}</span>}
                  <div className="product-photo-box">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="product-real-img" />
                    ) : (
                      <span className="product-placeholder-icon">🛍️</span>
                    )}
                  </div>
                  <div className="product-details">
                    <span className="product-category-label">{product.category}</span>
                    <h3 className="product-card-title">{product.name}</h3>
                    <span className="product-unit-label">Satuan: {product.unit}</span>
                    <div className="product-price-fresh">
                      Rp {product.price.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <button
                    className="btn-add-cart-fresh"
                    onClick={(e) => handleAddToCart(product, e)}
                    aria-label={`Tambah ${product.name} ke keranjang`}
                  >
                    <Plus size={20} /> Tambah
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 5. CARA PESAN 3 LANGKAH (PENTING) */}
        <section className="glosir-how-to-order">
          <div className="how-title-wrap">
            <span className="how-eyebrow">Mudah & Tanpa Ribet</span>
            <h2>Cara Belanja di Glosir (3 Langkah)</h2>
            <p>Tidak perlu daftar akun. Semua pesanan langsung terhubung ke WhatsApp toko.</p>
          </div>
          <div className="how-steps-grid">
            <div className="how-step-card">
              <div className="how-step-badge">1</div>
              <div className="how-step-icon">
                <ShoppingBag size={36} />
              </div>
              <h3>Pilih Barang</h3>
              <p>Pilih sembako dan kebutuhan yang Anda inginkan, lalu masukkan ke keranjang belanja.</p>
            </div>

            <div className="how-step-card">
              <div className="how-step-badge">2</div>
              <div className="how-step-icon">
                <MessageCircle size={36} />
              </div>
              <h3>Kirim via WhatsApp</h3>
              <p>Masukkan nama dan nomor HP. Pesanan akan otomatis terformat dan terkirim ke WhatsApp toko.</p>
            </div>

            <div className="how-step-card">
              <div className="how-step-badge">3</div>
              <div className="how-step-icon">
                <Store size={36} />
              </div>
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
              <h2>Toko Glosir Kampung</h2>
              <p className="store-address">
                <strong>Alamat:</strong> Jl. Raya Kampung Glosir No. 1, RT 02 / RW 03 (Dekat Masjid Jami)
              </p>
              <p className="store-hours">
                <strong>Jam Buka:</strong> 08:00 - 21:00 WIB (Buka Setiap Hari)
              </p>
              <p className="store-pickup-note">
                Pesanan yang dikirim sebelum jam 20:00 akan disiapkan di hari yang sama.
              </p>
            </div>
            <div className="store-info-actions">
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

