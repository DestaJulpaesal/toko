import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminSimpleDashboard() {
  const [summary, setSummary] = useState({ income: 0, lowStock: 0, dueDebts: 0, newOrders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
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

  return <div className="admin-shell admin-simple-shell"><AdminSidebar active="Dashboard" /><main className="admin-main simple-dashboard-main"><header className="simple-dashboard-header"><div><span className="eyebrow light">Ringkasan mudah</span><h1>Halo, cek toko hari ini</h1><p>Lihat empat hal penting tanpa membuka laporan rumit.</p></div><Link className="btn btn-secondary large-touch" to="/admin/detail">Lihat tampilan lengkap</Link></header><section className="simple-dashboard-grid">{cards.map((card) => <Link key={card.label} to={card.to} className={`simple-dashboard-card ${card.className}`}><span>{card.label}</span><strong>{loading ? '...' : card.value}</strong><small>Ketuk untuk melihat detail <b>→</b></small></Link>)}</section><div className="simple-dashboard-help"><strong>Butuh bantuan?</strong><span>Mulai dari kotak di atas. Angka akan diperbarui saat halaman dibuka.</span><Link to="/admin/detail">Buka laporan lengkap →</Link></div></main></div>;
}
