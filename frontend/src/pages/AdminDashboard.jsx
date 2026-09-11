import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import AdminSidebar from '../components/AdminSidebar';

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(new Date(value));
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState('Hari ini');
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    totalDebt: 0,
    net: 0,
    todaysIncome: 0,
    todaysExpense: 0,
    todaysNet: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);

  const downloadBackup = async () => {
    setBackupLoading(true);
    try {
      const token = localStorage.getItem('glosir_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoints = { products: '/api/products?all=true', categories: '/api/categories', orders: '/api/orders', finance: '/api/finance/transactions', parcels: '/api/parcel-participants' };
      const entries = await Promise.all(Object.entries(endpoints).map(async ([key, path]) => [key, await apiFetch(path, { headers }).then((response) => response.json())]));
      const payload = { exportedAt: new Date().toISOString(), data: Object.fromEntries(entries) };
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      link.download = `backup-glosir-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [summaryRes, txRes] = await Promise.all([
          apiFetch('/finance/summary'),
          apiFetch('/finance/transactions?limit=200')
        ]);

        const summaryData = await summaryRes.json();
        const txData = await txRes.json();

        if (summaryData.success) {
          setSummary(summaryData.summary || summaryData);
        }

        if (txData.success && Array.isArray(txData.transactions)) {
          setTransactions(txData.transactions.slice(0, 5));
        }
      } catch (error) {
        // no static fallback: data should come from the database
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const periodValues = {
    'Hari ini': { income: summary.todaysIncome, expense: summary.todaysExpense },
    '7 hari': { income: summary.weekIncome, expense: summary.weekExpense },
    'Bulan ini': { income: summary.monthIncome, expense: summary.monthExpense },
  }[period];
  const periodIncome = Number(periodValues.income || 0);
  const periodExpense = Number(periodValues.expense || 0);
  const periodNet = periodIncome - periodExpense;
  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const dayTransactions = transactions.filter((item) => {
      const createdAt = new Date(item.createdAt);
      return createdAt >= date && createdAt < nextDate;
    });
    return {
      label: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date),
      income: dayTransactions.filter((item) => item.type === 'INCOME').reduce((total, item) => total + Number(item.amount || 0), 0),
      expense: dayTransactions.filter((item) => item.type === 'EXPENSE').reduce((total, item) => total + Number(item.amount || 0), 0),
    };
  });
  const chartMax = Math.max(...chartData.map((item) => Math.max(item.income, item.expense)), 1);

  return (
    <div className="admin-shell">
      <AdminSidebar active="Dashboard" />

      <main className="admin-main">
        <header className="admin-header dashboard-hero">
          <div>
            <p className="eyebrow light">Owner workspace / Overview</p>
            <h1>Ringkasan bisnis</h1>
            <p className="admin-subtitle">Pantau arus uang dan aktivitas toko dalam satu ruang kerja.</p>
          </div>
          <div className="admin-header-actions"><span className="live-status"><i /> {loading ? 'Memuat data...' : 'Terhubung database'}</span><button type="button" className="btn btn-light" onClick={downloadBackup} disabled={backupLoading}>{backupLoading ? 'Menyiapkan...' : 'Backup data'}</button><Link to="/admin/products" className="btn btn-primary">+ Kelola Produk</Link></div>
        </header>

        <div className="dashboard-toolbar"><span className="toolbar-label">Periode</span>{['Hari ini', '7 hari', 'Bulan ini'].map((option) => <button key={option} className={period === option ? 'selected' : ''} onClick={() => setPeriod(option)}>{option}</button>)}</div>

        <section className="dashboard-metric-grid">
          <div className="dashboard-balance-card"><div className="dashboard-card-icon">▣</div><span>Total pemasukan</span><strong>{formatCurrency(periodIncome)}</strong><small>{period} / transaksi tercatat</small><Link to="/admin/finance">Lihat detail <span>→</span></Link></div>
          <div className="dashboard-stat-card"><div className="dashboard-stat-head"><span>Pengeluaran</span><b>−</b></div><strong>{formatCurrency(periodExpense)}</strong><small>{period}</small><div className="dashboard-stat-trend positive">Terpantau dari database</div></div>
          <div className="dashboard-stat-card"><div className="dashboard-stat-head"><span>Laba bersih</span><b>↗</b></div><strong>{formatCurrency(periodNet)}</strong><small>{period}</small><div className={`dashboard-stat-trend ${periodNet >= 0 ? 'positive' : 'negative'}`}>{periodNet >= 0 ? 'Di atas pengeluaran' : 'Perlu perhatian'}</div></div>
        </section>

        <section className="dashboard-quick-grid">
          <div><span>Transaksi hari ini</span><strong>{summary.todayOrderCount || 0}</strong><small>Order selesai</small></div>
          <div><span>Cash hari ini</span><strong>{formatCurrency(summary.todayCashIncome)}</strong><small>Uang tunai masuk</small></div>
          <div><span>Stok menipis</span><strong>{summary.lowStockCount || 0}</strong><small>Perlu restock</small><Link to="/admin/products">Lihat stok</Link></div>
          <div><span>Tagihan parsel</span><strong>{summary.parcelOverdueCount || 0}</strong><small>Perlu ditagih</small><Link to="/admin/parcel-participants">Buka penagihan</Link></div>
        </section>

        <section className="dashboard-content-grid">
          <div className="dashboard-panel cash-flow-panel">
            <div className="dashboard-panel-heading"><div><span className="panel-kicker">Cash flow</span><h2>Arus kas</h2></div><span className="dashboard-panel-total">{formatCompactCurrency(summary.totalIncome)} total masuk</span></div>
            <div className="cash-flow-chart" aria-label="Grafik arus kas tujuh hari terakhir">
              {chartData.map((item) => <div className="cash-flow-column" key={item.label}><div className="cash-flow-bars"><span className="cash-flow-income" style={{ height: `${Math.max((item.income / chartMax) * 100, item.income ? 5 : 0)}%` }} title={`Pemasukan ${formatCurrency(item.income)}`} /><span className="cash-flow-expense" style={{ height: `${Math.max((item.expense / chartMax) * 100, item.expense ? 5 : 0)}%` }} title={`Pengeluaran ${formatCurrency(item.expense)}`} /></div><small>{item.label}</small></div>)}
            </div>
            <div className="cash-flow-legend"><span><i className="legend-income" /> Pemasukan</span><span><i className="legend-expense" /> Pengeluaran</span></div>
          </div>

          <div className="dashboard-panel wallet-panel">
            <div className="dashboard-panel-heading"><div><span className="panel-kicker">Snapshot</span><h2>Ringkasan saldo</h2></div><span className="dashboard-more">•••</span></div>
            <div className="wallet-summary"><span>Piutang / utang</span><strong>{formatCurrency(summary.totalDebt)}</strong><small>{summary.debtCount || 0} transaksi tercatat</small></div>
            <div className="wallet-summary"><span>Transfer masuk</span><strong>{formatCurrency(summary.totalTransfer)}</strong><small>{summary.transferCount || 0} transaksi tercatat</small></div>
            <Link className="dashboard-text-link" to="/admin/finance">Buka laporan keuangan <span>→</span></Link>
          </div>
        </section>

        <section className="dashboard-panel activity-panel">
          <div className="dashboard-panel-heading"><div><span className="panel-kicker">Database activity</span><h2>Aktivitas terbaru</h2></div><Link className="dashboard-text-link" to="/admin/finance">Lihat semua <span>→</span></Link></div>
          <div className="dashboard-activity-table"><div className="dashboard-table-head"><span>Aktivitas</span><span>Jenis</span><span>Tanggal</span><span>Nominal</span></div>
            {transactions.length > 0 ? transactions.slice(0, 5).map((item) => <div className="dashboard-table-row" key={item.id}><strong>{item.description || 'Transaksi tanpa keterangan'}</strong><span className={`activity-type ${item.type.toLowerCase()}`}>{item.type === 'INCOME' ? 'Pemasukan' : item.type === 'EXPENSE' ? 'Pengeluaran' : item.type === 'DEBT' ? 'Piutang' : item.type}</span><span>{formatShortDate(item.createdAt)}</span><b>{formatCurrency(item.amount)}</b></div>) : <div className="dashboard-empty-state">{loading ? 'Memuat transaksi dari database...' : 'Belum ada transaksi pada database.'}</div>}
          </div>
        </section>
        <footer className="admin-footer">Glosir Owner Workspace <span>Data keuangan terhubung ke transaksi dan piutang</span></footer>
      </main>
    </div>
  );
}
