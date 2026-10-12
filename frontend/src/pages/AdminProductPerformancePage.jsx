import { useEffect, useState } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, Calendar, DollarSign, Filter, Package, ShoppingBag, TrendingUp } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { apiFetch } from '../services/api';

/**
 * FASE 5: Halaman Laporan Performa Produk
 * Menampilkan:
 * 1. Barang Paling Untung
 * 2. Barang Paling Laku
 * 3. Barang Dijual Rugi (Loss Sales)
 */
export default function AdminProductPerformancePage() {
  const [activeTab, setActiveTab] = useState('profitable'); // 'profitable', 'bestselling', 'loss'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ mostProfitable: [], bestSelling: [], lossItems: [] });
  const [lossSalesLogs, setLossSalesLogs] = useState([]);

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  async function loadData() {
    setLoading(true);
    try {
      let query = '';
      if (startDate && endDate) query = `?startDate=${startDate}&endDate=${endDate}`;

      const [perfRes, lossRes] = await Promise.all([
        apiFetch(`/analytics/product-performance${query}`),
        apiFetch(`/analytics/loss-sales${query}`),
      ]);

      if (perfRes?.success) {
        setData({
          mostProfitable: perfRes.mostProfitable || [],
          bestSelling: perfRes.bestSelling || [],
          lossItems: perfRes.lossItems || [],
        });
      }

      if (lossRes?.success) {
        setLossSalesLogs(lossRes.lossSales || []);
      }
    } catch (err) {
      console.error('Failed to load performance data:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col">
      <PublicHeader />
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        <AdminSidebar active="analytics" />

        <main className="flex-1 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                Laporan Performa Produk
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Analisis produk paling untung, paling laku, dan potensi penjualan rugi.
              </p>
            </div>

            {/* Filter Date */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none focus:outline-none"
              />
              <span>s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none focus:outline-none"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-emerald-600 font-semibold hover:underline px-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-4">
            <button
              onClick={() => setActiveTab('profitable')}
              className={`pb-3 px-1 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'profitable'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Paling Untung</span>
            </button>
            <button
              onClick={() => setActiveTab('bestselling')}
              className={`pb-3 px-1 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'bestselling'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Paling Laku</span>
            </button>
            <button
              onClick={() => setActiveTab('loss')}
              className={`pb-3 px-1 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'loss'
                  ? 'border-red-600 text-red-600 dark:text-red-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              <span>Jual Rugi ({lossSalesLogs.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Memuat data laporan...</div>
          ) : activeTab === 'profitable' ? (
            <ProductListTable items={data.mostProfitable} type="profit" />
          ) : activeTab === 'bestselling' ? (
            <ProductListTable items={data.bestSelling} type="qty" />
          ) : (
            <LossSalesTable logs={lossSalesLogs} />
          )}
        </main>
      </div>
      <PublicFooter />
    </div>
  );
}

function ProductListTable({ items, type }) {
  if (!items || items.length === 0) {
    return <div className="p-8 text-center text-zinc-500 border rounded-2xl bg-white dark:bg-zinc-800">Belum ada data penjualan pada periode ini.</div>;
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500">
            <tr>
              <th className="p-4">#</th>
              <th className="p-4">Nama Produk</th>
              <th className="p-4 text-center">Total Terjual</th>
              <th className="p-4 text-right">Pendapatan</th>
              <th className="p-4 text-right">Estimasi Modal</th>
              <th className="p-4 text-right">Total Profit</th>
              <th className="p-4 text-center">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((item, idx) => (
              <tr key={item.productId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="p-4 font-bold text-zinc-400">{idx + 1}</td>
                <td className="p-4">
                  <p className="font-semibold">{item.productName}</p>
                  <p className="text-[10px] text-zinc-400">SKU: {item.productSku}</p>
                </td>
                <td className="p-4 text-center font-semibold">{item.totalQty.toLocaleString('id-ID')} unit</td>
                <td className="p-4 text-right">Rp {item.totalRevenue.toLocaleString('id-ID')}</td>
                <td className="p-4 text-right text-zinc-500">Rp {item.totalCost.toLocaleString('id-ID')}</td>
                <td className={`p-4 text-right font-bold ${item.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                  Rp {item.totalProfit.toLocaleString('id-ID')}
                </td>
                <td className="p-4 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.profitMargin > 20
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.profitMargin > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {item.profitMargin}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LossSalesTable({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 border rounded-2xl bg-white dark:bg-zinc-800">
        <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Aman! 👍</p>
        <p className="text-xs">Tidak ada riwayat barang yang dijual di bawah harga modal.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
      <div className="p-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 text-xs">
        ⚠️ <strong>Catatan Peringatan:</strong> Daftar di bawah ini adalah transaksi yang terdeteksi memiliki item dengan harga jual di bawah modal.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs md:text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500">
            <tr>
              <th className="p-4">Waktu</th>
              <th className="p-4">ID Transaksi</th>
              <th className="p-4">Kasir</th>
              <th className="p-4">Rincian Barang Rugi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {logs.map((log) => {
              let details = [];
              try {
                details = JSON.parse(log.detail || '[]');
              } catch {
                details = [];
              }

              return (
                <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="p-4 text-zinc-500">{new Date(log.createdAt).toLocaleString('id-ID')}</td>
                  <td className="p-4 font-mono text-xs font-semibold">{log.orderId}</td>
                  <td className="p-4 font-medium">{log.cashier}</td>
                  <td className="p-4">
                    <ul className="space-y-1 text-xs">
                      {details.map((d, i) => (
                        <li key={i} className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            <strong>{d.name}</strong> (Jual: Rp {d.sellPrice?.toLocaleString('id-ID')} vs Modal: Rp {d.basePrice?.toLocaleString('id-ID')}) —{' '}
                            <span className="font-bold">Rugi Rp {d.loss?.toLocaleString('id-ID')}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
