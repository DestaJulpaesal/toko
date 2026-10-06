import { useEffect, useState } from 'react';
import { AlertCircle, ArrowDownRight, Calendar, Download, ShoppingBag, TrendingUp } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { Badge, EmptyState, PageHeader, TableWrap } from '../components/ui';
import { apiFetch } from '../services/api';

const rp = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

/** Laporan performa produk: paling untung, paling laku, dan jual rugi. */
export default function AdminProductPerformancePage() {
  const [activeTab, setActiveTab] = useState('profitable'); // profitable | bestselling | loss | categories | cashiers | unsold
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ mostProfitable: [], bestSelling: [], lossItems: [] });
  const [lossSalesLogs, setLossSalesLogs] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const query = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : '';
        const [perfRes, lossRes, reportRes] = await Promise.all([
          apiFetch(`/analytics/product-performance${query}`),
          apiFetch(`/analytics/loss-sales${query}`),
          apiFetch(`/analytics/sales-report${query}`),
        ]);
        // apiFetch mengembalikan Response, jadi harus di-parse dulu (sebelumnya lupa .json()).
        const perf = await perfRes.json();
        const loss = await lossRes.json();
        const salesReport = await reportRes.json();
        if (perf?.success) {
          setData({
            mostProfitable: perf.mostProfitable || [],
            bestSelling: perf.bestSelling || [],
            lossItems: perf.lossItems || [],
          });
        }
        if (loss?.success) setLossSalesLogs(loss.lossSales || []);
        if (salesReport?.success) setReport(salesReport);
      } catch (err) {
        console.error('Failed to load performance data:', err);
        setError('Gagal memuat laporan dari server.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [startDate, endDate]);

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
    <button type="button" className={`g-tab${activeTab === key ? ' is-active' : ''}${danger ? ' is-danger' : ''}`} onClick={() => setActiveTab(key)}>
      {icon}<span>{label}</span>
    </button>
  );

  return (
    <AdminShell active="Performa Produk">
      <PageHeader
        title="Laporan Performa Produk"
        subtitle="Analisis produk paling untung, paling laku, dan potensi penjualan rugi."
        actions={(
          <div className="g-filter">
            <Calendar size={16} />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span>s/d</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {(startDate || endDate) && (
              <button type="button" className="g-btn g-btn--sm" onClick={() => { setStartDate(''); setEndDate(''); }}>Reset</button>
            )}
            <button type="button" className="g-btn g-btn--sm" onClick={exportReport} disabled={!report}><Download size={15} /> Export CSV</button>
          </div>
        )}
      />

      {error && <div className="crud-notice" role="alert">{error}</div>}

      {report?.summary && <div className="g-summary-grid">
        <SummaryCard label="Pendapatan" value={report.summary.revenue} />
        <SummaryCard label="Laba kotor" value={report.summary.grossProfit} />
        <SummaryCard label="Pengeluaran" value={report.summary.operatingExpense} />
        <SummaryCard label="Laba bersih" value={report.summary.netProfit} />
      </div>}

      <div className="g-tabs" role="tablist">
        {tab('profitable', 'Paling Untung', <TrendingUp size={16} />)}
        {tab('bestselling', 'Paling Laku', <ShoppingBag size={16} />)}
        {tab('loss', `Jual Rugi (${lossSalesLogs.length})`, <AlertCircle size={16} />, true)}
        {tab('categories', 'Per Kategori', <ShoppingBag size={16} />)}
        {tab('cashiers', 'Per Kasir', <ShoppingBag size={16} />)}
        {tab('unsold', 'Tidak Laku', <AlertCircle size={16} />)}
      </div>

      {loading ? (
        <EmptyState title="Memuat data laporan..." />
      ) : activeTab === 'profitable' ? (
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
      )}
    </AdminShell>
  );
}

function SummaryCard({ label, value }) {
  return <div className="g-panel"><small>{label}</small><h3>{rp(value)}</h3></div>;
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
