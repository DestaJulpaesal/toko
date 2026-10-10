import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, MessageCircle, Store, ChevronRight, Tag, PhoneCall, Plus } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { useCart } from '../context/CartContext';
import { showSuccess } from '../utils/noticeService';

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

  useEffect(() => {
    const loadContent = async () => {
      try {
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
      }
    };

    loadContent();
  }, []);

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
            </div>
          </div>
        </section>

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
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

