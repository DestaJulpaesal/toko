import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, MessageCircle, Menu, X, Clock, Store } from 'lucide-react';
import { useCart } from '../context/CartContext';

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
  const storeWaNumber = import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '';

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
            <Clock size={14} className="icon-inline" /> Buka: 08:00 - 21:00 WIB
          </span>
        </div>
      </div>

      {/* Header Utama */}
      <header className={`topbar-glosir ${menuOpen ? 'menu-open' : ''}`}>
        <div className="header-brand-wrap">
          <Link to="/" className="brand-title">
            Glosir
          </Link>
          <span className="brand-sub">Sembako & Grosir</span>
        </div>

        {/* Form Pencarian Header */}
        <form className="header-search-form" onSubmit={handleSearchSubmit}>
          <div className="search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Cari barang harian..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cari produk"
            />
          </div>
          <button type="submit" className="btn-search">
            Cari
          </button>
        </form>

        {/* Navigasi Utama (Maksimal 4 item) */}
        <nav className={`nav-menu ${menuOpen ? 'is-active' : ''}`} onClick={() => setMenuOpen(false)}>
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
          >
            <MessageCircle size={18} />
            <span className="wa-text">Chat WA</span>
          </a>

          {/* Tombol Keranjang Besar Hijau Solid */}
          <Link to="/cart" className="btn-cart-header" aria-label={`Keranjang, ${totalItems} item`}>
            <ShoppingBag size={20} />
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
            className="mobile-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Menu navigasi"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
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

