import { useEffect, useState } from 'react';
import { MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import DebtModal from '../components/DebtModal';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyCustomer = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  points: 0,
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyCustomer);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [debts, setDebts] = useState([]);
  const [debtModal, setDebtModal] = useState({ open: false, customer: null, debt: null });
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('glosir_token');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const [customerRes, debtRes] = await Promise.all([
        apiFetch('/customers', { headers: authHeaders }),
        apiFetch('/debts')
      ]);

      const customerData = await customerRes.json();
      const debtData = await debtRes.json();

      const debtTotals = {};
      if (debtData.success && Array.isArray(debtData.debts)) {
        setDebts(debtData.debts);
        debtData.debts.forEach((debt) => {
          if (!debt.customerId) return;
          if (debt.status === 'PAID') return;
          debtTotals[debt.customerId] = (debtTotals[debt.customerId] || 0) + Number(debt.amount || 0);
        });
      }

      if (customerData.success && Array.isArray(customerData.customers)) {
        setCustomers(customerData.customers.map((customer) => ({
          ...customer,
          debtTotal: debtTotals[customer.id] || 0,
        })));
      }
    } catch (err) {
      console.warn('Backend unavailable, using local demo customers:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const debtMap = customers.reduce((acc, customer) => {
    acc[customer.id] = Number(customer.debtTotal || 0);
    return acc;
  }, {});

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  const totalPointsDistributed = customers.reduce((sum, c) => sum + (c.points || 0), 0);
  const allVisibleCustomersSelected = filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedCustomerIds.includes(customer.id));
  const toggleCustomerSelection = (id, checked) => setSelectedCustomerIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  const toggleAllCustomers = (checked) => setSelectedCustomerIds(checked ? filteredCustomers.map((customer) => customer.id) : []);
  const deleteSelectedCustomers = async () => {
    if (!selectedCustomerIds.length || !await confirmAction(`Hapus ${selectedCustomerIds.length} pelanggan terpilih? Data pelanggan akan dihapus dari database.`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedCustomerIds.map((id) => apiFetch(`/customers/${id}`, { method: 'DELETE' }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const deletedIds = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    setSelectedCustomerIds([]);
    setBulkDeleting(false);
    await loadCustomers();
    setNotice(`${deletedIds.length} pelanggan berhasil dihapus${deletedIds.length < results.length ? `, ${results.length - deletedIds.length} gagal` : ''}.`);
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
      points: customer.points || 0,
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
        setCustomers((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...form, points: Number(form.points) || 0 } : c))
        );
        setNotice('Data pelanggan berhasil diperbarui (mode lokal).');
      } else {
        const newCust = {
          id: `cust-local-${Date.now()}`,
          ...form,
          points: Number(form.points) || 0,
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
    <div className="admin-shell admin-crud-shell customer-page-shell">
      <AdminSidebar active="Data Pelanggan" />
      <DebtModal isOpen={debtModal.open} customer={debtModal.customer} debt={debtModal.debt} onClose={() => setDebtModal({ open: false, customer: null, debt: null })} onSaved={(message) => { setNotice(message); loadCustomers(); }} />

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Manajemen Pelanggan & Loyalitas</p>
            <h1>Data Pelanggan</h1>
            <p className="admin-subtitle">
              Kelola data pembeli toko, poin loyalitas member, dan riwayat kontak WhatsApp.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className="pos-badge-points" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              ⭐ Total {totalPointsDistributed} Poin Beredar
            </span>
            <span className={`database-status ${loading ? 'loading' : 'ready'}`}>
              <i /> {loading ? 'Memuat data...' : `${customers.length} Pelanggan`}
            </span>
          </div>
        </header>

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

              <div className="form-two-columns">
                <label>
                  No. WhatsApp / HP
                  <input
                    name="phone"
                    placeholder="081234567890"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Saldo Poin Member
                  <input
                    name="points"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.points}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <label>
                Email (Opsional)
                <input
                  name="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </label>

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
            <div className="crud-toolbar">
              <label className="crud-search">
                <span>Cari</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, no. HP, atau alamat..."
                />
              </label>
            </div>
            <BulkTableActions selectedCount={selectedCustomerIds.length} totalCount={filteredCustomers.length} allSelected={allVisibleCustomersSelected} onToggleAll={toggleAllCustomers} onDelete={deleteSelectedCustomers} deleting={bulkDeleting} />

            <div className="product-table-wrap customer-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Pelanggan</th>
                    <th>Poin Member</th>
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
                        <span
                          className="pos-badge-points"
                          style={{ fontSize: '0.75rem', display: 'inline-flex', padding: '3px 8px' }}
                        >
                          ⭐ {cust.points || 0} Poin
                        </span>
                      </td>
                      <td>
                        <span className={Number(cust.debtTotal || 0) > 0 ? 'status-chip warning' : 'status-chip good'}>
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(cust.debtTotal || 0))}
                        </span>
                      </td>
                      <td>
                        {cust.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{cust.phone}</span>
                            <a
                              href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="wa-link-btn"
                              title="Chat WhatsApp"
                            >
                              <MessageCircle size={16} strokeWidth={2.4} />
                            </a>
                          </div>
                        ) : (
                          <span style={{ color: '#aaa' }}>-</span>
                        )}
                        {cust.email && <small>{cust.email}</small>}
                      </td>
                      <td>
                        <span>{cust.address || '-'}</span>
                      </td>
                      <td>
                        <div className="row-actions">
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
                  {!loading && !filteredCustomers.length && (
                    <tr>
                      <td colSpan="6" className="table-empty">
                        Data pelanggan tidak ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
