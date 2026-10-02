import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, PackageCheck, Search, ShieldCheck, Sparkles, Store, Truck } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import CatalogImage from '../components/CatalogImage';
import { apiFetch } from '../services/api';
import { buildProductShareUrl, buildPromoWhatsAppLink, buildWhatsAppOrderLink } from '../utils/shareLink';
import { getUrgencyState } from '../utils/urgency';

const formatPrice = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
    const loadPublicContent = async () => {
      try {
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
      }
    };

    loadPublicContent();
  }, []);

  const heroProduct = featuredProducts[0];
  const spotlightPromo = promotions[0];
  const urgencyDeadline = useMemo(() => new Date(Date.now() + (1000 * 60 * 60 * 36) + (1000 * 60 * 18)), []);
  const [urgencyState, setUrgencyState] = useState(() => getUrgencyState(urgencyDeadline));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setUrgencyState(getUrgencyState(urgencyDeadline));
    }, 60000);

    return () => window.clearInterval(interval);
  }, [urgencyDeadline]);

  const spotlightPromoLink = spotlightPromo ? buildPromoWhatsAppLink(import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '', spotlightPromo.title, spotlightPromo.description, '/promo') : '#';
  const bestSellers = featuredProducts.slice(0, 4);

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

        <section className="home-need-section" aria-labelledby="home-need-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker">Belanja sesuai kebutuhan</span>
              <h2 id="home-need-title">Pilih yang paling cocok hari ini</h2>
            </div>
            <Link to="/products" className="home-text-link">Lihat katalog <ArrowRight size={16} /></Link>
          </div>

          <div className="home-need-grid">
            {productCategories.length > 0 ? (
              productCategories.slice(0, 4).map((category, index) => (
                <Link key={category} to={`/products?search=${encodeURIComponent(category)}`} className={`home-need-card need-${index + 1}`}>
                  <span>{index === 0 ? 'Rumah' : index === 1 ? 'Belanja' : index === 2 ? 'Acara' : 'Hemat'}</span>
                  <strong>{category}</strong>
                  <small>Cek produk favorit di kategori ini.</small>
                  <ArrowRight size={16} />
                </Link>
              ))
            ) : (
              [
                { label: 'Sembako', tag: 'Rumah', path: '/products?search=' + encodeURIComponent('Sembako') },
                { label: 'Kebutuhan Rumah', tag: 'Harian', path: '/products?search=' + encodeURIComponent('Kebutuhan Rumah') },
                { label: 'Parsel', tag: 'Acara', path: '/products?search=' + encodeURIComponent('Parsel') },
                { label: 'Promo', tag: 'Hemat', path: '/promo' },
              ].map((item, index) => (
                <Link key={item.label} to={item.path} className={`home-need-card need-${index + 1}`}>
                  <span>{item.tag}</span>
                  <strong>{item.label}</strong>
                  <small>Cek produk favorit di kategori ini.</small>
                  <ArrowRight size={16} />
                </Link>
              ))
            )}
          </div>
        </section>

        {spotlightPromo && (
          <section className="promo-spotlight" aria-label="Promo utama hari ini">
            <div className="promo-spotlight-copy">
              <span className="promo-spotlight-kicker">Promo hari ini</span>
              <h3>{spotlightPromo.title}</h3>
              <p>{spotlightPromo.description}</p>
            </div>
            <div className="promo-spotlight-actions">
              <Link to="/promo" className="home-secondary-link">Lihat semua promo</Link>
              <a href={spotlightPromoLink} target="_blank" rel="noreferrer" className="home-primary-link">Klaim via WA</a>
            </div>
          </section>
        )}

        <section className="home-urgency-banner" aria-label="Promo berakhir segera">
          <div className="home-urgency-copy">
            <span className="promo-spotlight-kicker">Promo terbatas</span>
            <h3>Pesan cepat sebelum penawaran berakhir.</h3>
          </div>
          <div className="home-urgency-timer" aria-live="polite">
            <div><strong>{urgencyState.days}</strong><small>Hari</small></div>
            <div><strong>{urgencyState.hours}</strong><small>Jam</small></div>
            <div><strong>{urgencyState.minutes}</strong><small>Menit</small></div>
          </div>
          <a href={spotlightPromoLink} target="_blank" rel="noreferrer" className="home-primary-link">Ambil sekarang</a>
        </section>

        <section className="home-bestseller-section" aria-labelledby="home-bestseller-title">
          <div className="home-section-heading">
            <div>
              <span className="home-section-kicker">Paling laris</span>
              <h2 id="home-bestseller-title">Best seller minggu ini</h2>
            </div>
            <Link to="/products" className="home-text-link">Lihat semua <ArrowRight size={16} /></Link>
          </div>

          <div className="home-bestseller-grid">
            {bestSellers.map((product) => {
              const orderLink = buildWhatsAppOrderLink(import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '', product.name, 1, buildProductShareUrl(product));
              return (
                <article key={product.id} className="home-bestseller-card">
                  <div className="home-bestseller-ribbon">Best seller</div>
                  <Link to={product.detailPath || `/products/${product.id}`} className="home-bestseller-image" aria-label={`Lihat ${product.name}`}>
                    <CatalogImage src={product.imageUrl} alt={product.name}>
                      <div className="home-product-placeholder" aria-hidden="true">
                        <PackageCheck size={28} strokeWidth={1.3} />
                        <span>{product.category || 'Produk Glosir'}</span>
                      </div>
                    </CatalogImage>
                  </Link>
                  <div className="home-bestseller-content">
                    <span className="home-product-category">{product.category || 'Kebutuhan harian'}</span>
                    <Link to={product.detailPath || `/products/${product.id}`} className="home-product-name">{product.name}</Link>
                    <strong className="home-bestseller-price">{formatPrice(product.price)}</strong>
                    <a href={orderLink} target="_blank" rel="noreferrer" className="home-bestseller-cta">Order sekarang</a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

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
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
