import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowUpRight, CircleDollarSign, Package, ShoppingCart, TriangleAlert, WalletCards } from 'lucide-react';
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
        const [financeResponse, stockResponse, debtsResponse] = await Promise.all([
          apiFetch('/finance/summary', { silentNotify: true }),
          apiFetch('/products/restock-suggestions', { silentNotify: true }),
          apiFetch('/debts?status=OPEN', { silentNotify: true }),
        ]);
        const finance = await financeResponse.json();
        const stock = await stockResponse.json();
        const debts = await debtsResponse.json();
        const weekAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;
        const dueDebts = (debts.debts || []).filter((debt) => debt.dueDate && new Date(debt.dueDate).getTime() <= weekAhead).length;
        if (!active) return;
        setSummary({ income: finance.summary?.todaysIncome || 0, weekIncome: finance.summary?.weekIncome || 0, lowStock: stock.suggestions?.length || 0, dueDebts });
        setLastUpdated(new Date());
      } catch (err) {
        if (initial) setError('Gagal memuat data ringkasan. Coba refresh halaman.');
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
    { label: 'Omzet Hari Ini', value: money(summary.income), hint: 'Pemasukan tercatat hari ini', icon: CircleDollarSign, className: 'simple-card-green', to: '/admin/finance' },
    { label: 'Stok Menipis', value: `${summary.lowStock} barang`, hint: 'Perlu segera diperiksa', icon: TriangleAlert, className: summary.lowStock ? 'simple-card-alert' : 'simple-card-yellow', to: '/admin/products' },
    { label: 'Piutang Jatuh Tempo', value: `${summary.dueDebts} orang`, hint: 'Jatuh tempo dalam 7 hari', icon: TriangleAlert, className: summary.dueDebts ? 'simple-card-alert' : 'simple-card-yellow', to: '/admin/finance' },
    { label: 'Pendapatan 7 Hari', value: money(summary.weekIncome), hint: 'Ringkasan transaksi selesai', icon: ShoppingCart, className: 'simple-card-blue', to: '/admin/finance' },
  ];

  const quickActions = [
    { label: 'Buka Kasir', hint: 'Scan barang dan terima pembayaran', to: '/kasir', icon: ShoppingCart, className: 'quick-action-green' },
    { label: 'Catat Uang Keluar', hint: 'Belanja, listrik, atau biaya toko', to: '/admin/finance', icon: WalletCards, className: 'quick-action-yellow' },
    { label: 'Cek Stok Barang', hint: 'Lihat barang yang hampir habis', to: '/admin/products', icon: Package, className: 'quick-action-blue' },
    { label: 'Kelola Parsel', hint: 'Peserta, setoran, dan program', to: '/admin/parcels', icon: Archive, className: 'quick-action-orange' },
  ];

  return <AdminShell active="Dashboard" className="admin-simple-shell" mainClassName="simple-dashboard-main"><header className="simple-dashboard-header"><div><span className="eyebrow light">Ringkasan mudah</span><h1>Halo, cek toko hari ini</h1><p>Lihat kondisi toko dan pilih pekerjaan yang ingin dilakukan.</p><small className="simple-dashboard-updated">{loading ? 'Mengambil data terbaru...' : `Terakhir diperbarui ${lastUpdated?.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`}</small></div><Link className="btn btn-secondary large-touch" to="/admin/detail">Lihat tampilan lengkap <ArrowUpRight size={16} /></Link></header>{error && <div className="crud-notice" role="alert">{error}</div>}<section className="simple-dashboard-grid">{cards.map(({ label, value, hint, icon: Icon, className, to }) => <Link key={label} to={to} className={`simple-dashboard-card ${className}`}><div className="simple-card-top"><span>{label}</span><span className="simple-card-icon"><Icon size={19} /></span></div><strong>{loading ? '...' : value}</strong><div className="simple-card-bottom"><small>{hint}</small><b aria-hidden="true"><ArrowUpRight size={17} /></b></div></Link>)}</section><section className="simple-quick-actions" aria-labelledby="quick-actions-title"><div className="simple-section-heading"><div><span className="eyebrow light">Pekerjaan utama</span><h2 id="quick-actions-title">Mau melakukan apa?</h2></div><span className="simple-section-note">Pilih satu tombol besar</span></div><div className="simple-quick-actions-grid">{quickActions.map(({ label, hint, to, icon: Icon, className }) => <Link key={label} to={to} className={`simple-quick-action ${className}`}><span className="simple-quick-action-icon"><Icon size={27} strokeWidth={2} aria-hidden="true" /></span><span><strong>{label}</strong><small>{hint}</small></span><b aria-hidden="true">→</b></Link>)}</div></section><div className="simple-dashboard-help"><strong>Butuh bantuan?</strong><span>Data otomatis disinkronkan setiap 60 detik.</span><Link to="/admin/detail">Buka laporan lengkap →</Link></div></AdminShell>;
}
