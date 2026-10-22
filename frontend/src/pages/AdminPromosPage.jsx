import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { Link } from 'react-router-dom';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', code: '', type: 'Persentase', value: '', minPurchase: '', maxDiscount: '', usageLimit: '', startsAt: '', endsAt: '', categoryIds: [], productIds: [], status: 'Aktif' };

const toDateInputValue = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function AdminPromosPage() {
  const [promos, setPromos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadPromos = async () => {
    try {
      const response = await apiFetch('/promos/admin/list');
      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.promos)) {
        setPromos(data.promos.map((promo) => ({
          id: promo.id,
          name: promo.name,
          code: promo.code || '',
          type: promo.discountType === 'PERCENT' ? 'Persentase' : 'Potongan tetap',
          value: Number(promo.discountValue || 0),
          minPurchase: promo.minPurchase ?? '',
          maxDiscount: promo.maxDiscount ?? '',
          usageLimit: promo.usageLimit ?? '',
          startsAt: promo.startsAt,
          endsAt: promo.endsAt,
          categoryIds: promo.categoryIds || [],
          productIds: promo.productIds || [],
          status: promo.isActive ? 'Aktif' : 'Draft',
        })));
      }
    } catch (error) {
      setPromos([]);
      setNotice('Gagal memuat data promo dari database.');
    }
  };

  useEffect(() => {
    loadPromos();
    Promise.all([
      apiFetch('/categories/public/list').then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Kategori gagal dimuat.');
        setCategories(data.categories || []);
      }),
      apiFetch('/products?all=true').then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Produk gagal dimuat.');
        setProducts(data.products || []);
      }),
    ]).catch((error) => setNotice(error.message || 'Data kategori dan produk gagal dimuat.'));
  }, []);

  useEffect(() => {
    if (!formOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !saving) resetForm();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [formOpen, saving]);

  const visiblePromos = promos.filter((promo) => `${promo.name} ${promo.code}`.toLowerCase().includes(search.toLowerCase()));
  const formatPeriod = (promo) => {
    const start = toDateInputValue(promo.startsAt);
    const end = toDateInputValue(promo.endsAt);
    if (!start && !end) return 'Tanpa batas tanggal';
    if (start && end) return `${start} s.d. ${end}`;
    return start ? `Mulai ${start}` : `Sampai ${end}`;
  };
  const formatScope = (promo) => {
    const categoriesCount = promo.categoryIds.length;
    const productsCount = promo.productIds.length;
    if (!categoriesCount && !productsCount) return 'Semua barang';
    return [
      categoriesCount ? `${categoriesCount} kategori` : '',
      productsCount ? `${productsCount} barang` : '',
    ].filter(Boolean).join(' + ');
  };
  const allSelected = visiblePromos.length > 0 && visiblePromos.every((promo) => selectedIds.includes(promo.id));
  const deleteSelected = async () => {
    if (bulkDeleting) return;
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} promo terpilih?`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/promos/${id}`, { method: 'DELETE', silentNotify: true }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
      const count = results.filter((result) => result.status === 'fulfilled').length;
      setSelectedIds([]); await loadPromos();
      setNotice(`${count} promo berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
      showNotice(`${count} promo berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`, count < results.length ? 'error' : 'success');
    } finally { setBulkDeleting(false); }
  };

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const updatePromoType = (event) => setForm((current) => ({ ...current, type: event.target.value, value: '' }));
  const toggleTarget = (field, id, checked) => setForm((current) => ({
    ...current,
    [field]: checked ? [...new Set([...current[field], id])] : current[field].filter((value) => value !== id),
  }));
  const resetForm = () => { setForm(emptyForm); setEditingId(null); setFormNotice(''); setFormOpen(false); };
  const openCreateForm = () => { setForm(emptyForm); setEditingId(null); setFormNotice(''); setFormOpen(true); };

  const submitForm = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.code.trim() || !form.value) {
      setFormNotice('Lengkapi nama, kode, dan nilai promo.');
      return;
    }
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
      setFormNotice('Tanggal akhir promo tidak boleh sebelum tanggal mulai.');
      return;
    }
    if (!await confirmAction(`Yakin ingin ${editingId ? 'memperbarui promo ini' : 'menambahkan promo baru'}?`)) return;

    const localDateTime = (date, isEnd = false) => date
      ? new Date(`${date}T${isEnd ? '23:59:59.999' : '00:00:00'}`).toISOString()
      : null;
    const payload = {
      name: form.name,
      code: form.code.trim().toUpperCase(),
      discountType: form.type === 'Persentase' ? 'PERCENT' : 'FIXED',
      discountValue: Number(form.value),
      minPurchase: form.minPurchase ? Number(form.minPurchase) : null,
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      startsAt: localDateTime(form.startsAt),
      endsAt: localDateTime(form.endsAt, true),
      categoryIds: form.categoryIds,
      productIds: form.productIds,
      isActive: form.status === 'Aktif',
    };

    setSaving(true);
    try {
      const response = await apiFetch(editingId ? `/promos/${editingId}` : '/promos', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Promo gagal disimpan');
      setNotice(editingId ? 'Promo berhasil diperbarui di database.' : 'Promo berhasil ditambahkan ke database.');
      resetForm();
      await loadPromos();
    } catch (error) {
      setFormNotice(error.message || 'Promo gagal disimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promo) => {
    if (deletingId) return;
    if (!await confirmAction(`Hapus promo "${promo.name}"?`)) return;
    setDeletingId(promo.id);
    try {
      const response = await apiFetch(`/promos/${promo.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Promo gagal dihapus');
      setNotice('Promo berhasil dihapus dari database.');
      await loadPromos();
    } catch (error) {
      setNotice(error.message || 'Promo gagal dihapus');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminShell active="Promo" className="admin-crud-shell">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Campaign management</p>
            <h1>Kelola Promo</h1>
            <p className="admin-subtitle">Atur kode diskon dan campaign penjualan Glosir.</p>
          </div>
          <Link to="/promo" className="btn btn-secondary">Lihat promo</Link>
        </header>

        {notice && (
          <div className="crud-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button>
          </div>
        )}

        {formOpen && (
          <div className="crud-modal-backdrop promo-modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) resetForm();
          }}>
            <form className="crud-form-panel crud-modal-box promo-modal-box" onSubmit={submitForm} role="dialog" aria-modal="true" aria-labelledby="promo-form-title">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Edit promo' : 'Promo baru'}</span>
                <h2 id="promo-form-title">{editingId ? 'Perbarui campaign' : 'Tambah promo'}</h2>
              </div>
              <button type="button" className="promo-modal-close" onClick={resetForm} disabled={saving} aria-label="Tutup form"><X size={20} /></button>
            </div>

            {formNotice && <div className="crud-notice" role="alert">{formNotice}</div>}
            <label>Nama promo<input name="name" value={form.name} onChange={updateField} placeholder="Contoh: Promo Lebaran" /></label>
            <label>Kode promo<input name="code" value={form.code} onChange={updateField} placeholder="LEBARAN15" /></label>
            <label>Minimal belanja barang promo (opsional)<CurrencyInput name="minPurchase" value={form.minPurchase} onValueChange={(value) => setForm((current) => ({ ...current, minPurchase: value }))} placeholder="Rp 0" /></label>
            <label>Batas potongan maksimum (opsional)<CurrencyInput name="maxDiscount" value={form.maxDiscount} onValueChange={(value) => setForm((current) => ({ ...current, maxDiscount: value }))} placeholder="Tanpa batas" /></label>
            <label>Kuota penggunaan (opsional)<input name="usageLimit" type="number" min="1" value={form.usageLimit} onChange={updateField} placeholder="Tanpa batas" /></label>

            <div className="form-two-columns">
              <label>Tanggal mulai (opsional)<input name="startsAt" type="date" value={toDateInputValue(form.startsAt)} onChange={updateField} /></label>
              <label>Tanggal berakhir (opsional)<input name="endsAt" type="date" value={toDateInputValue(form.endsAt)} onChange={updateField} /></label>
            </div>
            <small className="field-help">Tanggal berakhir tetap berlaku sampai pukul 23.59 pada hari tersebut.</small>

            <div className="promo-target-grid">
              <section aria-labelledby="promo-category-heading">
                <h3 id="promo-category-heading">Kategori yang mendapat promo</h3>
                <small className="field-help">Kosongkan kategori dan barang agar promo berlaku untuk semua barang.</small>
                <small className="field-help">Jika dibatasi, promo berlaku untuk barang reguler; parsel dan paket acara tidak termasuk.</small>
                <input aria-label="Cari kategori" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Cari kategori..." />
                <div className="promo-target-list">
                  {categories.filter((category) => category.name.toLowerCase().includes(categorySearch.toLowerCase())).map((category) => (
                    <label key={category.id}><input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={(event) => toggleTarget('categoryIds', category.id, event.target.checked)} />{category.name}</label>
                  ))}
                  {categories.length === 0 && <small>Kategori belum tersedia.</small>}
                </div>
              </section>

              <section aria-labelledby="promo-product-heading">
                <h3 id="promo-product-heading">Barang tertentu yang mendapat promo</h3>
                <small className="field-help">Jika kategori dan barang dipilih, barang yang cocok salah satunya bisa menggunakan promo.</small>
                <input aria-label="Cari barang" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama barang..." />
                <div className="promo-target-list">
                  {products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(productSearch.toLowerCase())).map((product) => (
                    <label key={product.id}><input type="checkbox" checked={form.productIds.includes(product.id)} onChange={(event) => toggleTarget('productIds', product.id, event.target.checked)} />{product.name}<small>{product.category}</small></label>
                  ))}
                  {products.length === 0 && <small>Barang belum tersedia.</small>}
                </div>
              </section>
            </div>

            <div className="form-two-columns">
              <label>
                Tipe
                <select name="type" value={form.type} onChange={updatePromoType}>
                  <option value="Persentase">Persentase (%)</option>
                  <option value="Potongan tetap">Potongan Rupiah (Rp)</option>
                </select>
              </label>
              <label>
                Status
                <select name="status" value={form.status} onChange={updateField}>
                  <option>Aktif</option>
                  <option>Draft</option>
                </select>
              </label>
            </div>

            <label>{form.type === 'Potongan tetap' ? 'Nominal potongan (Rupiah)' : 'Besar diskon (Persen)'}{form.type === 'Potongan tetap' ? <CurrencyInput name="value" value={form.value} onValueChange={(value) => setForm((current) => ({ ...current, value }))} placeholder="Rp 25.000" /> : <input name="value" value={form.value} onChange={updateField} type="number" min="0" max="100" placeholder="15" />}<small className="field-help">{form.type === 'Potongan tetap' ? 'Contoh: ketik 25000 untuk menjadi Rp 25.000.' : 'Contoh: ketik 15 untuk diskon 15%.'}</small></label>
            <div className="promo-form-actions">
              <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah promo'}</button>
            </div>
            </form>
          </div>
        )}

        <section className="crud-table-panel promo-table-panel">
            <div className="crud-toolbar">
              <label className="crud-search">
                <Search className="w-4 h-4 text-emerald-600 inline mr-1" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau kode..." />
              </label>
              <button type="button" className="btn btn-primary promo-add-button" onClick={openCreateForm}><Plus size={16} />Tambah promo</button>
            </div>

            <BulkTableActions selectedCount={selectedIds.length} totalCount={visiblePromos.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? visiblePromos.map((promo) => promo.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Nama promo</th>
                    <th>Jenis</th>
                    <th>Nilai</th>
                    <th>Periode</th>
                    <th>Berlaku untuk</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePromos.map((promo) => (
                    <tr key={promo.id}>
                      <td className="bulk-check-column"><BulkRowCheckbox checked={selectedIds.includes(promo.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, promo.id])] : current.filter((id) => id !== promo.id))} label={`Pilih ${promo.name}`} /></td>
                      <td><strong>{promo.name}</strong><small>{promo.code}</small></td>
                      <td>{promo.type}</td>
                      <td>{promo.type === 'Persentase' ? `${promo.value}%` : `Rp ${Number(promo.value).toLocaleString('id-ID')}`}</td>
                      <td>{formatPeriod(promo)}</td>
                      <td>{formatScope(promo)}</td>
                      <td><span className="status-chip good">{promo.status}</span></td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-action" data-action-label="Edit" onClick={() => {
                            setEditingId(promo.id);
                            setForm({ ...emptyForm, name: promo.name, code: promo.code, type: promo.type, value: promo.value, minPurchase: promo.minPurchase, maxDiscount: promo.maxDiscount, usageLimit: promo.usageLimit, startsAt: toDateInputValue(promo.startsAt), endsAt: toDateInputValue(promo.endsAt), categoryIds: promo.categoryIds, productIds: promo.productIds, status: promo.status });
                            setFormNotice('');
                            setFormOpen(true);
                          }} data-action="edit" title="Edit promo" aria-label={`Edit promo ${promo.name}`}><Pencil size={14} /></button>
                          <button type="button" className="icon-action icon-action-danger" data-action="delete" data-action-label={deletingId === promo.id ? 'Menghapus...' : 'Hapus'} onClick={() => handleDelete(promo)} disabled={deletingId === promo.id} title="Hapus promo" aria-label={`Hapus promo ${promo.name}`}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {visiblePromos.length === 0 && <div className="table-empty">Promo tidak ditemukan.</div>}
            </div>
        </section>

        <footer className="admin-footer">Glosir Owner Workspace <span>Data promo terhubung ke database</span></footer>
      </AdminShell>
  );
}
