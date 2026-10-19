import { useEffect, useState } from 'react';
import { AlertCircle, ArrowDownRight, Download, RefreshCw, ShoppingBag, TrendingUp } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { Badge, EmptyState, PageHeader, TableWrap } from '../components/ui';
import { apiFetch } from '../services/api';

const rp = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

/** Laporan performa produk: paling untung, paling laku, dan jual rugi. */
export default function AdminProductPerformancePage() {
  const [activeTab, setActiveTab] = useState('profitable'); // profitable | bestselling | loss | categories | cashiers | unsold
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodPreset, setPeriodPreset] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ mostProfitable: [], bestSelling: [], lossItems: [] });
  const [lossSalesLogs, setLossSalesLogs] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      if (startDate && endDate && startDate > endDate) {
        setError('Tanggal mulai tidak boleh melewati tanggal akhir.');
        setLoading(false);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const query = params.size ? `?${params.toString()}` : '';
        const [perfRes, lossRes, reportRes] = await Promise.all([
          apiFetch(`/analytics/product-performance${query}`),
          apiFetch(`/analytics/loss-sales${query}`),
          apiFetch(`/analytics/sales-report${query}`),
        ]);
        const results = await Promise.all([perfRes.json(), lossRes.json(), reportRes.json()]);
        const failedIndex = results.findIndex((result, index) => ![perfRes, lossRes, reportRes][index].ok || !result?.success);
        if (failedIndex !== -1) throw new Error(results[failedIndex]?.message || 'Sebagian laporan gagal dimuat.');
        const [perf, loss, salesReport] = results;
        setData({
          mostProfitable: perf.mostProfitable || [],
          bestSelling: perf.bestSelling || [],
          lossItems: perf.lossItems || [],
        });
        setLossSalesLogs(loss.lossSales || []);
        setReport(salesReport);
      } catch (err) {
        console.error('Failed to load performance data:', err);
        setError(err.message || 'Gagal memuat laporan dari server.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [startDate, endDate, reloadKey]);

  const setPeriod = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    const toDateInput = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    setStartDate(toDateInput(start));
    setEndDate(toDateInput(end));
    setPeriodPreset(String(days));
  };
  const updateStartDate = (value) => {
    setStartDate(value);
    setPeriodPreset('custom');
  };
  const updateEndDate = (value) => {
    setEndDate(value);
    setPeriodPreset('custom');
  };
  const resetPeriod = () => {
    setStartDate('');
    setEndDate('');
    setPeriodPreset('all');
  };

  const exportReport = () => {
    if (!report) return;
    const rows = [
      ['Jenis', 'Nama', 'Qty', 'Pendapatan', 'Modal', 'Laba'],
      ...(report.products || []).map((row) => ['Produk', row.productName, row.totalQty, row.revenue, row.cogs, row.profit]),
      ...(report.categories || []).map((row) => ['Kategori', row.categoryName, row.totalQty, row.revenue, row.cogs, row.profit]),
      ...(report.cashiers || []).map((row) => ['Kasir', row.cashierName, row.totalQty, row.revenue, row.cogs, row.profit]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `laporan-penjualan-${startDate || 'semua'}-${endDate || 'sekarang'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const tab = (key, label, icon, danger) => (
    <button id={`product-performance-tab-${key}`} type="button" role="tab" aria-selected={activeTab === key} aria-controls="product-performance-panel" className={`g-tab${activeTab === key ? ' is-active' : ''}${danger ? ' is-danger' : ''}`} onClick={() => setActiveTab(key)}>
      {icon}<span>{label}</span>
    </button>
  );
  const activeReportTitle = {
    profitable: 'Produk paling menguntungkan',
    bestselling: 'Produk paling laku',
    loss: 'Penjualan di bawah modal',
    categories: 'Performa per kategori',
    cashiers: 'Performa per kasir',
    unsold: 'Produk belum terjual',
  }[activeTab];
  const activeReportHint = {
    profitable: 'Urutan berdasarkan laba yang dihasilkan setiap produk.',
    bestselling: 'Urutan berdasarkan jumlah unit yang terjual.',
    loss: 'Periksa transaksi yang harga jualnya berada di bawah modal.',
    categories: 'Bandingkan penjualan dan laba antar kategori.',
    cashiers: 'Bandingkan jumlah dan nilai penjualan tiap kasir.',
    unsold: 'Produk katalog yang belum memiliki penjualan pada periode ini.',
  }[activeTab];

  return (
    <AdminShell active="Performa Produk" className="product-performance-shell">
      <PageHeader
        title="Laporan Performa Produk"
        subtitle="Cari tahu produk yang paling menguntungkan, paling laku, pernah dijual rugi, atau belum terjual. Gunakan periode untuk membandingkan hasil."
      />
      <section className="product-performance-controls" aria-label="Filter laporan">
        <div className="product-performance-controls-heading">
          <div><span className="product-performance-eyebrow">Periode laporan</span><strong>Tentukan rentang data</strong></div>
          <span className="product-performance-period-summary">{startDate || endDate ? `${startDate || 'Awal'} — ${endDate || 'Hari ini'}` : 'Semua waktu'}</span>
        </div>
        <div className="product-performance-controls-row">
          <div className="product-performance-shortcuts" aria-label="Pilih periode laporan">
            <button type="button" className={periodPreset === 'all' ? 'is-selected' : ''} aria-pressed={periodPreset === 'all'} onClick={resetPeriod}>Semua waktu</button>
            <button type="button" className={periodPreset === '7' ? 'is-selected' : ''} aria-pressed={periodPreset === '7'} onClick={() => setPeriod(7)}>7 hari</button>
            <button type="button" className={periodPreset === '30' ? 'is-selected' : ''} aria-pressed={periodPreset === '30'} onClick={() => setPeriod(30)}>30 hari</button>
          </div>
          <div className="product-performance-date-range">
            <label><span>Dari</span><input aria-label="Tanggal mulai" type="date" value={startDate} onChange={(e) => updateStartDate(e.target.value)} /></label>
            <span className="product-performance-date-separator">sampai</span>
            <label><span>Sampai</span><input aria-label="Tanggal akhir" type="date" value={endDate} onChange={(e) => updateEndDate(e.target.value)} /></label>
            {(startDate || endDate) && <button type="button" className="product-performance-reset" onClick={resetPeriod}>Reset</button>}
          </div>
          <div className="product-performance-actions">
            <button type="button" onClick={exportReport} disabled={!report}><Download size={15} /> Export CSV</button>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}><RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> Muat ulang</button>
          </div>
        </div>
      </section>

      {error && <div className="product-performance-error" role="alert"><AlertCircle size={18} /><div><strong>Laporan belum tersedia</strong><span>{error}</span></div><button type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={loading}>Coba lagi</button></div>}

      {!loading && !error && report?.summary && <section className="product-performance-summary" aria-label="Ringkasan penjualan">
        <div className="product-performance-section-heading"><div><span className="product-performance-eyebrow">Ikhtisar</span><h2>Ringkasan penjualan</h2></div><p>Angka utama untuk periode yang dipilih</p></div>
        <div className="g-summary-grid">
          <SummaryCard label="Pendapatan" value={report.summary.revenue} tone="revenue" hint="Total nilai penjualan" />
          <SummaryCard label="Laba kotor" value={report.summary.grossProfit} tone="profit" hint="Pendapatan dikurangi modal" />
          <SummaryCard label="Pengeluaran" value={report.summary.operatingExpense} tone="expense" hint="Biaya operasional tercatat" />
          <SummaryCard label="Laba bersih" value={report.summary.netProfit} tone={Number(report.summary.netProfit) >= 0 ? 'profit' : 'loss'} hint="Laba kotor dikurangi pengeluaran" />
        </div>
      </section>}

      <section className="product-performance-report" aria-label="Rincian performa produk">
        <div className="product-performance-section-heading"><div><span className="product-performance-eyebrow">Analisis terperinci</span><h2>{activeReportTitle}</h2></div><p>{activeReportHint}</p></div>
        <div className="g-tabs" role="tablist" aria-label="Jenis laporan performa">
          {tab('profitable', 'Paling Untung', <TrendingUp size={16} />)}
          {tab('bestselling', 'Paling Laku', <ShoppingBag size={16} />)}
          {tab('loss', `Jual Rugi (${lossSalesLogs.length})`, <AlertCircle size={16} />, true)}
          {tab('categories', 'Per Kategori', <ShoppingBag size={16} />)}
          {tab('cashiers', 'Per Kasir', <ShoppingBag size={16} />)}
          {tab('unsold', 'Tidak Laku', <AlertCircle size={16} />)}
        </div>

        {loading ? (
          <div className="product-performance-results"><EmptyState title="Memuat data laporan..." /></div>
        ) : error ? (
          <div className="product-performance-results"><EmptyState title="Belum dapat menampilkan analisis" hint="Pastikan server terhubung, lalu coba muat ulang laporan." /></div>
        ) : <div id="product-performance-panel" role="tabpanel" aria-labelledby={`product-performance-tab-${activeTab}`} className="product-performance-results">{activeTab === 'profitable' ? (
          <ProductListTable items={data.mostProfitable} />
        ) : activeTab === 'bestselling' ? (
          <ProductListTable items={report?.bestSelling || data.bestSelling} />
        ) : activeTab === 'categories' ? (
          <DimensionTable items={report?.categories} nameKey="categoryName" />
        ) : activeTab === 'cashiers' ? (
          <DimensionTable items={report?.cashiers} nameKey="cashierName" />
        ) : activeTab === 'unsold' ? (
          <UnsoldTable items={report?.unsold} />
        ) : (
          <LossSalesTable logs={lossSalesLogs} />
        )}</div>}
      </section>
    </AdminShell>
  );
}

function SummaryCard({ label, value, tone, hint }) {
  return (
    <article className={`g-summary-card g-summary-card--${tone}`}>
      <div className="g-summary-card__top"><span>{label}</span><i /></div>
      <strong>{rp(value)}</strong>
      <small>{hint}</small>
    </article>
  );
}

function DimensionTable({ items, nameKey }) {
  if (!items?.length) return <div className="g-panel"><EmptyState title="Belum ada data" /></div>;
  return <TableWrap><table><thead><tr><th>Nama</th><th className="g-num">Terjual</th><th className="g-num">Pendapatan</th><th className="g-num">Modal</th><th className="g-num">Laba kotor</th></tr></thead><tbody>{items.map((item) => <tr key={item[nameKey]}><td><strong>{item[nameKey]}</strong></td><td className="g-num">{Number(item.totalQty || 0).toLocaleString('id-ID')}</td><td className="g-num">{rp(item.revenue)}</td><td className="g-num">{rp(item.cogs)}</td><td className="g-num g-pos">{rp(item.profit)}</td></tr>)}</tbody></table></TableWrap>;
}

function UnsoldTable({ items }) {
  if (!items?.length) return <div className="g-panel"><EmptyState title="Semua produk sudah terjual" /></div>;
  return <TableWrap><table><thead><tr><th>Nama Produk</th><th>SKU</th><th>Kategori</th></tr></thead><tbody>{items.map((item) => <tr key={item.productId}><td><strong>{item.productName}</strong></td><td>{item.productSku}</td><td>{item.categoryName}</td></tr>)}</tbody></table></TableWrap>;
}

function ProductListTable({ items }) {
  if (!items || items.length === 0) {
    return <div className="g-panel"><EmptyState title="Belum ada data penjualan" hint="Coba ubah rentang tanggal." /></div>;
  }
  const tone = (margin) => (margin > 20 ? 'success' : margin > 0 ? 'warning' : 'danger');
  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Nama Produk</th><th className="g-num">Terjual</th><th className="g-num">Pendapatan</th>
            <th className="g-num">Est. Modal</th><th className="g-num">Profit</th><th>Margin</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.productId}>
              <td>{idx + 1}</td>
              <td><strong>{item.productName}</strong><br /><small>SKU: {item.productSku}</small></td>
              <td className="g-num">{Number(item.totalQty || 0).toLocaleString('id-ID')} unit</td>
              <td className="g-num">{rp(item.totalRevenue ?? item.revenue)}</td>
              <td className="g-num">{rp(item.totalCost ?? item.cogs)}</td>
              <td className={`g-num ${(item.totalProfit ?? item.profit) >= 0 ? 'g-pos' : 'g-neg'}`}>{rp(item.totalProfit ?? item.profit)}</td>
              <td><Badge tone={tone(item.profitMargin ?? item.margin)}>{Math.round(item.profitMargin ?? item.margin ?? 0)}%</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function LossSalesTable({ logs }) {
  if (!logs || logs.length === 0) {
    return <div className="g-panel"><EmptyState title="Aman! 👍" hint="Tidak ada riwayat barang yang dijual di bawah harga modal." /></div>;
  }
  return (
    <TableWrap>
      <div className="g-notice--danger">
        ⚠️ <strong>Peringatan:</strong> transaksi di bawah ini punya item dengan harga jual di bawah modal.
      </div>
      <table>
        <thead><tr><th>Waktu</th><th>ID Transaksi</th><th>Kasir</th><th>Rincian Barang Rugi</th></tr></thead>
        <tbody>
          {logs.map((log) => {
            let details = [];
            try { details = JSON.parse(log.detail || '[]'); } catch { details = []; }
            return (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString('id-ID')}</td>
                <td><code>{log.orderId}</code></td>
                <td>{log.cashier}</td>
                <td>
                  {details.map((d, i) => (
                    <div key={i} className="g-neg" style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 500 }}>
                      <ArrowDownRight size={14} />
                      <span><strong>{d.name}</strong> (Jual {rp(d.sellPrice)} vs Modal {rp(d.basePrice)}) — <strong>Rugi {rp(d.loss)}</strong></span>
                    </div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}
