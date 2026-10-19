import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, MessageCircle, Menu, X, Clock, Store } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { usePublicSettings } from '../context/PublicSettingsContext';
import { normalizeIndonesianPhone } from '../utils/phoneUtils';

// Flag opsional menu musiman Parsel Lebaran (bisa diatur dari config)
const SHOW_PARSEL_LEBARAN = false;

const mainNavigation = [
  { label: 'Beranda', to: '/' },
  { label: 'Katalog Produk', to: '/products' },
  { label: 'Promo', to: '/promo' },
  { label: 'Kontak', to: '/contact-us' },
];

if (SHOW_PARSEL_LEBARAN) {
  mainNavigation.splice(2, 0, { label: 'Parsel Lebaran', to: '/parsel' });
}

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { totalItems, totalPrice } = useCart();
  const { storeProfile } = usePublicSettings();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('glosir_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const portalLink = currentUser?.role === 'OWNER' ? '/admin' : '/kasir';
  const portalLabel = currentUser?.role === 'OWNER' ? 'Admin' : 'Kasir';
  const storeWaNumber = normalizeIndonesianPhone(storeProfile.phone || import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '');
  const storeName = storeProfile.name || 'Glosir';

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setMenuOpen(false);
    }
  };

  return (
    <>
      {/* Top Bar Informasi */}
      <div className="public-topbar-info">
        <div className="topbar-info-container">
          <span className="info-badge">
            <Store size={14} className="icon-inline" /> Pesan online, ambil di toko
          </span>
          <span className="info-hours">
            <Clock size={14} className="icon-inline" /> {storeProfile.openingHours || 'Jam buka belum tersedia'}
          </span>
        </div>
      </div>

      {/* Header Utama */}
      <header className={`topbar-glosir ${menuOpen ? 'menu-open' : ''}`}>
        <div className="header-inner">
          <div className="header-brand-wrap">
            <span className="brand-mark" aria-hidden="true"><Store size={21} strokeWidth={2.5} /></span>
            <Link to="/" className="brand-title">
              {storeName}
            </Link>
            <span className="brand-sub">Sembako & Grosir</span>
          </div>

          {/* Form Pencarian Header */}
          <form className="header-search-form" role="search" aria-label="Cari produk di katalog" onSubmit={handleSearchSubmit}>
            <div className="search-input-wrap">
              <Search size={19} className="search-icon" aria-hidden="true" />
              <input
                type="search"
                placeholder="Cari beras, minyak, dan lainnya"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Cari nama barang"
              />
            </div>
            <button type="submit" className="btn-search">
              Cari
            </button>
          </form>

          {/* Navigasi Utama (Maksimal 4 item) */}
          <nav
            id="public-main-navigation"
            aria-label="Navigasi utama"
            className={`nav-menu ${menuOpen ? 'is-active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {mainNavigation.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active-link' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Action Buttons Header */}
          <div className="header-actions">
            {currentUser && (
              <Link to={portalLink} className="btn-portal" title={portalLabel}>
                {portalLabel}
              </Link>
            )}

            {/* Tombol Chat WhatsApp */}
            <a
              href={`https://wa.me/${storeWaNumber}?text=${encodeURIComponent('Halo Glosir, saya ingin bertanya tentang produk toko.')}`}
              target="_blank"
              rel="noreferrer"
              className="btn-wa-header"
              aria-label="Hubungi toko lewat WhatsApp"
            >
              <MessageCircle size={18} aria-hidden="true" />
              <span className="wa-text">Chat WA</span>
            </a>

            {/* Tombol Keranjang Besar Hijau Solid */}
            <Link to="/cart" className="btn-cart-header" aria-label={`Keranjang, ${totalItems} item`}>
              <ShoppingBag size={20} aria-hidden="true" />
              <span className="cart-label-wrap">
                <strong>Keranjang</strong>
                <small>
                  {totalItems > 0
                    ? `${totalItems} item • Rp ${totalPrice.toLocaleString('id-ID')}`
                    : '0 item'}
                </small>
              </span>
            </Link>

            {/* Hamburger Mobile Menu */}
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              aria-expanded={menuOpen}
              aria-controls="public-main-navigation"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Floating Bottom Bar Keranjang di HP */}
      <div className="mobile-floating-cart">
        <div className="floating-cart-info">
          <ShoppingBag size={22} />
          <div>
            <div className="floating-qty">{totalItems} Item di keranjang</div>
            <div className="floating-price">Total: Rp {totalPrice.toLocaleString('id-ID')}</div>
          </div>
        </div>
        <Link to="/cart" className="btn-floating-checkout">
          Lihat Keranjang
        </Link>
      </div>
    </>
  );
}
