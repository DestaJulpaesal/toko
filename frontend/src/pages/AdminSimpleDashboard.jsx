import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  Package,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminSimpleDashboard() {
  const [summary, setSummary] = useState({ income: 0, weekIncome: 0, lowStock: 0, dueDebts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let active = true;
    let loadingRequest = false;
    const load = async (initial = false) => {
      if (loadingRequest) return;
      loadingRequest = true;
      try {
        setError('');
        const response = await apiFetch('/admin/dashboard/summary', { silentNotify: true });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Ringkasan toko gagal dimuat.');
        if (!active) return;
        setSummary({
          income: data.summary.income,
          weekIncome: data.summary.weekIncome,
          lowStock: data.summary.lowStock,
          dueDebts: data.summary.dueDebts,
        });
        setLastUpdated(new Date());
      } catch {
        if (active) setError('Gagal memuat data ringkasan. Coba refresh halaman.');
      } finally {
        loadingRequest = false;
        if (active && initial) setLoading(false);
      }
    };
    load(true);
    const timer = window.setInterval(() => load(), 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const cards = [
    {
      label: 'Pemasukan hari ini',
      value: money(summary.income),
      hint: 'Uang masuk yang tercatat hari ini',
      icon: CircleDollarSign,
      className: 'simple-card-green',
      to: '/admin/finance',
    },
    {
      label: 'Stok menipis',
      value: `${summary.lowStock} barang`,
      hint: summary.lowStock ? 'Periksa sebelum kehabisan' : 'Tidak ada stok yang perlu dicek',
      icon: TriangleAlert,
      className: summary.lowStock ? 'simple-card-alert' : 'simple-card-blue',
      to: '/admin/products',
    },
    {
      label: 'Piutang jatuh tempo',
      value: `${summary.dueDebts} orang`,
      hint: summary.dueDebts ? 'Perlu ditindaklanjuti' : 'Tidak ada piutang jatuh tempo',
      icon: WalletCards,
      className: summary.dueDebts ? 'simple-card-alert' : 'simple-card-violet',
      to: '/admin/debts',
    },
    {
      label: 'Pemasukan 7 hari',
      value: money(summary.weekIncome),
      hint: 'Total pemasukan minggu ini',
      icon: ShoppingCart,
      className: 'simple-card-blue',
      to: '/admin/finance',
    },
  ];

  const quickActions = [
    { label: 'Buka kasir', hint: 'Mulai transaksi penjualan', to: '/kasir', icon: ShoppingCart, className: 'quick-action-green' },
    { label: 'Catat uang keluar', hint: 'Belanja barang atau biaya toko', to: '/admin/finance', icon: WalletCards, className: 'quick-action-blue' },
    { label: 'Periksa stok', hint: 'Cari barang yang perlu ditambah', to: '/admin/products', icon: Package, className: 'quick-action-yellow' },
    { label: 'Kelola parsel', hint: 'Atur paket dan penagihan', to: '/admin/parcels', icon: Archive, className: 'quick-action-violet' },
  ];

  return (
    <AdminShell active="Dashboard" className="admin-simple-shell" mainClassName="simple-dashboard-main">
      <div className="simple-dashboard">
        <header className="simple-dashboard-hero">
          <div className="simple-dashboard-hero-copy">
            <span className="simple-dashboard-kicker"><Sparkles size={14} aria-hidden="true" /> Dashboard toko</span>
            <h1>Semua yang penting,<br />langsung terlihat.</h1>
            <p>Pantau uang masuk, stok, dan piutang. Lanjutkan pekerjaan toko dari satu tempat.</p>
            <div className="simple-dashboard-sync">
              <span className={`simple-sync-dot ${!error && lastUpdated ? 'is-ready' : ''}`} />
              <span>{loading ? 'Mengambil data terbaru...' : error ? 'Data perlu diperbarui' : `Data diperbarui ${lastUpdated?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`}</span>
            </div>
          </div>
          <Link to="/kasir" className="simple-dashboard-primary-action">
            <span className="simple-primary-icon"><ShoppingCart size={19} aria-hidden="true" /></span>
            <span><small>Mulai jualan</small><strong>Buka kasir</strong></span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <div className="simple-hero-decoration" aria-hidden="true" />
        </header>

        {error && <div className="simple-dashboard-error" role="alert"><TriangleAlert size={17} />{error}</div>}

        <section className="simple-dashboard-section" aria-labelledby="simple-summary-title">
          <div className="simple-section-heading">
            <div>
              <span className="simple-section-kicker">Ringkasan hari ini</span>
              <h2 id="simple-summary-title">Kondisi toko</h2>
            </div>
            <span className="simple-section-note"><Clock3 size={14} aria-hidden="true" /> Diperbarui otomatis</span>
          </div>
          <div className="simple-dashboard-grid">
            {cards.map(({ label, value, hint, icon: Icon, className, to }) => (
              <Link key={label} to={to} className={`simple-dashboard-card ${className}`}>
                <div className="simple-card-top">
                  <span>{label}</span>
                  <span className="simple-card-icon"><Icon size={19} aria-hidden="true" /></span>
                </div>
                <strong>{loading ? '...' : value}</strong>
                <div className="simple-card-bottom">
                  <small>{hint}</small>
                  <b aria-hidden="true"><ArrowUpRight size={16} /></b>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="simple-quick-actions" aria-labelledby="quick-actions-title">
          <div className="simple-section-heading">
            <div>
              <span className="simple-section-kicker">Akses cepat</span>
              <h2 id="quick-actions-title">Mau melakukan apa?</h2>
            </div>
            <span className="simple-section-note">Pilih pekerjaan untuk dilanjutkan</span>
          </div>
          <div className="simple-quick-actions-grid">
            {quickActions.map(({ label, hint, to, icon: Icon, className }) => (
              <Link key={label} to={to} className={`simple-quick-action ${className}`}>
                <span className="simple-quick-action-icon"><Icon size={21} strokeWidth={1.9} aria-hidden="true" /></span>
                <span><strong>{label}</strong><small>{hint}</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
