import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';
import { useCart } from '../context/CartContext';

const activeVouchers = [
  {
    id: 'promo-lebaran',
    name: 'Promo Lebaran & Hari Raya',
    code: 'LEBARAN15',
    badge: '15% OFF',
    type: 'Persentase',
    highlight: 'Diskon 15% untuk seluruh paket parsel & kebutuhan hari raya',
    minSpend: 100000,
    scope: 'Seluruh Parsel & Kebutuhan Dapur',
    channel: 'Kasir Toko, Web & WhatsApp',
    validUntil: 'Akhir Bulan Ini',
    colorScheme: 'warm',
  },
  {
    id: 'promo-glosir10',
    name: 'Glosir Hemat 10',
    code: 'GLOSIR10',
    badge: '10% OFF',
    type: 'Persentase',
    highlight: 'Diskon 10% untuk belanja sembako dan kebutuhan dapur',
    minSpend: 50000,
    scope: 'Bahan Pokok & Kebutuhan Dapur',
    channel: 'Kasir Toko, Web & WhatsApp',
    validUntil: 'Promo Berjalan',
    colorScheme: 'green',
  },
  {
    id: 'promo-hemat25',
    name: 'Potongan Langsung 25 Ribu',
    code: 'HEMAT25',
    badge: 'POTONGAN Rp 25.000',
    type: 'Potongan Tunai',
    highlight: 'Potongan langsung Rp 25.000 untuk belanja grosir',
    minSpend: 150000,
    scope: 'Belanja Grosir & Bundling Bulanan',
    channel: 'Kasir Toko, Web & WhatsApp',
    validUntil: 'Berlaku Hari Ini',
    colorScheme: 'gold',
  },
  {
    id: 'promo-parsel20',
    name: 'Spesial Parsel & Hajatan',
    code: 'PARSEL20',
    badge: '20% OFF',
    type: 'Spesial Parsel',
    highlight: 'Diskon 20% khusus pemesanan parsel & paket hajatan',
    minSpend: 300000,
    scope: 'Parsel Lebaran & Paket Acara',
    channel: 'Kasir Toko, Web & WhatsApp',
    validUntil: 'Musim Acara & Hari Raya',
    colorScheme: 'purple',
  },
];

const defaultFlashSaleProducts = [
  { id: 1, name: 'Kopi Bubuk Premium', category: 'Glosir', price: 48000, originalPrice: 60000, discountPercent: 20, stock: 25, badge: 'Diskon 20%' },
  { id: 3, name: 'Minyak Goreng 2L', category: 'Kebutuhan Dapur', price: 35000, originalPrice: 40000, discountPercent: 12, stock: 9, badge: 'Diskon 12%' },
  { id: 4, name: 'Parcel Lebaran', category: 'Parsel', price: 120000, originalPrice: 150000, discountPercent: 20, stock: 12, badge: 'Promo Spesial' },
  { id: 6, name: 'Teh Celup 40 pcs', category: 'Minuman', price: 59000, originalPrice: 69000, discountPercent: 14, stock: 20, badge: 'Diskon 14%' },
];

const promoFaqs = [
  {
    q: 'Bagaimana cara menggunakan kode promo ini saat belanja di kasir toko fisik?',
    a: 'Sangat mudah! Saat berada di kasir toko Glosir, cukup tunjukkan kartu promo ini dari ponsel Anda atau sebutkan kode promonya (contoh: LEBARAN15) kepada kasir sebelum pembayaran.'
  },
  {
    q: 'Apakah bisa memesan lewat WhatsApp dan tetap mendapatkan promo?',
    a: 'Tentu bisa! Klik tombol "Klaim via WA" pada kartu promo pilihan Anda. Pesan chat WhatsApp akan otomatis terisi kode promo, dan staf kami akan langsung menghitungkan potongan harga untuk pesanan Anda.'
  },
  {
    q: 'Bagaimana cara menggunakan kode kupon di keranjang belanja website?',
    a: 'Klik tombol "Gunakan Promo" pada voucher di atas, voucher otomatis aktif! Atau salin kodenya, lalu masukkan ke kolom kupon promo di halaman Keranjang Belanja dan klik Gunakan.'
  },
  {
    q: 'Apakah produk yang sedang diskon langsung (Flash Sale) masih bisa ditambah kupon?',
    a: 'Bisa! Diskon produk flash sale langsung memotong harga barang. Jika total belanja Anda memenuhi syarat minimal belanja kupon, Anda tetap bisa memasukkan kode kupon promo untuk hemat ekstra.'
  }
];

export default function PromoPage() {
  const { applyPromo, addItem, promo: appliedPromoCode } = useCart();
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [toastMessage, setToastMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [vouchers, setVouchers] = useState(activeVouchers);
  const [flashSaleProducts, setFlashSaleProducts] = useState(defaultFlashSaleProducts);

  useEffect(() => {
    const loadPromos = async () => {
      try {
        const [promoRes, productRes] = await Promise.all([
          apiFetch('/promos?activeOnly=true').then((res) => res.json()).catch(() => null),
          apiFetch('/products').then((res) => res.json()).catch(() => null),
        ]);

        const promos = promoRes?.success && Array.isArray(promoRes.promos) ? promoRes.promos : [];
        const products = productRes?.success && Array.isArray(productRes.products) ? productRes.products : [];

        if (promos.length > 0) {
          setVouchers(
            promos.map((promo) => ({
              id: promo.id,
              name: promo.name,
              code: promo.name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10) || 'PROMO',
              badge: promo.discountType === 'PERCENT' ? `${promo.discountValue}% OFF` : `POTONGAN Rp ${Number(promo.discountValue || 0).toLocaleString('id-ID')}`,
              type: promo.discountType === 'PERCENT' ? 'Persentase' : 'Potongan Tunai',
              highlight: promo.description || 'Promo aktif dari Glosir untuk kebutuhan belanja Anda.',
              minSpend: 50000,
              scope: 'Semua Produk',
              channel: 'Kasir Toko, Web & WhatsApp',
              validUntil: 'Promo Berjalan',
              colorScheme: promo.discountType === 'FIXED' ? 'gold' : 'green',
            }))
          );
        }

        if (products.length > 0) {
          setFlashSaleProducts(
            products
              .filter((product) => Number(product.originalPrice || 0) > Number(product.price || 0))
              .slice(0, 4)
              .map((product) => ({
                id: product.id,
                name: product.name,
                category: product.category,
                price: Number(product.price || 0),
                originalPrice: Number(product.originalPrice || product.price || 0),
                discountPercent: product.discountPercent || Math.round(((Number(product.originalPrice || product.price || 0) - Number(product.price || 0)) / Number(product.originalPrice || product.price || 1)) * 100),
                stock: Number(product.stock || 0),
                badge: 'Diskon Langsung',
              }))
          );
        }
      } catch {
        setVouchers(activeVouchers);
        setFlashSaleProducts(defaultFlashSaleProducts);
      }
    };

    loadPromos();
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  const copyCode = (code) => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code);
      }
      setCopiedCode(code);
      showToast(`✓ Kode kupon "${code}" berhasil disalin!`);
      setTimeout(() => setCopiedCode(''), 3000);
    } catch {
      showToast(`Kode kupon: ${code}`);
    }
  };

  const handleApplyPromo = (code) => {
    const success = applyPromo(code);
    if (success) {
      showToast(`✓ Promo "${code}" berhasil diaktifkan untuk keranjang belanja Anda!`);
    } else {
      showToast(`Gagal mengaktifkan promo "${code}".`);
    }
  };

  const visibleVouchers = vouchers.filter((v) => {
    if (activeCategory === 'Semua') return true;
    return v.type === activeCategory;
  });

  return (
    <div className="public-page">
      <PublicHeader />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="promo-toast" role="alert">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} aria-label="Tutup">×</button>
        </div>
      )}

      <main className="promo-page-shell">
        {/* Hero Section */}
        <section className="inner-hero promo-hero">
          <div>
            <span className="eyebrow dark">Pusat Promo & Kupon Diskon</span>
            <h1>Hemat Nyata, Belanja Makin Praktis.</h1>
          </div>
          <div>
            <p>
              Dapatkan voucher diskon resmi Glosir untuk belanja sembako, parsel keluarga, dan paket hajatan.
              Berlaku di toko fisik, website, maupun pesan via WhatsApp!
            </p>
            <div className="promo-hero-cta">
              <a href="#daftar-voucher" className="btn btn-primary">Lihat Voucher Promo</a>
              <a href="#flash-sale" className="btn btn-secondary">Produk Diskon Langsung</a>
            </div>
          </div>
        </section>

        {/* 3 Step Guide */}
        <section className="promo-steps-section">
          <div className="promo-section-header">
            <span className="eyebrow">Panduan Mudah</span>
            <h2>3 Langkah Praktis Menggunakan Promo Glosir</h2>
            <p className="section-desc">Tidak perlu bingung! Berikut cara mudah menikmati potongan harga di Glosir:</p>
          </div>

          <div className="promo-steps-grid">
            <div className="step-card">
              <div className="step-badge">01</div>
              <div className="step-icon">📋</div>
              <h3>Pilih & Salin Voucher</h3>
              <p>Pilih voucher yang sesuai di bawah, klik tombol <strong>"Salin Kode"</strong> atau klik <strong>"Gunakan Promo"</strong>.</p>
            </div>
            <div className="step-card">
              <div className="step-badge">02</div>
              <div className="step-icon">🛒</div>
              <h3>Pilih Produk Belanjaan</h3>
              <p>Tambahkan produk sembako, bahan pokok, atau parsel pilihan Anda ke keranjang belanja.</p>
            </div>
            <div className="step-card">
              <div className="step-badge">03</div>
              <div className="step-icon">🎉</div>
              <h3>Nikmati Potongan Harga</h3>
              <p>Masukkan kode di keranjang, atau tunjukkan ke kasir toko, atau kirim ke WhatsApp saat order!</p>
            </div>
          </div>
        </section>

        {/* Voucher List Section */}
        <section className="promo-vouchers-section" id="daftar-voucher">
          <div className="promo-section-header">
            <span className="eyebrow dark">Voucher Aktif</span>
            <h2>Pilih Kupon Diskon Pilihan Anda</h2>
            <p className="section-desc">Salin kodenya dan gunakan saat checkout website, kasir toko, atau via WhatsApp.</p>
          </div>

          {/* Filter Bar */}
          <div className="promo-filter-bar">
            {['Semua', 'Persentase', 'Potongan Tunai', 'Spesial Parsel'].map((cat) => (
              <button
                key={cat}
                className={`promo-filter-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Voucher Cards Grid */}
          <div className="voucher-ticket-grid">
            {visibleVouchers.map((voucher) => {
              const isApplied = appliedPromoCode === voucher.code;
              const waUrl = `https://wa.me/6281234567890?text=${encodeURIComponent(
                `Halo Toko Glosir, saya ingin belanja dengan klaim kode promo: *${voucher.code}* (${voucher.name}). Mohon dibantu pesanannya ya.`
              )}`;

              return (
                <article key={voucher.id} className={`voucher-ticket ${voucher.colorScheme}`}>
                  {/* Left Ticket Stub */}
                  <div className="voucher-stub">
                    <span className="voucher-discount-pill">{voucher.badge}</span>
                    <div className="voucher-stub-label">{voucher.type}</div>
                    <div className="voucher-notch-top" />
                    <div className="voucher-notch-bottom" />
                  </div>

                  {/* Center Content */}
                  <div className="voucher-details">
                    <div className="voucher-header">
                      <span className="voucher-channel-tag">{voucher.channel}</span>
                      <span className="voucher-validity">Berlaku: {voucher.validUntil}</span>
                    </div>
                    <h3 className="voucher-title">{voucher.name}</h3>
                    <p className="voucher-highlight">{voucher.highlight}</p>

                    <div className="voucher-terms-list">
                      <div className="term-item">
                        <span className="term-label">Min. Belanja:</span>
                        <strong className="term-val">Rp {voucher.minSpend.toLocaleString('id-ID')}</strong>
                      </div>
                      <div className="term-item">
                        <span className="term-label">Kategori:</span>
                        <span className="term-val">{voucher.scope}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Stub */}
                  <div className="voucher-action-stub">
                    <div className="voucher-code-box">
                      <span className="code-label">KODE PROMO</span>
                      <strong className="code-display">{voucher.code}</strong>
                    </div>

                    <div className="voucher-action-buttons">
                      <button
                        className={`btn-copy-code ${copiedCode === voucher.code ? 'copied' : ''}`}
                        onClick={() => copyCode(voucher.code)}
                        title="Salin kode promo"
                      >
                        {copiedCode === voucher.code ? '✓ Tersalin' : 'Salin Kode'}
                      </button>

                      <button
                        className={`btn-use-promo ${isApplied ? 'applied' : ''}`}
                        onClick={() => handleApplyPromo(voucher.code)}
                      >
                        {isApplied ? '✓ Promo Aktif' : 'Gunakan di Web'}
                      </button>

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-wa-claim"
                        title="Klaim via WhatsApp"
                      >
                        Klaim via WA
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Flash Sale Section (Products with Direct Discounts) */}
        <section className="promo-flash-section" id="flash-sale">
          <div className="promo-section-header">
            <div>
              <span className="eyebrow">Diskon Langsung</span>
              <h2>Produk Diskon Spesial Hari Ini</h2>
              <p className="section-desc">Tanpa perlu kode kupon! Harga di bawah ini sudah otomatis dipotong diskon khusus.</p>
            </div>
            <Link to="/products" className="btn btn-secondary">Lihat Semua Produk Diskon</Link>
          </div>

          <div className="promo-product-grid">
            {flashSaleProducts.map((product) => (
              <article key={product.id} className="catalog-card promo-product-card">
                <div className="catalog-badges-wrap">
                  <span className="catalog-badge">{product.badge}</span>
                  <span className="discount-tag">-{product.discountPercent}%</span>
                </div>
                <Link to={`/products/${product.id}`} className="catalog-image product-art-link">
                  <span className="product-art-label">{product.name.split(' ').slice(0, 2).join(' ')}</span>
                  <small>{product.category}</small>
                </Link>
                <Link to={`/products/${product.id}`} className="catalog-title-link">
                  <h3>{product.name}</h3>
                </Link>
                <p>{product.category}</p>

                <div className="catalog-meta">
                  <div className="price-stack">
                    <strong className="current-price">Rp {product.price.toLocaleString('id-ID')}</strong>
                    <div className="original-price-row">
                      <del className="original-price">Rp {product.originalPrice.toLocaleString('id-ID')}</del>
                      <span className="save-pill">Hemat Rp {(product.originalPrice - product.price).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <small>{product.stock} stok</small>
                </div>

                <div className="promo-card-actions">
                  <button
                    className="btn btn-primary full"
                    onClick={() => {
                      addItem(product);
                      showToast(`✓ "${product.name}" berhasil ditambahkan ke keranjang!`);
                    }}
                  >
                    Tambah ke Keranjang
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="promo-faq-section">
          <div className="promo-section-header">
            <span className="eyebrow dark">Tanya Jawab</span>
            <h2>Pertanyaan Seputar Promo Glosir</h2>
            <p className="section-desc">Jawaban lengkap atas hal-hal yang sering ditanyakan pelanggan mengenai voucher promo.</p>
          </div>

          <div className="promo-faq-grid">
            {promoFaqs.map((faq, index) => (
              <div key={index} className="faq-card">
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Banner */}
        <section className="promo-bottom-banner">
          <div>
            <span className="eyebrow light">Mau Pesanan Khusus?</span>
            <h2>Pesan Parsel & Kebutuhan Acara dalam Jumlah Besar?</h2>
            <p>Dapatkan penawaran harga grosir dan diskon khusus tambahan dengan berbicara langsung bersama tim kami.</p>
          </div>
          <div className="banner-buttons">
            <Link to="/products" className="btn btn-secondary">Belanja Sekarang</Link>
            <a
              href="https://wa.me/6281234567890?text=Halo%20Glosir,%20saya%20ingin%20tanya%20paket%20grosir%20dan%20promo%20acara"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              Hubungi via WhatsApp
            </a>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
