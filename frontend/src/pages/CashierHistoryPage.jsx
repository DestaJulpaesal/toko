import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { calculateEarnedPoints } from './CashierPage';
import { apiFetch } from '../services/api';
import { printReceipt } from '../utils/printReceipt';
import * as XLSX from 'xlsx';

const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function CashierHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSaving, setVoidSaving] = useState(false);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [closingAccountId, setClosingAccountId] = useState('');
  const [physicalCash, setPhysicalCash] = useState('');
  const [reconciliation, setReconciliation] = useState(null);
  const [reconciliationSaving, setReconciliationSaving] = useState(false);
  const [reconciliationError, setReconciliationError] = useState('');

  const downloadExcel = () => {
    const rows = filteredOrders.map((order) => ({ Faktur: order.orderNumber, Waktu: new Date(order.createdAt).toLocaleString('id-ID'), Pelanggan: order.customer?.name || 'Pelanggan Umum', Metode: order.paymentMethod, Total: order.total, Status: order.status }));
    const sheet = XLSX.utils.json_to_sheet(rows); const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Transaksi');
    XLSX.writeFile(book, `riwayat-transaksi-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/orders');
      const data = await res.json();
      if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.warn('Backend orders unavailable, using local orders:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCashAccounts = async () => {
    try {
      const response = await apiFetch('/finance/accounts');
      const data = await response.json();
      if (!response.ok || !data.success) return;
      const accounts = (data.data || data.accounts || []).filter((account) => account.type === 'CASH' && account.isActive !== false);
      setCashAccounts(accounts);
      setClosingAccountId((current) => current || accounts[0]?.id || '');
    } catch (error) {
      console.warn('Cash accounts unavailable:', error.message);
    }
  };

  useEffect(() => {
    loadOrders();
    loadCashAccounts();
  }, []);

  const filteredOrders = orders.filter((ord) => {
    const matchesSearch =
      ord.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (ord.customer?.name && ord.customer.name.toLowerCase().includes(search.toLowerCase())) ||
      (ord.paymentReference && ord.paymentReference.toLowerCase().includes(search.toLowerCase()));

    const matchesMethod = methodFilter === 'ALL' || ord.paymentMethod.toUpperCase() === methodFilter;

    return matchesSearch && matchesMethod;
  });

  const totalOmset = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalPointsAwarded = filteredOrders.reduce(
    (sum, o) => sum + (o.earnedPoints || calculateEarnedPoints(o.total)),
    0
  );
  const cashCount = filteredOrders.filter((o) => o.paymentMethod === 'CASH').length;
  const qrisCount = filteredOrders.filter((o) => o.paymentMethod === 'QRIS').length;
  const transferCount = filteredOrders.filter((o) => o.paymentMethod === 'TRANSFER').length;
  const todayKey = new Date().toLocaleDateString('en-CA');
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toLocaleDateString('en-CA') === todayKey);
  const todayCash = todayOrders.filter((order) => order.paymentMethod === 'CASH').reduce((sum, order) => sum + Number(order.total || 0), 0);
  const todayNonCash = todayOrders.filter((order) => order.paymentMethod !== 'CASH').reduce((sum, order) => sum + Number(order.total || 0), 0);

  const handlePrint = () => {
    try {
      printReceipt('printable-receipt');
    } catch (error) {
      setReconciliationError(error.message);
    }
  };

  const voidOrder = async () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidSaving(true);
    try {
      const response = await apiFetch(`/orders/${voidTarget.id}/void`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: voidReason }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Transaksi gagal dibatalkan');
      setVoidTarget(null); setVoidReason(''); await loadOrders();
    } catch (error) { setVoidReason(error.message); } finally { setVoidSaving(false); }
  };

  const printClosingReport = () => {
    const report = window.open('', '_blank', 'width=720,height=760');
    if (!report) return;
    report.document.write(`<html><head><title>Laporan Tutup Kasir</title><style>body{font:14px Arial;padding:28px;color:#202820}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left}td:last-child,th:last-child{text-align:right}.total{font-size:18px;font-weight:bold}</style></head><body><h1>Laporan Tutup Kasir</h1><p>Tanggal: ${new Date().toLocaleDateString('id-ID')}</p><table><tr><th>Ringkasan</th><th>Jumlah</th></tr><tr><td>Total transaksi</td><td>${todayOrders.length}</td></tr><tr><td>Cash</td><td>${formatMoney(todayCash)}</td></tr><tr><td>Non-cash</td><td>${formatMoney(todayNonCash)}</td></tr><tr class="total"><td>Total penjualan</td><td>${formatMoney(todayCash + todayNonCash)}</td></tr></table><p style="margin-top:40px">Kasir: ____________________</p><p>Owner: ____________________</p><script>window.print()</script></body></html>`);
    report.document.close();
  };

  const submitClosing = async (event) => {
    event.preventDefault();
    setReconciliationError('');
    setReconciliationSaving(true);
    try {
      const response = await apiFetch('/finance/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: closingAccountId, physicalCount: Number(physicalCash), note: `Tutup kasir ${new Date().toLocaleDateString('id-ID')}` }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Tutup kasir gagal disimpan.');
      setReconciliation(data.data);
    } catch (error) {
      setReconciliationError(error.message || 'Tutup kasir gagal disimpan.');
    } finally {
      setReconciliationSaving(false);
    }
  };

  const getMethodBadgeClass = (method) => {
    switch (method) {
      case 'QRIS':
        return 'badge-qris';
      case 'TRANSFER':
        return 'badge-transfer';
      case 'CASH':
      default:
        return 'badge-cash';
    }
  };

  const getMethodLabel = (method) => {
    switch (method) {
      case 'QRIS':
        return 'QRIS';
      case 'TRANSFER':
        return 'Transfer Bank';
      case 'CASH':
      default:
        return 'Tunai (Cash)';
    }
  };

  const handleShareWhatsApp = (order) => {
    const pts = order.earnedPoints !== undefined ? order.earnedPoints : calculateEarnedPoints(order.total);
    const itemsList = (order.items || [])
      .map((it) => `• ${it.name} (${it.quantity || it.qty}x) = ${formatMoney(it.total || (it.unitPrice * (it.quantity || it.qty)))}`)
      .join('\n');

    const text =
      `*STRUK PEMBELIAN GLOSIR*\n` +
      `No. Faktur: ${order.orderNumber}\n` +
      `Tanggal: ${new Date(order.createdAt).toLocaleString('id-ID')}\n` +
      `Pelanggan: ${order.customer?.name || 'Pelanggan Umum'}\n` +
      `--------------------------------\n` +
      `${itemsList}\n` +
      `--------------------------------\n` +
      (order.discount > 0 ? `Diskon: -${formatMoney(order.discount)}\n` : '') +
      `*Total: ${formatMoney(order.total)}*\n` +
      `Metode: ${getMethodLabel(order.paymentMethod)}\n` +
      (order.paymentReference ? `Ref: ${order.paymentReference}\n` : '') +
      `Status: LUNAS\n` +
      `--------------------------------\n` +
      `*Poin Transaksi Ini: +${pts} Poin*\n` +
      `--------------------------------\n` +
      `Terima kasih telah berbelanja di Glosir!`;

    const phone = order.customer?.phone
      ? order.customer.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')
      : '';

    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Riwayat Transaksi" />

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Catatan Penjualan POS</p>
            <h1>Riwayat Transaksi</h1>
            <p className="admin-subtitle">
              Daftar seluruh transaksi kasir, rincian pembayaran Tunai, QRIS, & Transfer, poin didapat, serta cetak ulang struk.
            </p>
          </div>
          <div className="admin-header-actions"><button className="btn btn-secondary" onClick={downloadExcel}>Unduh Excel</button><button className="btn btn-light" onClick={loadOrders}>🔄 Segarkan Data</button></div>
        </header>

        {/* Metric Summary Cards */}
        <section className="metric-grid" style={{ marginBottom: '22px' }}>
          <div className="metric-card green">
            <div className="metric-top">
              <span>Total Omset Penjualan</span>
              <b>💰</b>
            </div>
            <strong>{formatMoney(totalOmset)}</strong>
            <small>{filteredOrders.length} transaksi selesai</small>
          </div>

          <div className="metric-card orange">
            <div className="metric-top">
              <span>Poin Diberikan</span>
              <b>🎁</b>
            </div>
            <strong>+{totalPointsAwarded} Poin</strong>
            <small>Loyalitas pelanggan</small>
          </div>

          <div className="metric-card blue">
            <div className="metric-top">
              <span>Pembayaran QRIS</span>
              <b>📱</b>
            </div>
            <strong>{qrisCount} Trx</strong>
            <small>Digital payment</small>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>Tunai & Transfer</span>
              <b>🏦</b>
            </div>
            <strong>{cashCount + transferCount} Trx</strong>
            <small>{cashCount} Tunai, {transferCount} Transfer</small>
          </div>
        </section>

        <section className="cashier-closing-panel">
          <div className="cashier-closing-main">
            <div className="cashier-closing-heading">
              <div>
                <span className="panel-kicker">Tutup shift hari ini</span>
                <h2>Rekap kasir</h2>
              </div>
              <span className="cashier-closing-date">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="cashier-closing-summary">
              <span><strong>{todayOrders.length}</strong> transaksi</span>
              <span><strong>{formatMoney(todayCash)}</strong> tunai</span>
              <span><strong>{formatMoney(todayNonCash)}</strong> non-cash</span>
            </div>
            <form className="cashier-closing-form" onSubmit={submitClosing}>
              <label>
                <span>Akun kas</span>
                <select value={closingAccountId} onChange={(event) => setClosingAccountId(event.target.value)} required disabled={!cashAccounts.length || reconciliationSaving}>
                  <option value="">Pilih akun kas</option>
                  {cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
              <label>
                <span>Uang fisik</span>
                <input type="number" min="0" value={physicalCash} onChange={(event) => setPhysicalCash(event.target.value)} placeholder="Rp 0" required disabled={reconciliationSaving} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={!cashAccounts.length || reconciliationSaving}>{reconciliationSaving ? 'Menyimpan...' : 'Simpan tutup kasir'}</button>
            </form>
            {!cashAccounts.length && <small className="cashier-closing-help">Belum ada akun kas aktif untuk direkonsiliasi.</small>}
            {reconciliationError && <small className="cashier-closing-help error">{reconciliationError}</small>}
            {reconciliation && <small className={`cashier-closing-help ${Number(reconciliation.difference) < 0 ? 'error' : 'success'}`}>Tersimpan. Selisih: {formatMoney(reconciliation.difference)}</small>}
          </div>
          <button className="btn btn-secondary cashier-closing-print" type="button" onClick={printClosingReport}>🖨️ Cetak laporan</button>
        </section>

        {/* Filter Toolbar */}
        <section className="crud-table-panel">
          <div className="crud-toolbar">
            <label className="crud-search" style={{ maxWidth: '380px' }}>
              <span>Cari</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari no. faktur, nama pembeli, atau ref..."
              />
            </label>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#777' }}>Metode:</span>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                style={{
                  minHeight: '38px',
                  borderRadius: '8px',
                  border: '1px solid #e0d9cf',
                  padding: '0 10px',
                  background: 'white',
                  fontSize: '0.8rem',
                }}
              >
                <option value="ALL">Semua Metode</option>
                <option value="CASH">💵 Tunai (Cash)</option>
                <option value="QRIS">📱 QRIS</option>
                <option value="TRANSFER">🏦 Transfer Bank</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th>No. Faktur</th>
                  <th>Waktu</th>
                  <th>Pelanggan</th>
                  <th>Metode Bayar</th>
                  <th>Total & Poin</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord) => {
                  const pts = ord.earnedPoints !== undefined ? ord.earnedPoints : calculateEarnedPoints(ord.total);
                  return (
                    <tr key={ord.id}>
                      <td>
                        <strong>{ord.orderNumber}</strong>
                        <small>Kasir: {ord.cashierName || 'Kasir Glosir'}</small>
                      </td>
                      <td>
                        <span>
                          {new Date(ord.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <small>
                          {new Date(ord.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </small>
                      </td>
                      <td>
                        <strong>{ord.customer?.name || 'Pelanggan Umum'}</strong>
                        {ord.customer?.phone && <small>{ord.customer.phone}</small>}
                      </td>
                      <td>
                        <span className={`payment-badge ${getMethodBadgeClass(ord.paymentMethod)}`}>
                          {ord.paymentMethod === 'CASH' && '💵 '}
                          {ord.paymentMethod === 'QRIS' && '📱 '}
                          {ord.paymentMethod === 'TRANSFER' && '🏦 '}
                          {getMethodLabel(ord.paymentMethod)}
                        </span>
                        {ord.paymentReference && (
                          <small style={{ display: 'block', marginTop: '3px', color: '#666' }}>
                            Ref: {ord.paymentReference}
                          </small>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: '#1b6336' }}>{formatMoney(ord.total)}</strong>
                        {pts > 0 && (
                          <small style={{ color: '#d97706', fontWeight: 800, display: 'block' }}>
                            🎁 +{pts} Poin
                          </small>
                        )}
                      </td>
                      <td>
                        <span className={`status-chip ${ord.status === 'VOIDED' ? 'bad' : ord.paymentStatus === 'PAID' ? 'good' : 'warning'}`}>
                          {ord.status === 'VOIDED' ? 'DIBATALKAN' : ord.paymentStatus === 'PAID' ? 'LUNAS' : ord.paymentStatus === 'PARTIAL' ? 'DIBAYAR SEBAGIAN' : 'BELUM LUNAS'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-view-struk"
                            onClick={() => setSelectedOrder(ord)}
                            title="Lihat struk & cetak"
                          >
                            📄 Lihat Struk
                          </button>
                          {ord.status !== 'VOIDED' && <button className="btn-view-struk void-action" onClick={() => { setVoidTarget(ord); setVoidReason(''); }}>Batalkan</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredOrders.length && (
                  <tr>
                    <td colSpan="7" className="table-empty">
                      Belum ada riwayat transaksi yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {voidTarget && <div className="receipt-modal-backdrop" onClick={() => !voidSaving && setVoidTarget(null)}><div className="void-dialog" onClick={(event) => event.stopPropagation()}><span className="panel-kicker">Kontrol transaksi</span><h2>Batalkan transaksi?</h2><p>{voidTarget.orderNumber} · {formatMoney(voidTarget.total)}</p><label>Alasan pembatalan<textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Contoh: salah input jumlah barang" autoFocus /></label><div className="void-dialog-actions"><button className="btn btn-secondary" onClick={() => setVoidTarget(null)} disabled={voidSaving}>Kembali</button><button className="btn btn-danger" onClick={voidOrder} disabled={voidSaving || !voidReason.trim()}>{voidSaving ? 'Memproses...' : 'Ya, batalkan'}</button></div></div></div>}

        {/* Modal Struk Belanja / Cetak Ulang */}
        {selectedOrder && (
          <div className="receipt-modal-backdrop" onClick={() => setSelectedOrder(null)}>
            <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="receipt-modal-header no-print">
                <h3>Rincian Struk Transaksi</h3>
                <button className="receipt-close-btn" onClick={() => setSelectedOrder(null)}>
                  ×
                </button>
              </div>

              {/* Thermal paper receipt box */}
              <div className="receipt-paper" id="printable-receipt">
                <div className="receipt-shop-head">
                  <h2>GLOSIR</h2>
                  <p>Grosir & Sembako Terpercaya</p>
                  <small>Jl. Raya Glosir No. 88, Jawa Barat</small>
                  <small>WhatsApp: 0812-3456-7890</small>
                </div>

                <div className="receipt-divider-dash" />

                <div className="receipt-meta">
                  <div>
                    <span>No. Faktur:</span>
                    <strong>{selectedOrder.orderNumber}</strong>
                  </div>
                  <div>
                    <span>Waktu:</span>
                    <span>{new Date(selectedOrder.createdAt).toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <span>Kasir:</span>
                    <span>{selectedOrder.cashierName || 'Kasir Glosir'}</span>
                  </div>
                  <div>
                    <span>Pelanggan:</span>
                    <span>{selectedOrder.customer?.name || 'Pelanggan Umum'}</span>
                  </div>
                </div>

                <div className="receipt-divider-dash" />

                <div className="receipt-items-list">
                  {(selectedOrder.items || []).map((it, idx) => (
                    <div key={idx} className="receipt-item-row">
                      <div className="receipt-item-title">
                        <strong>{it.name}</strong>
                        <span>
                          {it.quantity || it.qty} x {formatMoney(it.unitPrice || it.price)}
                        </span>
                      </div>
                      <div className="receipt-item-total">
                        <strong>{formatMoney(it.total || (it.unitPrice * (it.quantity || it.qty)))}</strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="receipt-divider-dash" />

                <div className="receipt-summary">
                  <div className="receipt-sum-row">
                    <span>Subtotal</span>
                    <span>{formatMoney(selectedOrder.subtotal || selectedOrder.total)}</span>
                  </div>

                  {selectedOrder.discount > 0 && (
                    <div className="receipt-sum-row" style={{ color: '#c73d3d' }}>
                      <span>Diskon</span>
                      <span>-{formatMoney(selectedOrder.discount)}</span>
                    </div>
                  )}

                  <div className="receipt-sum-row total-row">
                    <strong>TOTAL BELANJA</strong>
                    <strong>{formatMoney(selectedOrder.total)}</strong>
                  </div>

                  {selectedOrder.paymentMethod === 'CASH' && (
                    <>
                      <div className="receipt-sum-row">
                        <span>Uang Diterima</span>
                        <span>{formatMoney(selectedOrder.paidAmount || selectedOrder.total)}</span>
                      </div>
                      <div className="receipt-sum-row">
                        <span>Kembalian</span>
                        <span>{formatMoney(selectedOrder.change || 0)}</span>
                      </div>
                    </>
                  )}

                  {selectedOrder.paymentReference && (
                    <div className="receipt-sum-row">
                      <span>No. Ref / Pengirim</span>
                      <span style={{ fontSize: '0.72rem' }}>{selectedOrder.paymentReference}</span>
                    </div>
                  )}

                  <div className="receipt-sum-row">
                    <span>Status</span>
                    <strong style={{ color: selectedOrder.paymentStatus === 'PAID' ? '#177d47' : '#b45309' }}>
                      {selectedOrder.paymentStatus === 'PAID' ? 'LUNAS' : selectedOrder.paymentStatus === 'PARTIAL' ? 'DIBAYAR SEBAGIAN' : 'BELUM LUNAS'}
                    </strong>
                  </div>
                </div>

                {/* Section Poin di Struk Cetak Ulang */}
                <div className="receipt-divider-dash" />
                <div className="receipt-point-summary">
                  <strong style={{ display: 'block', textAlign: 'center', marginBottom: '6px' }}>
                    ★ PROGRAM POIN MEMBER GLOSIR ★
                  </strong>
                  <div className="receipt-sum-row" style={{ color: '#177d47', fontWeight: 'bold' }}>
                    <span>Poin Transaksi Ini:</span>
                    <span>
                      +{selectedOrder.earnedPoints !== undefined
                        ? selectedOrder.earnedPoints
                        : calculateEarnedPoints(selectedOrder.total)}{' '}
                      Poin
                    </span>
                  </div>
                  {selectedOrder.currentPoints && (
                    <div className="receipt-sum-row">
                      <span>Total Saldo Poin:</span>
                      <strong>{selectedOrder.currentPoints} Poin</strong>
                    </div>
                  )}
                </div>

                <div className="receipt-divider-dash" />

                <div className="receipt-footer">
                  <p>*** TERIMA KASIH ***</p>
                  <small>
                    Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan kecuali ada perjanjian.
                  </small>
                </div>
              </div>

              {/* Actions */}
              <div className="receipt-modal-actions no-print">
                <button className="btn btn-primary" onClick={handlePrint}>
                  🖨️ Cetak Struk
                </button>
                <button
                  className="btn btn-light"
                  onClick={() => handleShareWhatsApp(selectedOrder)}
                >
                  💬 Kirim Struk WA
                </button>
                <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
