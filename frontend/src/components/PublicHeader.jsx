import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
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
  { label: 'Kontak', to: '/contact-us' },
];

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [headerSearch, setHeaderSearch] = useState('');
  const storeWhatsAppNumber = String(import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const hasStoreWhatsApp = /^\d{8,15}$/.test(storeWhatsAppNumber);
  const { totalItems } = useCart();
  const { favorites } = useFavorites();

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
  const portalLabel = currentUser?.role === 'OWNER' ? 'Dashboard Admin' : 'Portal Kasir';

  return (
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
  );
}
