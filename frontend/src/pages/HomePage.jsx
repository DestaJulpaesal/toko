import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { 
  ShoppingBag, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  Tag, 
  ArrowRight, 
  Gift, 
  CheckCircle2, 
  MessageCircle, 
  Store,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';

const categories = ['Kebutuhan Harian', 'Minuman & Snack', 'Bahan Pokok & Sembako', 'Parsel Lebaran', 'Paket Acara', 'Promo Hemat'];

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const loadPublicContent = async () => {
      try {
        const [productsRes, promosRes, parcelsRes] = await Promise.all([
          apiFetch('/products').then((res) => res.json()).catch(() => null),
          apiFetch('/promos').then((res) => res.json()).catch(() => null),
          apiFetch('/parcels').then((res) => res.json()).catch(() => null),
        ]);

        const products = productsRes?.success && Array.isArray(productsRes.products) ? productsRes.products : [];
        const promos = promosRes?.success && Array.isArray(promosRes.promos) ? promosRes.promos : [];
        const parcels = parcelsRes?.success && Array.isArray(parcelsRes.parcels) ? parcelsRes.parcels : [];

        if (products.length > 0) {
          setFeaturedProducts(
            products.slice(0, 4).map((product) => ({
              id: product.id,
              name: product.name,
              price: `Rp ${Number(product.price || 0).toLocaleString('id-ID')}`,
              tag: product.badge || (product.category || 'Populer'),
              imageUrl: product.imageUrl,
            }))
          );
        }

        if (promos.length > 0) {
          setEvents(
            promos.slice(0, 3).map((promo) => ({
              title: promo.name,
              text: promo.description || 'Promo aktif dari Glosir untuk kebutuhan belanja Anda.',
              tag: promo.discountType === 'PERCENT' ? `${promo.discountValue}% OFF` : `Rp ${Number(promo.discountValue || 0).toLocaleString('id-ID')}`,
            }))
          );
        }

        if (parcels.length > 0 && products.length === 0) {
          setFeaturedProducts(
            parcels.slice(0, 4).map((parcel) => ({
              id: parcel.id,
              name: parcel.name,
              price: `Rp ${Number(parcel.price || 0).toLocaleString('id-ID')}`,
              tag: parcel.type === 'CUSTOM' ? 'Custom' : 'Parsel',
              imageUrl: parcel.imageUrl,
            }))
          );
        }
      } catch {
        setFeaturedProducts([]);
        setEvents([]);
      }
    };

    loadPublicContent();
  }, []);

  return (
    <div className="public-page">
      <PublicHeader />

      <main className="glosir-shell">
        {/* Hero Section */}
        <section className="hero" id="home">
          <div className="hero-copy">
            <span className="eyebrow-pill emerald mb-4">
              <Store className="w-3.5 h-3.5 inline mr-1" /> Pusat Grosir & E-Commerce Terpercaya
            </span>
            <h1 className="hero-title">Belanja Sembako, Kebutuhan Harian & Parsel Lebih Hemat.</h1>
            <p className="hero-subtitle">
              Glosir melayani kebutuhan rumah tangga, warung eceran, dan parsel hampers acara keluarga 
              dengan harga grosir transparan, jaminan produk asli, dan pengiriman cepat.
            </p>
            <div className="hero-actions">
              <Link to="/products" className="btn btn-primary shadow-lg">
                <ShoppingBag className="w-4 h-4 inline mr-1.5" /> Lihat Katalog Produk
              </Link>
              <Link to="/parsel" className="btn btn-secondary shadow-sm">
                <Gift className="w-4 h-4 inline mr-1.5 text-amber-600" /> Parsel & Hampers
              </Link>
            </div>
            
            {/* Value Props / Stats */}
            <div className="stats-strip">
              <div className="stat-item">
                <div className="stat-icon-wrap emerald">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <strong>Harga Transparan</strong>
                  <span>Grosir & Eceran Jelas</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon-wrap amber">
                  <Truck className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <strong>Pengiriman Cepat</strong>
                  <span>Langsung ke Lokasi</span>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon-wrap blue">
                  <Award className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <strong>Produk Quality</strong>
                  <span>Terjamin & Original</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-visual-card">
            <div className="hero-card-banner top-card">
              <div className="card-badge-top">
                <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Best Seller Momen Ini
              </div>
              <h3>Parsel Lebaran & Hampers Premium</h3>
              <p>Isi lengkap sembako & kue kering favorit keluarga.</p>
              <div className="hero-card-footer">
                <span className="hero-card-price">Mulai Rp 120.000</span>
                <Link to="/parsel" className="hero-card-link">
                  Detail Parsel <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                </Link>
              </div>
            </div>

            <div className="hero-card-banner highlight-card">
              <div className="card-badge-top amber">
                <Tag className="w-3.5 h-3.5 inline mr-1" /> Promo Grosir
              </div>
              <h3>Diskon Belanja Sembako</h3>
              <p>Hemat hingga 15% untuk paket pembelian grosir.</p>
              <Link to="/promo" className="btn btn-light small">Cek Promo Sekarang</Link>
            </div>
          </div>
        </section>

        {/* Category Filter Row */}
        <section className="category-showcase-section">
          <div className="section-head mb-4">
            <div>
              <span className="eyebrow-pill gray">Kategori Belanja</span>
              <h2 className="section-title">Pilih Kategori Kebutuhan Anda</h2>
            </div>
          </div>
          <div className="category-pills-wrap">
            {categories.map((item) => (
              <Link key={item} to="/products" className="category-pill-card">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>{item}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Product Recommendations Section */}
        <section className="product-section" id="produk">
          <div className="section-head">
            <div>
              <span className="eyebrow-pill emerald">Pilihan Terbaik</span>
              <h2 className="section-title">Rekomendasi Produk Hari Ini</h2>
            </div>
            <Link to="/products" className="section-more-link">
              Lihat Semua Produk <ChevronRight className="w-4 h-4 inline" />
            </Link>
          </div>

          <div className="product-grid">
            {featuredProducts.map((item) => (
              <article key={item.name} className="catalog-card hover-lift">
                <div className={`img-box product-art-${item.tag.toLowerCase().replaceAll(' ', '-')}`}>
                  <span className="product-art-label">GLOSIR</span>
                  <small>{item.tag}</small>
                </div>
                <span className="catalog-badge mb-2">{item.tag}</span>
                <h3 className="font-bold text-gray-900 text-base mb-2">{item.name}</h3>
                <div className="product-meta">
                  <div className="price-stack">
                    <strong className="current-price">{item.price}</strong>
                  </div>
                  <Link to="/products" className="btn btn-primary small">
                    Pesan <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Owner Profile Section */}
        <section className="owner-section">
          <div className="owner-card">
            <div className="owner-photo-container">
              <div className="owner-photo-badge">GLOSIR STORE</div>
              <p className="text-sm font-semibold text-gray-700 mt-3 text-center">Pelayanan Dekat & Ramah</p>
            </div>
          </div>
          <div className="owner-copy">
            <span className="eyebrow-pill emerald">Profil Usaha</span>
            <h2 className="section-title">Solusi Belanja Grosir & Parsel Terpercaya</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Glosir hadir sebagai pusat pemenuhan kebutuhan harian, sembako, dan parsel berkualitas. 
              Dengan komitmen pelayanan cepat, transparan, dan jujur, kami siap melayani pelanggan eceran maupun grosir skala usaha.
            </p>
            <div className="owner-badges-list">
              <span className="badge-check-item"><CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-1.5" /> Produk Berkualitas</span>
              <span className="badge-check-item"><CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-1.5" /> Pelayanan Ramah & Cepat</span>
              <span className="badge-check-item"><CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-1.5" /> Siap Order via WhatsApp</span>
            </div>
          </div>
        </section>

        {/* Event & Promo Section */}
        <section className="events-section" id="promo">
          <div className="section-head">
            <div>
              <span className="eyebrow-pill amber"><Sparkles className="w-3.5 h-3.5 inline mr-1" /> Event & Penawaran</span>
              <h2 className="section-title">Promo Spesial Untuk Anda</h2>
            </div>
            <Link to="/promo" className="section-more-link">
              Lihat Semua Promo <ChevronRight className="w-4 h-4 inline" />
            </Link>
          </div>

          <div className="event-grid">
            {events.map((event) => (
              <article key={event.title} className="event-card shadow-sm">
                <span className="event-tag">{event.tag}</span>
                <h3>{event.title}</h3>
                <p>{event.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}


        <section className="category-row">
          {categories.map((item) => (
            <div key={item} className="category-pill">{item}</div>
          ))}
        </section>

        <section className="product-section" id="produk">
          <div className="section-head">
            <div>
              <span className="eyebrow">Produk unggulan</span>
              <h2>Rekomendasi hari ini</h2>
            </div>
            <Link to="/products">Lihat semua</Link>
          </div>

          <div className="product-grid">
            {featuredProducts.map((item) => (
              <article key={item.name} className="product-card">
                <div className={`img-box product-art-${item.tag.toLowerCase().replaceAll(' ', '-')}`}>
                  <span className="product-art-label">GLOSIR</span>
                  <small>{item.tag}</small>
                </div>
                <span className="tag">{item.tag}</span>
                <h3>{item.name}</h3>
                <div className="product-meta">
                  <div className="price-stack">
                    <strong>{item.price}</strong>
                    {item.originalPrice && (
                      <div className="original-price-row">
                        <del className="original-price">{item.originalPrice}</del>
                        {item.discount && <span className="discount-tag small">{item.discount}</span>}
                      </div>
                    )}
                  </div>
                  <Link to="/products" className="btn btn-primary small">Pesan</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="owner-section">
          <div className="owner-card">
            <div className="owner-photo">PEMILIK</div>
          </div>
          <div className="owner-copy">
            <span className="eyebrow dark">Tentang kami</span>
            <h2>Profil pemilik & semangat usaha keluarga.</h2>
            <p>
              Glosir hadir sebagai solusi kebutuhan sehari-hari dan acara keluarga dengan pendekatan
              yang ramah, transparan, dan siap membantu pelanggan memilih produk terbaik sesuai kebutuhan.
            </p>
            <p>
              Kami fokus pada kualitas produk, harga yang adil, dan pelayanan personal yang membuat
              pelanggan merasa dilayani dengan baik dari awal sampai pesanan selesai.
            </p>
            <div className="owner-badges">
              <span>Produk Berkualitas</span>
              <span>Pelayanan Ramah</span>
              <span>Order via WhatsApp</span>
            </div>
          </div>
        </section>

        <section className="events-section" id="promo">
          <div className="section-head">
            <div>
              <span className="eyebrow">Event & promo</span>
              <h2>Siap membantu acara Anda</h2>
            </div>
            <Link to="/promo">Lihat semua promo</Link>
          </div>

          <div className="event-grid">
            {events.map((event) => (
              <article key={event.title} className="event-card">
                <span className="event-tag">{event.tag}</span>
                <h3>{event.title}</h3>
                <p>{event.text}</p>
                <Link to="/promo" className="btn btn-secondary">Lihat detail</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="promo-banner" id="promo">
          <div>
            <span className="eyebrow">Promo spesial</span>
            <h2>Siapkan parcel untuk lebaran & acara keluarga Anda.</h2>
          </div>
          <Link to="/parsel" className="btn btn-primary">Lihat Paket</Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
