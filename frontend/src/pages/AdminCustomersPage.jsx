import { useEffect, useState } from 'react';
import { Download, Eye, MessageCircle, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import DebtModal from '../components/DebtModal';
import ModalForm from '../components/ModalForm';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';
import { normalizeIndonesianPhone } from '../utils/phoneUtils';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import CurrencyInput from '../components/CurrencyInput';

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
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [debts, setDebts] = useState([]);
  const [debtModal, setDebtModal] = useState({ open: false, customer: null, debt: null });
  const [debtPayment, setDebtPayment] = useState(null);
  const [debtPaymentAccounts, setDebtPaymentAccounts] = useState([]);
  const [debtPaymentLoading, setDebtPaymentLoading] = useState(false);
  const [debtPaymentSaving, setDebtPaymentSaving] = useState(false);
  const [debtPaymentError, setDebtPaymentError] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
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
      if (debtFilter !== 'ALL') query.set('debtStatus', debtFilter);
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
        const remainingAmount = Number(debt.remainingAmount ?? (Number(debt.amount || 0) - Number(debt.paidAmount || 0)));
        if (!debt.customerId || remainingAmount <= 0) return;
        debtTotals[debt.customerId] = (debtTotals[debt.customerId] || 0) + remainingAmount;
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

  useEffect(() => { loadCustomers(); }, [customerPage, deferredSearch, debtFilter]);

  const loadDetail = async (customer) => {
    setDetailCustomer(customer);
    setDetail(null);
    setDetailLoading(true);
    setDetailError('');
    try {
      const response = await apiFetch(`/customers/${customer.id}/detail`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Detail pelanggan gagal dimuat');
      setDetail(data);
    } catch (error) {
      setDetailError(error.message || 'Detail pelanggan gagal dimuat.');
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
    setCustomerModalOpen(true);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyCustomer);
    setCustomerModalOpen(false);
  };

  const closeCustomerModal = () => {
    if (!saving) handleCancelEdit();
  };

  const handleAddCustomer = () => {
    setEditingId(null);
    setForm(emptyCustomer);
    setNotice('');
    setCustomerModalOpen(true);
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
      setNotice(err.message || 'Data pelanggan gagal disimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!await confirmAction(`Hapus data pelanggan "${name}"?`)) return;

    try {
      const res = await apiFetch(`/customers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Pelanggan gagal dihapus.');
      setNotice(`Pelanggan "${name}" telah dihapus.`);
      await loadCustomers();
    } catch (error) {
      setNotice(error.message || 'Pelanggan gagal dihapus. Data tetap tersimpan.');
    }
  };

  const deleteDebt = async (debt, customer = customers.find((item) => item.id === debt.customerId)) => {
    if (!await confirmAction(`Hapus catatan utang sebesar Rp ${Number(debt.amount).toLocaleString('id-ID')}? Catatan utang ini akan dihapus.`)) return;
    try {
      const response = await apiFetch(`/debts/${debt.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Piutang gagal dihapus.');
      setNotice('Catatan utang berhasil dihapus.');
      loadCustomers();
      if (customer && detailCustomer?.id === customer.id) loadDetail(customer);
    } catch (error) { setNotice(error.message || 'Catatan utang gagal dihapus.'); }
  };

  const openDebtPayment = async (debt) => {
    setDebtPaymentError('');
    setDebtPaymentLoading(true);
    try {
      const response = await apiFetch('/finance/accounts');
      const data = await response.json();
      const accounts = data.data || data.accounts;
      if (!response.ok || !data.success || !Array.isArray(accounts)) {
        throw new Error(data.message || 'Akun penerimaan gagal dimuat.');
      }
      if (!accounts.length) throw new Error('Belum ada akun penerimaan aktif untuk mencatat pembayaran.');
      setDebtPaymentAccounts(accounts);
      setDebtPayment({
        id: debt.id,
        amount: Number(debt.remainingAmount ?? Math.max(Number(debt.amount) - Number(debt.paidAmount || 0), 0)),
        accountId: accounts[0].id,
      });
    } catch (error) {
      setDebtPaymentError(error.message || 'Form pembayaran gagal dibuka.');
      setDebtPayment({ id: debt.id, amount: '', accountId: '' });
    } finally {
      setDebtPaymentLoading(false);
    }
  };

  const submitDebtPayment = async (event) => {
    event.preventDefault();
    if (!debtPayment || debtPaymentSaving) return;
    const amount = Number(debtPayment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDebtPaymentError('Jumlah pembayaran harus lebih dari Rp 0.');
      return;
    }
    if (!debtPayment.accountId) {
      setDebtPaymentError('Pilih akun penerimaan pembayaran.');
      return;
    }
    if (!await confirmAction(`Catat pembayaran Rp ${amount.toLocaleString('id-ID')} dari ${detailCustomer?.name || 'pelanggan'}?`)) return;
    setDebtPaymentSaving(true);
    setDebtPaymentError('');
    try {
      const response = await apiFetch(`/debts/${debtPayment.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, accountId: debtPayment.accountId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pembayaran gagal dicatat.');
      setDebtPayment(null);
      setNotice('Pembayaran utang berhasil dicatat.');
      await Promise.all([loadCustomers(), detailCustomer ? loadDetail(detailCustomer) : Promise.resolve()]);
    } catch (error) {
      setDebtPaymentError(error.message || 'Pembayaran gagal dicatat.');
    } finally {
      setDebtPaymentSaving(false);
    }
  };

  return (
    <AdminShell active="Data Pelanggan" className="admin-crud-shell customer-page-shell">
      <DebtModal isOpen={debtModal.open} customer={debtModal.customer} debt={debtModal.debt} onClose={() => setDebtModal({ open: false, customer: null, debt: null })} onSaved={(message) => { setNotice(message); loadCustomers(); if (detailCustomer?.id === debtModal.customer?.id) loadDetail(debtModal.customer); }} />
      <ModalForm
        isOpen={customerModalOpen}
        onClose={closeCustomerModal}
        title={editingId ? 'Edit pelanggan' : 'Tambah pelanggan'}
        subtitle={editingId ? 'Perbarui informasi kontak pelanggan. Data utang tidak berubah di sini.' : 'Simpan informasi kontak dan catatan pelanggan toko.'}
        kicker={editingId ? 'Perbarui data' : 'Pelanggan baru'}
        maxWidth="780px"
        cardClassName="customer-form-modal"
      >
        {notice && (
          <div className="crud-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Tutup">×</button>
          </div>
        )}
        <form className="customer-editor-form" onSubmit={handleSubmit}>
          <label>
            Nama lengkap / toko *
            <input name="name" required autoFocus value={form.name} onChange={handleChange} placeholder="Contoh: Budi Santoso / Warung Berkah" />
          </label>
          <div className="form-two-columns customer-contact-fields">
            <label>No. WhatsApp / HP<input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={handleChange} placeholder="081234567890" /></label>
            <label>Email (opsional)<input name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} placeholder="nama@email.com" /></label>
          </div>
          <label>Alamat<textarea name="address" rows="3" value={form.address} onChange={handleChange} placeholder="Alamat lengkap pengiriman atau toko..." /></label>
          <label>Catatan pelanggan<textarea name="notes" rows="3" value={form.notes} onChange={handleChange} placeholder="Catatan belanja, preferensi produk, dan informasi penting lainnya" /></label>
          <div className="crud-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={closeCustomerModal} disabled={saving}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Daftarkan pelanggan'}</button>
          </div>
        </form>
      </ModalForm>
      {detailCustomer && (
        <div className="crud-modal-backdrop customer-action-modal" onClick={() => setDetailCustomer(null)}>
          <section className="crud-modal-box customer-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div><span className="panel-kicker">Profil pelanggan</span><h2 id="customer-detail-title">{detailCustomer.name}</h2><p>Informasi kontak, ringkasan belanja, utang, dan riwayat transaksi.</p></div>
              <button type="button" className="customer-detail-close" onClick={() => setDetailCustomer(null)}>Tutup</button>
            </div>
            {detailLoading ? <p className="customer-detail-loading" role="status">Memuat detail pelanggan...</p>
              : detailError ? <div className="customer-load-error" role="alert"><div><strong>Detail belum bisa dimuat</strong><span>{detailError}</span></div><button type="button" onClick={() => loadDetail(detailCustomer)}>Coba lagi</button></div>
                : detail && (
                  <>
                    <div className="customer-detail-metrics">
                      <div><small>Total belanja</small><strong>Rp {Number(detail.summary.totalSpent).toLocaleString('id-ID')}</strong></div>
                      <div><small>Jumlah transaksi</small><strong>{detail.summary.totalOrders}</strong></div>
                      <div><small>Sisa utang</small><strong>Rp {Number(detail.summary.outstandingDebt).toLocaleString('id-ID')}</strong></div>
                      <div><small>WhatsApp</small><strong>{detail.customer.phone || 'Belum tersedia'}</strong></div>
                    </div>
                    <div className="customer-detail-list customer-detail-debts">
                      <div className="customer-detail-section-heading"><div><h3>Utang aktif</h3><p>Sisa utang yang masih perlu dibayar.</p></div><button type="button" className="customer-detail-add-debt" onClick={() => setDebtModal({ open: true, customer: detailCustomer, debt: null })}><Plus size={14} /> Tambah utang</button></div>
                      {detail.debts.filter((debt) => Number(debt.remainingAmount) > 0).length ? detail.debts.filter((debt) => Number(debt.remainingAmount) > 0).map((debt) => (
                        <div className="customer-detail-debt-row" key={debt.id}>
                          <div><strong>{debt.description || 'Tanpa keterangan'}</strong><span>{Number(debt.remainingAmount) > 0 ? `Masih berutang · Sisa Rp ${Number(debt.remainingAmount).toLocaleString('id-ID')}` : 'Lunas'} · Total Rp {Number(debt.amount).toLocaleString('id-ID')} · Dicatat {new Date(debt.createdAt).toLocaleDateString('id-ID')}{debt.dueDate ? ` · Jatuh tempo ${new Date(debt.dueDate).toLocaleDateString('id-ID')}` : ''}</span></div>
                          <div className="customer-debt-actions debt-row-actions">
                            {Number(debt.remainingAmount) > 0 && <button type="button" className="customer-debt-pay" onClick={() => openDebtPayment(debt)} disabled={debtPaymentLoading || debtPaymentSaving}>Catat pembayaran</button>}
                            <button className="icon-action" data-action="edit" data-action-label="Edit utang" onClick={() => setDebtModal({ open: true, customer: detailCustomer, debt })} title="Edit catatan utang" aria-label="Edit catatan utang"><Pencil size={12} /></button>
                            <button className="icon-action icon-action-danger" data-action="delete" data-action-label="Hapus utang" onClick={() => deleteDebt(debt, detailCustomer)} title="Hapus catatan utang" aria-label="Hapus catatan utang"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      )) : <p className="customer-detail-empty">Tidak ada utang yang perlu dibayar.</p>}
                      {detail.debts.some((debt) => Number(debt.remainingAmount) <= 0) && (
                        <div className="customer-paid-debts">
                          <h4>Riwayat utang lunas</h4>
                          {detail.debts.filter((debt) => Number(debt.remainingAmount) <= 0).map((debt) => (
                            <div className="customer-detail-debt-row customer-paid-debt-row" key={debt.id}>
                              <div><strong>{debt.description || 'Tanpa keterangan'}</strong><span>Lunas · Dibayar Rp {Number(debt.paidAmount).toLocaleString('id-ID')} dari Rp {Number(debt.amount).toLocaleString('id-ID')} · Dicatat {new Date(debt.createdAt).toLocaleDateString('id-ID')}{debt.paidAt ? ` · Lunas ${new Date(debt.paidAt).toLocaleDateString('id-ID')}` : ''}</span></div>
                              <span className="customer-paid-badge">Lunas</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="customer-detail-columns">
                      <div className="customer-detail-list"><h3>Produk yang sering dibeli</h3>{detail.frequentProducts.length ? detail.frequentProducts.map((item) => <p key={item.name}><strong>{item.name}</strong><span>{item.quantity} unit · Rp {Number(item.total).toLocaleString('id-ID')}</span></p>) : <p className="customer-detail-empty">Belum ada riwayat belanja.</p>}</div>
                      <div className="customer-detail-list"><h3>Riwayat transaksi</h3>{detail.orders.length ? detail.orders.slice(0, 8).map((order) => <p key={order.id}><strong>{order.orderNumber}</strong><span>{new Date(order.createdAt).toLocaleDateString('id-ID')} · Rp {Number(order.total).toLocaleString('id-ID')}</span></p>) : <p className="customer-detail-empty">Belum ada transaksi.</p>}</div>
                    </div>
                    <div className="customer-detail-contact">
                      <p><strong>Email</strong><span>{detail.customer.email || 'Belum tersedia'}</span></p>
                      <p><strong>Alamat</strong><span>{detail.customer.address || 'Belum tersedia'}</span></p>
                      {detail.customer.notes && <p><strong>Catatan</strong><span>{detail.customer.notes}</span></p>}
                    </div>
                  </>
                )}
          </section>
        </div>
      )}
      {debtPayment && (
        <div className="crud-modal-backdrop debt-payment-modal" onClick={() => !debtPaymentSaving && setDebtPayment(null)}>
          <form className="crud-modal-box debt-payment-dialog" onSubmit={submitDebtPayment} onClick={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div><span className="panel-kicker">Pembayaran utang</span><h2>{detailCustomer?.name || 'Pelanggan'}</h2><p>Catat uang yang benar-benar diterima. Pembayaran sebagian juga bisa dicatat.</p></div>
              <button type="button" className="text-button" onClick={() => setDebtPayment(null)} disabled={debtPaymentSaving}>Tutup</button>
            </div>
            <label>Jumlah dibayar<CurrencyInput name="amount" value={debtPayment.amount} onValueChange={(value) => setDebtPayment((current) => ({ ...current, amount: value }))} placeholder="Rp 10.000" /></label>
            <label>Uang diterima ke akun<select value={debtPayment.accountId} onChange={(event) => setDebtPayment((current) => ({ ...current, accountId: event.target.value }))} disabled={debtPaymentLoading || !debtPaymentAccounts.length}><option value="">Pilih akun penerimaan</option>{debtPaymentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            {debtPaymentLoading && <p className="customer-detail-loading" role="status">Memuat akun penerimaan...</p>}
            {debtPaymentError && <p className="form-error" role="alert">{debtPaymentError}</p>}
            <div className="crud-modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setDebtPayment(null)} disabled={debtPaymentSaving}>Batal</button><button type="submit" className="btn btn-primary" disabled={debtPaymentLoading || debtPaymentSaving || !debtPaymentAccounts.length}>{debtPaymentSaving ? 'Menyimpan...' : 'Simpan pembayaran'}</button></div>
          </form>
        </div>
      )}
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
            <button className="btn btn-primary customer-add-button" type="button" onClick={handleAddCustomer}>
              <Plus size={15} /> Tambah pelanggan
            </button>
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

        {notice && !customerModalOpen && (
          <div className="crud-notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Tutup">×</button>
          </div>
        )}

        <div className="crud-layout-full">
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
              <select value={debtFilter} onChange={(event) => { setDebtFilter(event.target.value); setCustomerPage(1); }} aria-label="Filter status piutang">
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
                        <div className="customer-row-actions">
                          <div className="row-actions">
                            <button className="icon-action" data-action="detail" data-action-label="Detail" onClick={() => loadDetail(cust)} title="Lihat detail pelanggan" aria-label={`Lihat detail ${cust.name}`}><Eye size={14} /></button>
                            <button className="icon-action" data-action="edit" data-action-label="Edit" onClick={() => handleEdit(cust)} title="Edit data pelanggan" aria-label={`Edit data pelanggan ${cust.name}`}><Pencil size={14} /></button>
                            <button className="icon-action icon-action-danger" data-action="delete" data-action-label="Hapus" onClick={() => handleDelete(cust.id, cust.name)} title="Hapus data pelanggan" aria-label={`Hapus data pelanggan ${cust.name}`}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !loadError && !filteredCustomers.length && (
                    <tr>
                      <td colSpan="6" className="table-empty">
                        {customers.length ? 'Tidak ada pelanggan yang cocok dengan filter ini.' : 'Belum ada data pelanggan. Pilih “Tambah pelanggan” untuk mulai mengisi direktori.'}
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
          </section>
        </div>
    </AdminShell>
  );
}
