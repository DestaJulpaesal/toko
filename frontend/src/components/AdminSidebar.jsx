import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { Archive, CalendarRange, ClipboardCheck, FileText, Globe2, History, LayoutDashboard, LogOut, MapPinned, Package, Percent, Settings, ShoppingCart, Tags, Users, WalletCards } from 'lucide-react';

const ownerGroups = [
  { label: 'Ringkasan', links: [['01', 'Dashboard', '/admin']] },
  {
    label: 'Penjualan',
    links: [['02', 'Kasir', '/kasir'], ['03', 'Riwayat Transaksi', '/kasir/riwayat'], ['04', 'Data Pelanggan', '/admin/customers']],
  },
  {
    label: 'Katalog',
    links: [['05', 'Produk', '/admin/products'], ['06', 'Kategori', '/admin/categories'], ['07', 'Promo', '/admin/promos']],
  },
  {
    label: 'Parsel',
    links: [['08', 'Parsel', '/admin/parcels'], ['09', 'Peserta Parsel', '/admin/parcel-participants'], ['10', 'Penagihan Wilayah', '/admin/parcel-collections'], ['11', 'Program Parsel', '/admin/parcel-programs'], ['12', 'Wilayah Parsel', '/admin/parcel-regions']],
  },
  {
    label: 'Keuangan',
    links: [['11', 'Keuangan', '/admin/finance'], ['12', 'Catatan Pribadi', '/admin/personal-finance']],
  },
  { label: 'Website', links: [['13', 'Konten Publik', '/admin/content'], ['14', 'Profil', '/admin/profile']] },
  { label: 'Kontrol', links: [['15', 'Stok Opname', '/admin/stock-opname'], ['16', 'Paket Acara', '/admin/event-packages']] },
];

const cashierGroups = [
  { label: 'Operasional', links: [['01', 'Kasir', '/kasir'], ['02', 'Riwayat Transaksi', '/kasir/riwayat']] },
];

const parcelManagerGroups = [
  { label: 'Wilayah Saya', links: [['01', 'Peserta Parsel', '/parcel-manager'], ['02', 'Penagihan Wilayah', '/parcel-manager/collections']] },
];

export default function AdminSidebar({ active = '' }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [largeText, setLargeText] = useState(() => localStorage.getItem('glosir_large_text') === 'true');

  useEffect(() => {
    document.documentElement.style.setProperty('--base-font-size', largeText ? '20px' : '16px');
    localStorage.setItem('glosir_large_text', String(largeText));
  }, [largeText]);
  const navRef = useRef(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('glosir_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      } else {
        // Default fallback if no stored user
        setCurrentUser({ name: 'Kasir Glosir', role: 'CASHIER' });
      }
    } catch {
      setCurrentUser({ name: 'Kasir Glosir', role: 'CASHIER' });
    }
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'PARCEL_MANAGER') return undefined;
    const refreshPending = async () => {
      const since = localStorage.getItem('glosir_orders_last_seen') || new Date(0).toISOString();
      try {
        const response = await apiFetch(`/orders/unread-count?since=${encodeURIComponent(since)}`);
        const data = await response.json();
        if (data.success) setPendingOrderCount(data.count || 0);
      } catch { setPendingOrderCount(0); }
    };
    refreshPending();
    const timer = window.setInterval(refreshPending, 15000);
    return () => window.clearInterval(timer);
  }, [currentUser]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    const savedScrollTop = Number(sessionStorage.getItem('glosir-sidebar-scroll') || 0);
    nav.scrollTop = savedScrollTop;
    const handleScroll = () => sessionStorage.setItem('glosir-sidebar-scroll', String(nav.scrollTop));
    nav.addEventListener('scroll', handleScroll, { passive: true });

    return () => nav.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('glosir_token');
    localStorage.removeItem('glosir_user');
    navigate('/login');
  };

  const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 1025px)').matches) {
      setCollapsed((value) => !value);
    } else {
      setMenuOpen((open) => !open);
    }
  };

  const isCashier = currentUser?.role === 'CASHIER';
  const isParcelManager = currentUser?.role === 'PARCEL_MANAGER';
  const visibleGroups = (isParcelManager ? parcelManagerGroups : isCashier ? cashierGroups : ownerGroups).map((group) => ({
    ...group,
    links: group.links.filter(([, label]) => label.toLowerCase().includes(sidebarSearch.toLowerCase().trim())),
  })).filter((group) => group.links.length > 0);

  return (
    <aside className={`admin-sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <div
        className="admin-brand"
        role="button"
        tabIndex={0}
        title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
        onClick={toggleSidebar}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') toggleSidebar();
        }}
      >
        <span className="brand-mark">G</span>
        <div className="admin-brand-copy">
          <strong>Glosir</strong>
          <small>{isParcelManager ? 'Manager Parsel' : isCashier ? 'Portal Karyawan' : 'Owner Workspace'}</small>
        </div>
      </div>

      <nav ref={navRef} className={menuOpen ? 'admin-nav-open' : ''} onClick={() => setMenuOpen(false)}>
        <label className="sidebar-search" onClick={(event) => event.stopPropagation()}>
          <span aria-hidden="true">⌕</span>
          <input value={sidebarSearch} onChange={(event) => setSidebarSearch(event.target.value)} placeholder="Cari menu" aria-label="Cari menu sidebar" />
        </label>
        {visibleGroups.map((group) => (
          <div className="sidebar-nav-group" key={group.label}>
            <span className="nav-label">{group.label}</span>
            {group.links.map(([number, label, to]) => (
              <Link key={to} title={label} className={active === label || (label === 'Kasir' && active === 'Kasir') ? 'active' : ''} to={to} onClick={() => label === 'Riwayat Transaksi' && localStorage.setItem('glosir_orders_last_seen', new Date().toISOString())}>
                <span className="sidebar-icon" aria-hidden="true">{getSidebarIcon(label, number)}</span>
                <span className="sidebar-link-label">{label}</span>{label === 'Riwayat Transaksi' && pendingOrderCount > 0 && <span className="sidebar-order-badge">{pendingOrderCount > 99 ? '99+' : pendingOrderCount}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-upgrade">
        <strong>{isParcelManager ? 'Wilayah Parsel' : isCashier ? 'Workspace Kasir' : 'Glosir Pro'} <span aria-hidden="true">✦</span></strong>
        <small>{isParcelManager ? 'Pantau peserta wilayah' : isCashier ? 'Operasional siap digunakan' : 'Kelola toko lebih mudah'}</small>
        <Link to={isParcelManager ? '/parcel-manager' : isCashier ? '/kasir' : '/admin/finance'}>{isParcelManager ? 'Buka wilayah' : isCashier ? 'Buka kasir' : 'Lihat insight'} <span aria-hidden="true">→</span></Link>
      </div>

      <div className="sidebar-profile">
        <span className="avatar">{isParcelManager ? 'PM' : isCashier ? 'KS' : 'OG'}</span>
        <div className="sidebar-profile-copy">
          <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUser?.name || (isParcelManager ? 'Manager Parsel' : isCashier ? 'Kasir Glosir' : 'Owner Glosir')}
          </strong>
          <small>{isParcelManager ? 'Manager Wilayah' : isCashier ? 'Karyawan / Kasir' : 'Administrator'}</small>
        </div>
        <button
          onClick={handleLogout}
          title="Keluar / Logout"
          className="sidebar-logout-btn"
          aria-label="Logout"
        >
          <LogOut size={15} aria-hidden="true" />
          <span className="sidebar-logout-label">Keluar</span>
        </button>
        <button type="button" className="sidebar-text-size" onClick={() => setLargeText((value) => !value)} title="Perbesar teks">A<span>+</span></button>
      </div>
    </aside>
  );
}

function getSidebarIcon(label, fallback) {
  const icons = {
    Dashboard: LayoutDashboard,
    Kasir: ShoppingCart,
    'Riwayat Transaksi': History,
    'Data Pelanggan': Users,
    Produk: Package,
    Kategori: Tags,
    Promo: Percent,
    Parsel: Archive,
    'Peserta Parsel': Users,
    'Penagihan Wilayah': WalletCards,
    'Program Parsel': CalendarRange,
    'Wilayah Parsel': MapPinned,
    Keuangan: WalletCards,
    'Catatan Pribadi': FileText,
    'Konten Publik': Globe2,
    Profil: Settings,
    'Stok Opname': ClipboardCheck,
    'Paket Acara': Package,
  };
  const Icon = icons[label];
  return Icon ? <Icon size={16} strokeWidth={1.9} aria-hidden="true" /> : fallback;
}
