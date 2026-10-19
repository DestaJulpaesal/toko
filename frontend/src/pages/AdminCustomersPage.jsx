import { useEffect, useState } from 'react';
import { Download, Eye, MessageCircle, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import DebtModal from '../components/DebtModal';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';
import { normalizeIndonesianPhone } from '../utils/phoneUtils';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const emptyCustomer = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [debtFilter, setDebtFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const deferredSearch = useDebouncedValue(search);
  const [form, setForm] = useState(emptyCustomer);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [debts, setDebts] = useState([]);
  const [debtModal, setDebtModal] = useState({ open: false, customer: null, debt: null });
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPagination, setCustomerPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });

  const loadCustomers = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const token = localStorage.getItem('glosir_token');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const query = new URLSearchParams({ page: String(customerPage), pageSize: '50' });
      if (deferredSearch.trim()) query.set('search', deferredSearch.trim());
      const [customerRes, debtRes] = await Promise.all([
        apiFetch(`/customers?${query}`, { headers: authHeaders }),
        apiFetch('/debts')
      ]);

      const customerData = await customerRes.json();
      const debtData = await debtRes.json();
      if (!customerRes.ok || !customerData.success || !Array.isArray(customerData.customers)) {
        throw new Error(customerData.message || 'Data pelanggan gagal dimuat.');
      }
      if (!debtRes.ok || !debtData.success || !Array.isArray(debtData.debts)) {
        throw new Error(debtData.message || 'Data piutang pelanggan gagal dimuat.');
      }

      const debtTotals = {};
      setDebts(debtData.debts);
      debtData.debts.forEach((debt) => {
        if (!debt.customerId || debt.status === 'PAID') return;
        debtTotals[debt.customerId] = (debtTotals[debt.customerId] || 0) + Number(debt.amount || 0);
      });
      setCustomers(customerData.customers.map((customer) => ({
        ...customer,
        debtTotal: debtTotals[customer.id] || 0,
      })));
      setCustomerPagination(customerData.pagination || { page: customerPage, pageSize: 50, total: customerData.customers.length, totalPages: 1 });
    } catch (err) {
      setLoadError(err.message || 'Data pelanggan gagal dimuat dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(); }, [customerPage, deferredSearch]);

  const loadDetail = async (customer) => {
    setDetailLoading(true);
    try {
      const response = await apiFetch(`/customers/${customer.id}/detail`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Detail pelanggan gagal dimuat');
      setDetail(data);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCustomers = () => {
    const rows = filteredCustomers.map((customer) => [
      customer.name, customer.phone || '', customer.email || '', customer.address || '',
      customer.totalOrders || 0, customer.debtTotal || 0, customer.notes || '',
    ]);
    const csv = [['Nama', 'WhatsApp', 'Email', 'Alamat', 'Total Pesanan', 'Piutang', 'Catatan'], ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'data-pelanggan.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const debtMap = customers.reduce((acc, customer) => {
    acc[customer.id] = Number(customer.debtTotal || 0);
    return acc;
  }, {});

  const filteredCustomers = customers.filter((c) => {
    const q = deferredSearch.toLowerCase();
    const createdDate = new Date(c.createdAt);
    const dateKey = Number.isNaN(createdDate.getTime()) ? '' : createdDate.toLocaleDateString('en-CA');
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    ) && (debtFilter === 'ALL' || (debtFilter === 'OWING' && Number(c.debtTotal || 0) > 0) || (debtFilter === 'CLEAR' && Number(c.debtTotal || 0) <= 0))
      && (!dateFrom || dateKey >= dateFrom) && (!dateTo || dateKey <= dateTo);
  });

  const allVisibleCustomersSelected = filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedCustomerIds.includes(customer.id));
  const customerSummary = customers.reduce((summary, customer) => {
    const debt = Number(customer.debtTotal || 0);
    summary.debt += debt;
    summary.owing += debt > 0 ? 1 : 0;
    summary.orders += Number(customer.totalOrders || 0);
    return summary;
  }, { debt: 0, owing: 0, orders: 0 });
  const toggleCustomerSelection = (id, checked) => setSelectedCustomerIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  const toggleAllCustomers = (checked) => setSelectedCustomerIds(checked ? filteredCustomers.map((customer) => customer.id) : []);
  const deleteSelectedCustomers = async () => {
    if (!selectedCustomerIds.length || !await confirmAction(`Hapus ${selectedCustomerIds.length} pelanggan terpilih? Data pelanggan akan dihapus dari database.`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedCustomerIds.map((id) => apiFetch(`/customers/${id}`, { method: 'DELETE', silentNotify: true }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const deletedIds = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    setSelectedCustomerIds([]);
    setBulkDeleting(false);
    await loadCustomers();
    setNotice(`${deletedIds.length} pelanggan berhasil dihapus${deletedIds.length < results.length ? `, ${results.length - deletedIds.length} gagal` : ''}.`);
    showNotice(`${deletedIds.length} pelanggan berhasil dihapus${deletedIds.length < results.length ? `, ${results.length - deletedIds.length} gagal` : ''}.`, deletedIds.length < results.length ? 'error' : 'success');
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyCustomer);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNotice('Nama pelanggan wajib diisi.');
      return;
    }

    if (!await confirmAction(`Yakin ingin ${editingId ? 'memperbarui data pelanggan ini' : 'menambahkan pelanggan baru'}?`)) return;

    setSaving(true);
    setNotice('');

    try {
      const url = editingId
        ? `/customers/${editingId}`
        : '/customers';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('glosir_token') ? { Authorization: `Bearer ${localStorage.getItem('glosir_token')}` } : {}) },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setNotice(editingId ? 'Data pelanggan berhasil diperbarui.' : 'Pelanggan baru berhasil didaftarkan.');
        handleCancelEdit();
        loadCustomers();
      } else {
        throw new Error(data.message || 'Gagal menyimpan pelanggan');
      }
    } catch (err) {
      if (editingId) {
        setCustomers((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...form } : c)));
        setNotice('Data pelanggan berhasil diperbarui (mode lokal).');
      } else {
        const newCust = {
          id: `cust-local-${Date.now()}`,
          ...form,
          createdAt: new Date().toISOString(),
          totalOrders: 0,
        };
        setCustomers((prev) => [newCust, ...prev]);
        setNotice('Pelanggan baru berhasil ditambahkan (mode lokal).');
      }
      handleCancelEdit();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!await confirmAction(`Hapus data pelanggan "${name}"?`)) return;

    try {
      const res = await apiFetch(`/customers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice(`Pelanggan "${name}" telah dihapus.`);
        loadCustomers();
        return;
      }
    } catch (error) {
      setNotice(error.message || 'Pelanggan gagal dihapus. Data tetap tersimpan.');
      return;
    }

    setNotice(`Pelanggan "${name}" gagal dihapus. Data tetap tersimpan.`);
  };

  const deleteDebt = async (debt) => {
    if (!await confirmAction(`Hapus piutang ${debt.customerName || 'pelanggan'} sebesar Rp ${Number(debt.amount).toLocaleString('id-ID')}?`)) return;
    try {
      const response = await apiFetch(`/debts/${debt.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Piutang gagal dihapus.');
      setNotice('Piutang berhasil dihapus.');
      loadCustomers();
    } catch (error) { setNotice(error.message || 'Piutang gagal dihapus.'); }
  };

  return (
    <AdminShell active="Data Pelanggan" className="admin-crud-shell customer-page-shell">
      <DebtModal isOpen={debtModal.open} customer={debtModal.customer} debt={debtModal.debt} onClose={() => setDebtModal({ open: false, customer: null, debt: null })} onSaved={(message) => { setNotice(message); loadCustomers(); }} />
        <header className="admin-header customer-page-header">
          <div>
            <p className="eyebrow light">Manajemen Pelanggan</p>
            <h1>Data Pelanggan</h1>
            <p className="admin-subtitle">
              Kelola data pembeli toko, piutang, dan riwayat kontak WhatsApp.
            </p>
          </div>
          <div className="customer-header-actions">
            <span className={`database-status ${loading ? 'loading' : loadError ? 'error' : 'ready'}`}>
              <i /> {loading ? 'Memuat data...' : loadError ? 'Gagal terhubung' : `${customers.length} pelanggan`}
            </span>
            <button className="customer-header-button" type="button" onClick={exportCustomers} disabled={!filteredCustomers.length} title="Unduh data pelanggan">
              <Download size={15} /> Export
            </button>
            <button className="customer-header-button" type="button" onClick={loadCustomers} disabled={loading} title="Muat ulang data pelanggan">
              <RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> {loading ? 'Memuat...' : 'Muat ulang'}
            </button>
          </div>
        </header>

        <section className="customer-summary-grid" aria-label="Ringkasan pelanggan">
          <article className="customer-summary-card"><span>Total pelanggan</span><strong>{customers.length.toLocaleString('id-ID')}</strong><small>Semua data terdaftar</small></article>
          <article className="customer-summary-card"><span>Memiliki piutang</span><strong>{customerSummary.owing.toLocaleString('id-ID')}</strong><small>Pelanggan dengan saldo berjalan</small></article>
          <article className="customer-summary-card customer-summary-card-debt"><span>Total piutang berjalan</span><strong>Rp {customerSummary.debt.toLocaleString('id-ID')}</strong><small>Belum termasuk piutang lunas</small></article>
          <article className="customer-summary-card"><span>Total transaksi</span><strong>{customerSummary.orders.toLocaleString('id-ID')}</strong><small>Akumulasi pesanan pelanggan</small></article>
        </section>

        {loadError && (
          <div className="customer-load-error" role="alert">
            <div><strong>Data pelanggan belum berhasil dimuat</strong><span>{loadError}</span></div>
            <button type="button" onClick={loadCustomers} disabled={loading}>Coba lagi</button>
          </div>
        )}

        {notice && (
          <div className="crud-notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Tutup">×</button>
          </div>
        )}

        <div className="crud-layout">
          {/* Form Tambah / Edit Pelanggan */}
          <section className={`crud-form-panel customer-form-panel ${editingId ? 'customer-edit-modal' : ''}`}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Mode Edit' : 'Input Baru'}</span>
                <h2>{editingId ? 'Ubah Data Pelanggan' : 'Tambah Pelanggan'}</h2>
              </div>
              {editingId && (
                <button className="text-button" type="button" onClick={handleCancelEdit}>
                  Batal
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Nama Lengkap / Toko *
                <input
                  name="name"
                  required
                  placeholder="Contoh: Budi Santoso / Warung Berkah"
                  value={form.name}
                  onChange={handleChange}
                />
              </label>

              <div className="form-two-columns customer-contact-fields">
                <label>
                  No. WhatsApp / HP
                  <input name="phone" type="tel" autoComplete="tel" placeholder="081234567890" value={form.phone} onChange={handleChange} />
                </label>
                <label>
                  Email (opsional)
                  <input name="email" type="email" autoComplete="email" placeholder="nama@email.com" value={form.email} onChange={handleChange} />
                </label>
              </div>

              <label>
                Alamat
                <textarea
                  name="address"
                  rows="2"
                  placeholder="Alamat lengkap pengiriman atau toko..."
                  value={form.address}
                  onChange={handleChange}
                />
              </label>

              <label>
                Catatan Khusus
                <textarea
                  name="notes"
                  rows="2"
                  placeholder="Catatan belanja, preferensi produk, dll..."
                  value={form.notes}
                  onChange={handleChange}
                />
              </label>

              <button type="submit" className="btn btn-primary full" disabled={saving}>
                {saving
                  ? 'Menyimpan...'
                  : editingId
                  ? 'Simpan Perubahan Data'
                  : '+ Daftarkan Pelanggan Baru'}
              </button>
            </form>
          </section>

          {/* Tabel Daftar Pelanggan */}
          <section className="crud-table-panel customer-table-panel">
            <div className="customer-list-heading">
              <div><span className="panel-kicker">Direktori</span><h2>Daftar pelanggan</h2><p>Cari pelanggan, cek saldo piutang, atau buka riwayat belanja.</p></div>
              <span className="customer-result-count">{customerPagination.total.toLocaleString('id-ID')} hasil</span>
            </div>
            <div className="crud-toolbar">
              <label className="crud-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCustomerPage(1); }}
                  placeholder="Cari nama, no. HP, email, atau alamat..."
                />
              </label>
              <select value={debtFilter} onChange={(event) => setDebtFilter(event.target.value)} aria-label="Filter status piutang">
                <option value="ALL">Semua status piutang</option>
                <option value="OWING">Masih berutang</option>
                <option value="CLEAR">Tidak ada piutang</option>
              </select>
              <label className="date-filter"><span>Terdaftar dari</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label className="date-filter"><span>Sampai</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
              {(search || debtFilter !== 'ALL' || dateFrom || dateTo) && <button type="button" className="customer-filter-reset" onClick={() => { setSearch(''); setDebtFilter('ALL'); setDateFrom(''); setDateTo(''); }}>Reset filter</button>}
            </div>
            <BulkTableActions selectedCount={selectedCustomerIds.length} totalCount={filteredCustomers.length} allSelected={allVisibleCustomersSelected} onToggleAll={toggleAllCustomers} onDelete={deleteSelectedCustomers} deleting={bulkDeleting} />

            <div className="product-table-wrap customer-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Pelanggan</th>
                    <th>Piutang / Utang</th>
                    <th>Kontak / WhatsApp</th>
                    <th>Alamat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id}>
                      <td className="bulk-check-column"><BulkRowCheckbox checked={selectedCustomerIds.includes(cust.id)} onChange={(checked) => toggleCustomerSelection(cust.id, checked)} label={`Pilih ${cust.name}`} /></td>
                      <td>
                        <strong>{cust.name}</strong>
                        <small>Terdaftar: {new Date(cust.createdAt).toLocaleDateString('id-ID')}</small>
                        {cust.notes && <small style={{ color: '#888' }}>{cust.notes}</small>}
                      </td>
                      <td>
                        <span className={Number(cust.debtTotal || 0) > 0 ? 'status-chip warning' : 'status-chip good'}>
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(cust.debtTotal || 0))}
                        </span>
                      </td>
                      <td>
                        {cust.phone ? (
                          <div className="customer-contact-line">
                            <span>{cust.phone}</span>
                            <a
                              href={`https://wa.me/${normalizeIndonesianPhone(cust.phone)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="wa-link-btn"
                              title="Chat WhatsApp"
                            >
                              <MessageCircle size={16} strokeWidth={2.4} />
                            </a>
                          </div>
                        ) : (
                          <span className="customer-missing-value">Belum ada</span>
                        )}
                        {cust.email && <small>{cust.email}</small>}
                      </td>
                      <td>
                        <span className={cust.address ? '' : 'customer-missing-value'}>{cust.address || 'Belum ada alamat'}</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-action" onClick={() => loadDetail(cust)} title="Lihat detail pelanggan" aria-label={`Lihat detail ${cust.name}`}><Eye size={14} /></button>
                          <button className="icon-action icon-action-debt" onClick={() => setDebtModal({ open: true, customer: cust, debt: null })} title="Tambah piutang" aria-label={`Tambah piutang ${cust.name}`}><Plus size={15} strokeWidth={2.5} /></button>
                          <button className="icon-action" onClick={() => handleEdit(cust)} title="Edit pelanggan" aria-label={`Edit pelanggan ${cust.name}`}><Pencil size={14} /></button>
                          <button className="icon-action icon-action-danger" onClick={() => handleDelete(cust.id, cust.name)} title="Hapus pelanggan" aria-label={`Hapus pelanggan ${cust.name}`}><Trash2 size={14} /></button>
                        </div>
                        {debts.filter((debt) => debt.customerId === cust.id).map((debt) => (
                          <div className="debt-row-actions" key={debt.id}><small>{debt.status === 'PAID' ? 'Lunas' : 'Belum lunas'}: Rp {Number(debt.amount).toLocaleString('id-ID')}</small><button className="icon-action" onClick={() => setDebtModal({ open: true, customer: cust, debt })} title="Edit piutang" aria-label="Edit piutang"><Pencil size={12} /></button><button className="icon-action icon-action-danger" onClick={() => deleteDebt(debt)} title="Hapus piutang" aria-label="Hapus piutang"><Trash2 size={12} /></button></div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {!loading && !loadError && !filteredCustomers.length && (
                    <tr>
                      <td colSpan="6" className="table-empty">
                        {customers.length ? 'Tidak ada pelanggan yang cocok dengan filter ini.' : 'Belum ada data pelanggan. Tambahkan pelanggan lewat formulir di samping.'}
                      </td>
                    </tr>
                  )}
                  {!loading && loadError && !filteredCustomers.length && (
                    <tr>
                      <td colSpan="6" className="table-empty">Data pelanggan tidak tersedia. Gunakan tombol “Coba lagi” di atas untuk memuat ulang.</td>
                    </tr>
                  )}
                  {loading && !filteredCustomers.length && <tr><td colSpan="6" className="table-empty">Memuat daftar pelanggan...</td></tr>}
                </tbody>
              </table>
            </div>
            {customerPagination.totalPages > 1 && (
              <div className="g-pagination" aria-label="Halaman daftar pelanggan">
                <span>Halaman {customerPagination.page} dari {customerPagination.totalPages} · {customerPagination.total.toLocaleString('id-ID')} pelanggan</span>
                <div>
                  <button type="button" className="g-btn" onClick={() => setCustomerPage((page) => Math.max(1, page - 1))} disabled={loading || customerPage <= 1}>Sebelumnya</button>
                  <button type="button" className="g-btn" onClick={() => setCustomerPage((page) => Math.min(customerPagination.totalPages, page + 1))} disabled={loading || customerPage >= customerPagination.totalPages}>Berikutnya</button>
                </div>
              </div>
            )}
            {detail && (
              <section className="customer-detail-panel">
                <div className="panel-heading">
                  <div><span className="panel-kicker">Profil Belanja</span><h2>{detail.customer.name}</h2></div>
                  <button type="button" className="customer-detail-close" onClick={() => setDetail(null)}>Tutup</button>
                </div>
                {detailLoading ? <p className="customer-detail-loading">Memuat detail pelanggan...</p> : (
                  <>
                    <div className="customer-detail-metrics">
                      <div><small>Total belanja</small><strong>Rp {Number(detail.summary.totalSpent).toLocaleString('id-ID')}</strong></div>
                      <div><small>Transaksi</small><strong>{detail.summary.totalOrders}</strong></div>
                      <div><small>Piutang berjalan</small><strong>Rp {Number(detail.summary.outstandingDebt).toLocaleString('id-ID')}</strong></div>
                      <div><small>WhatsApp</small><strong>{detail.customer.phone || 'Belum tersedia'}</strong></div>
                    </div>
                    <div className="customer-detail-columns">
                      <div className="customer-detail-list"><h3>Produk sering dibeli</h3>{detail.frequentProducts.length ? detail.frequentProducts.map((item) => <p key={item.name}><strong>{item.name}</strong><span>{item.quantity} unit · Rp {Number(item.total).toLocaleString('id-ID')}</span></p>) : <p className="customer-detail-empty">Belum ada riwayat belanja.</p>}</div>
                      <div className="customer-detail-list"><h3>Riwayat belanja</h3>{detail.orders.slice(0, 8).map((order) => <p key={order.id}><strong>{order.orderNumber}</strong><span>{new Date(order.createdAt).toLocaleDateString('id-ID')} · Rp {Number(order.total).toLocaleString('id-ID')}</span></p>)}</div>
                    </div>
                    {detail.customer.notes && <p><strong>Catatan:</strong> {detail.customer.notes}</p>}
                  </>
                )}
              </section>
            )}
          </section>
        </div>
    </AdminShell>
  );
}
