import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, MessageCircle, Menu, X, Clock, Store } from 'lucide-react';
import { useCart } from '../context/CartContext';
<<<<<<< HEAD

// Flag opsional menu musiman Parsel Lebaran (bisa diatur dari config)
const SHOW_PARSEL_LEBARAN = false;

const mainNavigation = [
  { label: 'Beranda', to: '/' },
  { label: 'Katalog Produk', to: '/products' },
  { label: 'Promo', to: '/promo' },
=======
import { useFavorites } from '../context/FavoritesContext';
import { 
  ShoppingCart, 
  Star, 
  MessageCircle, 
  UserCheck, 
  Menu, 
  X, 
  Search,
  Store,
  Phone,
  Clock,
  Sparkles
} from 'lucide-react';

const navigation = [
  { label: 'Beranda', to: '/' },
  { label: 'Katalog Produk', to: '/products' },
  { label: 'Parsel Lebaran', to: '/parsel' },
  { label: 'Promo Spesial', to: '/promo' },
  { label: 'Profil Toko', to: '/profil' },
  { label: 'Pusat Bantuan', to: '/faq' },
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
  { label: 'Kontak', to: '/contact-us' },
];

if (SHOW_PARSEL_LEBARAN) {
  mainNavigation.splice(2, 0, { label: 'Parsel Lebaran', to: '/parsel' });
}

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
<<<<<<< HEAD
  const [searchQuery, setSearchQuery] = useState('');
  const { totalItems, totalPrice } = useCart();
  const navigate = useNavigate();
=======
  const [headerSearch, setHeaderSearch] = useState('');
  const storeWhatsAppNumber = String(import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const hasStoreWhatsApp = /^\d{8,15}$/.test(storeWhatsAppNumber);
  const { totalItems } = useCart();
  const { favorites } = useFavorites();
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce

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
<<<<<<< HEAD
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
        <div className="header-inner">
          <div className="header-brand-wrap">
            <span className="brand-mark" aria-hidden="true"><Store size={21} strokeWidth={2.5} /></span>
            <Link to="/" className="brand-title">
              Glosir
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
=======
    <header className="public-top-header">
      {/* Utility Bar (Top Strip) */}
      <div className="header-utility-bar">
        <div className="utility-container">
          <div className="utility-left">
            <span className="utility-item"><Store className="w-3.5 h-3.5 inline mr-1" /> Toko Grosir & Eceran Terpercaya</span>
            <span className="utility-divider">•</span>
            <span className="utility-item"><Clock className="w-3.5 h-3.5 inline mr-1" /> Buka Setiap Hari (08:00 - 21:00 WIB)</span>
          </div>
          <div className="utility-right">
            {hasStoreWhatsApp && (
              <a href={`https://wa.me/${storeWhatsAppNumber}`} target="_blank" rel="noreferrer" className="utility-item hover-link">
                <Phone className="w-3.5 h-3.5 inline mr-1" /> CS WhatsApp
              </a>
            )}
            {currentUser && (
              <Link to={portalLink} className="utility-portal-badge">
                <UserCheck className="w-3.5 h-3.5 inline mr-1" /> {portalLabel}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Header Row */}
      <div className="header-main-bar">
        <div className="main-header-container">
          {/* Brand Logo */}
          <Link to="/" className="brand-wrapper">
            <div className="brand-logo-box">
              <span className="brand-logo-icon">G</span>
            </div>
            <div className="brand-text-stack">
              <span className="brand-title">GLOSIR</span>
              <span className="brand-subtitle">GROSIR & PARCEL</span>
            </div>
          </Link>

          {/* Quick Global Search Bar */}
          <div className="header-search-wrap">
            <form onSubmit={(e) => { e.preventDefault(); if (headerSearch.trim()) window.location.href = `/products?search=${encodeURIComponent(headerSearch)}`; }}>
              <div className="header-search-input-group">
                <Search className="header-search-icon" />
                <input 
                  type="text" 
                  value={headerSearch} 
                  onChange={(e) => setHeaderSearch(e.target.value)} 
                  placeholder="Cari kebutuhan harian, sembako, parsel..."
                  className="header-search-input" 
                />
                <button type="submit" className="header-search-btn">
                  Cari
                </button>
              </div>
            </form>
          </div>

          {/* Actions (Favorit, Cart, WA) */}
          <div className="header-actions-group">
            <Link to="/favorit" className="header-icon-action-btn" title="Produk Favorit">
              <div className="icon-badge-wrap">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                {favorites.length > 0 && <span className="action-badge amber">{favorites.length}</span>}
              </div>
              <span className="action-label">Favorit</span>
            </Link>

            <Link to="/cart" className="header-icon-action-btn" title="Keranjang Belanja">
              <div className="icon-badge-wrap">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                {totalItems > 0 && <span className="action-badge emerald">{totalItems}</span>}
              </div>
              <span className="action-label">Keranjang</span>
            </Link>

            {hasStoreWhatsApp && (
              <a
                href={`https://wa.me/${storeWhatsAppNumber}`}
                target="_blank"
                rel="noreferrer"
                className="btn-wa-header"
              >
                <MessageCircle className="w-4 h-4 text-white inline" />
                <span>Order WA</span>
              </a>
            )}

            {/* Mobile Hamburger toggle */}
            <button 
              className="mobile-hamburger-btn" 
              onClick={() => setMenuOpen((open) => !open)} 
              aria-label="Toggle Navigation"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Category Nav Bar */}
      <nav className={`header-category-nav ${menuOpen ? 'mobile-open' : ''}`}>
        <div className="nav-container">
          <div className="nav-scroll-wrapper">
            {navigation.map((item) => (
              <NavLink 
                key={item.to} 
                to={item.to} 
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-link-pill ${isActive ? 'active' : ''}`}
              >
                {item.label === 'Promo Spesial' && <Sparkles className="w-3.5 h-3.5 text-amber-500 inline mr-1" />}
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </header>
>>>>>>> 1269403bf23387faac28fbe9b9d1c3a919191dce
  );
}
