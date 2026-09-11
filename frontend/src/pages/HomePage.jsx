import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';

const categories = ['Kebutuhan Harian', 'Parsel', 'Promo', 'Acara'];

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
              name: product.name,
              price: `Mulai Rp ${Number(product.price || 0).toLocaleString('id-ID')}`,
              tag: product.badge || (product.category || 'Popular'),
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
              name: parcel.name,
              price: `Mulai Rp ${Number(parcel.price || 0).toLocaleString('id-ID')}`,
              tag: parcel.type === 'CUSTOM' ? 'Custom' : 'Parsel',
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
    <div className="glosir-shell">
      <PublicHeader />

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <span className="pill">Toko Glosir & Parcel Terpercaya</span>
            <h1>Nikmati kebutuhan harian dan paket spesial dengan proses yang lebih praktis.</h1>
            <p>
              Glosir membantu pelanggan kebutuhan rumah tangga, usaha kecil, dan acara keluarga
              dengan pilihan produk yang relevan, harga jelas, dan pelayanan yang cepat.
            </p>
            <div className="hero-actions">
              <Link to="/products" className="btn btn-primary">Lihat Produk</Link>
              <Link to="/contact-us" className="btn btn-secondary">Hubungi Kami</Link>
            </div>
            <div className="stats">
              <div><strong>Jelas</strong><span>Harga & proses</span></div>
              <div><strong>Praktis</strong><span>Order cepat</span></div>
              <div><strong>Responsif</strong><span>Pelayanan ramah</span></div>
            </div>
          </div>

          <div className="hero-card">
            <div className="mini-card top">
              <span>Best Seller</span>
              <strong>Parcel Lebaran</strong>
              <small>Rp 120.000</small>
            </div>
            <div className="mini-card highlight">
              <span>Promo</span>
              <strong>Diskon 15%</strong>
              <small>Untuk pembelian 3 item</small>
            </div>
          </div>
        </section>

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
