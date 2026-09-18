import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Package, ShoppingCart, WalletCards } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminSimpleDashboard() {
  const [summary, setSummary] = useState({ income: 0, lowStock: 0, dueDebts: 0, newOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const [financeResponse, stockResponse, ordersResponse, debtsResponse] = await Promise.all([
          apiFetch('/finance/summary'),
          apiFetch('/products/restock-suggestions'),
          apiFetch(`/orders/unread-count?since=${encodeURIComponent(new Date(0).toISOString())}`),
          apiFetch('/debts?status=OPEN'),
        ]);
        const finance = await financeResponse.json();
        const stock = await stockResponse.json();
        const orders = await ordersResponse.json();
        const debts = await debtsResponse.json();
        const weekAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;
        const dueDebts = (debts.debts || []).filter((debt) => debt.dueDate && new Date(debt.dueDate).getTime() <= weekAhead).length;
        setSummary({ income: finance.summary?.todaysIncome || 0, lowStock: stock.suggestions?.length || 0, dueDebts, newOrders: orders.count || 0 });
      } catch (err) {
        setError('Gagal memuat data ringkasan. Coba refresh halaman.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards = [
    { label: 'Omzet Hari Ini', value: money(summary.income), className: 'simple-card-green', to: '/admin/finance' },
    { label: 'Stok Menipis', value: `${summary.lowStock} barang`, className: summary.lowStock ? 'simple-card-alert' : 'simple-card-yellow', to: '/admin/products' },
    { label: 'Piutang Jatuh Tempo', value: `${summary.dueDebts} orang`, className: summary.dueDebts ? 'simple-card-alert' : 'simple-card-yellow', to: '/admin/finance' },
    { label: 'Pesanan Baru', value: `${summary.newOrders} pesanan`, className: summary.newOrders ? 'simple-card-blue simple-card-attention' : 'simple-card-blue', to: '/kasir/riwayat' },
  ];

  const quickActions = [
    { label: 'Buka Kasir', hint: 'Scan barang dan terima pembayaran', to: '/kasir', icon: ShoppingCart, className: 'quick-action-green' },
    { label: 'Catat Uang Keluar', hint: 'Belanja, listrik, atau biaya toko', to: '/admin/finance', icon: WalletCards, className: 'quick-action-yellow' },
    { label: 'Cek Stok Barang', hint: 'Lihat barang yang hampir habis', to: '/admin/products', icon: Package, className: 'quick-action-blue' },
    { label: 'Kelola Parsel', hint: 'Peserta, setoran, dan program', to: '/admin/parcels', icon: Archive, className: 'quick-action-orange' },
  ];

  return <div className="admin-shell admin-simple-shell"><AdminSidebar active="Dashboard" /><main className="admin-main simple-dashboard-main"><header className="simple-dashboard-header"><div><span className="eyebrow light">Ringkasan mudah</span><h1>Halo, cek toko hari ini</h1><p>Lihat kondisi toko dan pilih pekerjaan yang ingin dilakukan.</p></div><Link className="btn btn-secondary large-touch" to="/admin/detail">Lihat tampilan lengkap</Link></header>{error && <div className="crud-notice" role="alert">{error}</div>}<section className="simple-dashboard-grid">{cards.map((card) => <Link key={card.label} to={card.to} className={`simple-dashboard-card ${card.className}`}><span>{card.label}</span><strong>{loading ? '...' : card.value}</strong><small>Ketuk untuk melihat detail <b>→</b></small></Link>)}</section><section className="simple-quick-actions" aria-labelledby="quick-actions-title"><div className="simple-section-heading"><div><span className="eyebrow light">Pekerjaan utama</span><h2 id="quick-actions-title">Mau melakukan apa?</h2></div><span className="simple-section-note">Pilih satu tombol besar</span></div><div className="simple-quick-actions-grid">{quickActions.map(({ label, hint, to, icon: Icon, className }) => <Link key={label} to={to} className={`simple-quick-action ${className}`}><span className="simple-quick-action-icon"><Icon size={27} strokeWidth={2} aria-hidden="true" /></span><span><strong>{label}</strong><small>{hint}</small></span><b aria-hidden="true">→</b></Link>)}</div></section><div className="simple-dashboard-help"><strong>Butuh bantuan?</strong><span>Mulai dari kotak di atas. Angka akan diperbarui saat halaman dibuka.</span><Link to="/admin/detail">Buka laporan lengkap →</Link></div></main></div>;
}
