import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';

const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Profil', to: '/profil' },
  { label: 'Produk', to: '/products' },
  { label: 'Parsel', to: '/parsel' },
  { label: 'Promo', to: '/promo' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Kontak', to: '/contact-us' },
];

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
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
    <header className={`topbar ${menuOpen ? 'menu-open' : ''}`}>
      <Link to="/" className="brand">Glosir</Link>
      <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Buka menu navigasi" aria-expanded={menuOpen}>
        <span />
        <span />
        <span />
      </button>
      <nav className="nav" onClick={() => setMenuOpen(false)}>
        {navigation.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="actions">
        {currentUser && (
          <Link to={portalLink} className="btn btn-light" style={{ borderColor: '#3bb976', color: '#1b6336' }}>
            {portalLabel}
          </Link>
        )}
        <Link to="/favorit" className="favorite-nav-link" aria-label={`Favorit, ${favorites.length} produk`}><span>star</span><b>{favorites.length}</b></Link>
        <Link to="/cart" className="cart-nav-link" aria-label={`Keranjang, ${totalItems} item`}><span className="cart-icon">cart</span><b>{totalItems}</b></Link>
        <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer" className="btn btn-primary">Pesan via WhatsApp</a>
      </div>
    </header>
  );
}
