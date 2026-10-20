import { useEffect, useState } from 'react';
import { AlertCircle, Check, Gift, Minus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { Link } from 'react-router-dom';
import CurrencyInput from '../components/CurrencyInput';
import CatalogImageField from '../components/CatalogImageField';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', description: '', type: 'Standard', price: '', adminFee: '50000', status: 'Aktif', isManualPrice: false, imageUrl: '', items: [] };
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const PARCEL_ADMIN_FEE = 50000;

export default function AdminParcelsPage() {
  const [parcels, setParcels] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [notice, setNotice] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [productSearch, setProductSearch] = useState('');

  const loadParcels = async () => {
    try {
      const response = await apiFetch('/parcels');
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.parcels)) throw new Error(data.message || 'Data parsel gagal dimuat.');
      setParcels(data.parcels.map((parcel) => ({
        ...parcel,
        code: parcel.slug || parcel.name,
        type: parcel.type === 'CUSTOM' ? 'Custom' : 'Standard',
        status: parcel.isActive ? 'Aktif' : 'Draft',
      })));
    } catch (error) {
      console.error('Parcel list failed to load:', error);
      setParcels([]);
      setNotice(error.message || 'Gagal memuat data parcel dari database.');
    }
  };

  useEffect(() => {
    loadParcels();
  }, []);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      try {
        const response = await apiFetch('/products?all=true');
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Daftar barang gagal dimuat.');
        if (active) setProducts(data.products || []);
      } catch (error) {
        console.error('Parcel product list failed to load:', error);
        if (active) {
          setProducts([]);
          setNotice(error.message || 'Daftar barang gagal dimuat.');
        }
      } finally {
        if (active) setProductsLoading(false);
      }
    };
    loadProducts();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!formOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) resetForm();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [formOpen, saving]);

  const toggleItem = (variantId) => setForm((current) => ({ ...current, items: current.items.some((item) => item.variantId === variantId) ? current.items.filter((item) => item.variantId !== variantId) : [...current.items, { variantId, quantity: 1 }] }));
  const updateItemQuantity = (variantId, quantity) => setForm((current) => ({
    ...current,
    items: current.items.map((item) => item.variantId === variantId
      ? { ...item, quantity: quantity === '' ? '' : Math.max(1, Number(quantity) || 1) }
      : item),
  }));
  const changeItemQuantity = (variantId, delta) => {
    const item = form.items.find((entry) => entry.variantId === variantId);
    if (item) updateItemQuantity(variantId, Number(item.quantity || 1) + delta);
  };
  const autoPrice = form.items.reduce((sum, item) => sum + Number(products.find((product) => product.variantId === item.variantId)?.price || 0) * Number(item.quantity || 0), 0);
  const basePrice = form.items.reduce((sum, item) => sum + Number(products.find((product) => product.variantId === item.variantId)?.purchasePrice || 0) * Number(item.quantity || 0), 0);
  const sellingPrice = form.isManualPrice ? Number(form.price || 0) : autoPrice;
  const grossMargin = sellingPrice - basePrice;
  const annualTarget = form.items.length ? sellingPrice + PARCEL_ADMIN_FEE : 0;
  const filteredProducts = products.filter((product) => `${product.name} ${product.sku} ${product.barcode || ''}`.toLowerCase().includes(productSearch.toLowerCase().trim()));

  const incompleteParcels = parcels.filter((parcel) => !(parcel.itemCount || parcel.items?.length || 0));
  const visibleParcels = parcels.filter((parcel) => {
    const matchesSearch = `${parcel.name} ${parcel.description || ''} ${parcel.code} ${parcel.type}`.toLowerCase().includes(search.toLowerCase().trim());
    const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? parcel.status === 'Aktif' : parcel.status !== 'Aktif');
    return matchesSearch && matchesStatus;
  });
  const allSelected = visibleParcels.length > 0 && visibleParcels.every((parcel) => selectedIds.includes(parcel.id));
  const deleteSelected = async () => {
    if (bulkDeleting) return;
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} parsel terpilih?`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/parcels/${id}`, { method: 'DELETE', silentNotify: true }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
      const count = results.filter((result) => result.status === 'fulfilled').length;
      setSelectedIds([]); await loadParcels();
      setNotice(`${count} parsel berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
      showNotice(`${count} parsel berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`, count < results.length ? 'error' : 'success');
    } finally { setBulkDeleting(false); }
  };
  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const resetForm = () => { setForm(emptyForm); setEditingId(null); setProductSearch(''); setFormOpen(false); };
  const addParcel = () => { setForm(emptyForm); setEditingId(null); setProductSearch(''); setFormOpen(true); };
  const editParcel = (parcel) => {
    setEditingId(parcel.id);
    setProductSearch('');
    setFormOpen(true);
    setForm({
      name: parcel.name,
      description: parcel.description || '',
      type: parcel.type,
      price: String(parcel.price || ''),
      adminFee: String(parcel.adminFee ?? PARCEL_ADMIN_FEE),
      status: parcel.status,
      isManualPrice: true,
      imageUrl: parcel.imageUrl || '',
      items: (parcel.items || []).map((item) => ({ variantId: item.variantId, quantity: Number(item.quantity || 1) })),
    });
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.items.length || form.items.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) || (form.isManualPrice && !form.price)) { setNotice('Lengkapi nama, isi parsel, dan harga jual yang valid.'); return; }
    if (!await confirmAction(`Yakin ingin ${editingId ? 'memperbarui parsel ini' : 'menambahkan parsel baru'}?`)) return;

    const payload = {
      name: form.name,
      description: form.description,
      type: form.type === 'Custom' ? 'CUSTOM' : 'STANDARD',
      isActive: form.status === 'Aktif',
      isManualPrice: form.isManualPrice,
      price: form.isManualPrice ? Number(form.price) : autoPrice,
      adminFee: PARCEL_ADMIN_FEE,
      imageUrl: form.imageUrl || null,
      items: form.items,
    };

    setSaving(true);
    try {
      const response = await apiFetch(editingId ? `/parcels/${editingId}` : '/parcels', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Parcel gagal disimpan');
      setNotice(editingId ? 'Parsel berhasil diperbarui di database.' : 'Parsel berhasil ditambahkan ke database.');
      resetForm();
      await loadParcels();
    } catch (error) {
      setNotice(error.message || 'Parcel gagal disimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell active="Parsel" className="admin-crud-shell">
        <header className="admin-header">
          <div>
              <p className="eyebrow light">Kelola paket produk</p>
            <h1>Kelola Parsel</h1>
              <p className="admin-subtitle">Buat paket parsel, atur isi dan harga jual, lalu kelola semuanya dari satu daftar.</p>
          </div>
            <div className="parcel-header-actions">
              <Link to="/parsel" className="btn btn-secondary">Lihat halaman parsel</Link>
              <button type="button" className="btn btn-primary" onClick={addParcel}><Plus size={17} /> Tambah parsel</button>
            </div>
          </header>

        {notice && (
          <div className="crud-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button>
          </div>
        )}

        <section className="parcel-admin-summary" aria-label="Ringkasan paket">
          <article><span>Total paket</span><strong>{parcels.length}</strong><small>Paket parsel tersimpan</small></article>
          <article><span>Paket aktif</span><strong>{parcels.filter((parcel) => parcel.status === 'Aktif').length}</strong><small>Tampil di daftar paket</small></article>
          <article><span>Paket draft</span><strong>{parcels.filter((parcel) => parcel.status !== 'Aktif').length}</strong><small>Belum ditampilkan ke publik</small></article>
        </section>

        {incompleteParcels.length > 0 && (
          <aside className="parcel-incomplete-notice" aria-label="Paket belum lengkap">
            <span className="parcel-incomplete-icon"><AlertCircle size={19} /></span>
            <div>
              <strong>{incompleteParcels.length} paket belum memiliki isi barang</strong>
              <p>Lengkapi barang di dalam paket agar peserta tahu apa yang akan diterima.</p>
            </div>
            <button type="button" onClick={() => editParcel(incompleteParcels[0])}>Lengkapi paket <Pencil size={14} /></button>
          </aside>
        )}

        <section className="crud-layout parcel-admin-layout">
          {formOpen && <div className="parcel-form-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) resetForm(); }}>
          <section className="parcel-form-modal" role="dialog" aria-modal="true" aria-labelledby="parcel-form-title">
          <form className="crud-form-panel parcel-form-panel" onSubmit={submitForm}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Perbarui paket' : 'Paket baru'}</span>
                <h2 id="parcel-form-title">{editingId ? 'Edit parsel' : 'Buat parsel baru'}</h2>
              </div>
              <button type="button" className="parcel-form-close" onClick={resetForm} disabled={saving} aria-label="Tutup form"><X size={19} /></button>
            </div>
            <p className="parcel-form-intro">Lengkapi informasi, pilih barang, lalu cek ringkasan harga sebelum menyimpan.</p>
            <div className="parcel-form-body">
              <div className="parcel-form-main">
                <section className="parcel-form-section">
                  <div className="parcel-form-section-heading"><span>1</span><div><h3>Informasi paket</h3><p>Nama dan keterangan yang mudah dikenali.</p></div></div>
                  <label>Nama parsel <b className="required-mark">*</b><input name="name" value={form.name} onChange={updateField} placeholder="Contoh: Parcel Keluarga" autoFocus /></label>
                  <label>Deskripsi <span className="parcel-optional-label">Opsional</span><textarea name="description" rows="2" value={form.description} onChange={updateField} placeholder="Jelaskan paket ini secara singkat." /></label>
                  <CatalogImageField value={form.imageUrl || ''} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} group="parcels" label="Foto paket" />
                  <div className="form-two-columns">
                    <label>Tipe paket<select name="type" value={form.type} onChange={updateField}><option>Standard</option><option>Custom</option></select></label>
                    <label>Status<select name="status" value={form.status} onChange={updateField}><option>Aktif</option><option>Draft</option></select><small>Draft tidak ditampilkan kepada pelanggan.</small></label>
                  </div>
                </section>

                <section className="parcel-form-section parcel-product-section">
                  <div className="parcel-form-section-heading"><span>2</span><div><h3>Isi paket</h3><p>Pilih produk dan atur jumlah barang.</p></div><span className="parcel-selected-count">{form.items.length} dipilih</span></div>
                  <div className="parcel-product-search"><Search size={17} aria-hidden="true" /><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama barang atau SKU..." /><span>{filteredProducts.length} barang</span></div>
                  <div className="parcel-product-list">
                    {filteredProducts.map((product) => {
                      const selectedItem = form.items.find((item) => item.variantId === product.variantId);
                      return (
                        <article key={product.variantId} className={`parcel-product-row${selectedItem ? ' selected' : ''}`}>
                          <button type="button" className={`parcel-product-select${selectedItem ? ' is-selected' : ''}`} onClick={() => toggleItem(product.variantId)} aria-label={`${selectedItem ? 'Hapus' : 'Pilih'} ${product.name}`}>
                            {selectedItem && <Check size={14} strokeWidth={3} />}
                          </button>
                          <div className="parcel-product-info"><strong>{product.name}</strong><span>Modal {money(product.purchasePrice)} <i>·</i> Harga satuan {money(product.price)} <i>·</i> Stok {product.stock}</span></div>
                          {selectedItem
                            ? <div className="parcel-quantity-control" aria-label={`Jumlah ${product.name}`}><button type="button" onClick={() => changeItemQuantity(product.variantId, -1)} disabled={Number(selectedItem.quantity) <= 1} aria-label={`Kurangi ${product.name}`}><Minus size={13} /></button><span>{selectedItem.quantity || 1}</span><button type="button" onClick={() => changeItemQuantity(product.variantId, 1)} aria-label={`Tambah ${product.name}`}><Plus size={13} /></button></div>
                            : <button type="button" className="parcel-add-product" onClick={() => toggleItem(product.variantId)}><Plus size={14} /> Tambah</button>}
                        </article>
                      );
                    })}
                    {!filteredProducts.length && <div className="parcel-product-empty">{productsLoading ? 'Memuat daftar barang...' : products.length ? 'Barang tidak ditemukan. Coba kata pencarian lain.' : 'Belum ada barang yang dapat dimasukkan ke paket.'}</div>}
                  </div>
                  {!form.items.length && <p className="parcel-selection-help">Pilih minimal satu barang untuk membuat paket.</p>}
                </section>
              </div>

              <aside className="parcel-price-panel" aria-label="Ringkasan harga paket">
                <div className="parcel-form-section-heading"><span>3</span><div><h3>Harga & ringkasan</h3><p>Periksa perhitungan paket.</p></div></div>
                <div className="parcel-price-mode" role="group" aria-label="Cara menentukan harga">
                  <button type="button" className={!form.isManualPrice ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, isManualPrice: false }))}><strong>Otomatis</strong><small>Ikuti harga satuan</small></button>
                  <button type="button" className={form.isManualPrice ? 'active' : ''} onClick={() => setForm((current) => ({ ...current, isManualPrice: true, price: current.price || String(autoPrice) }))}><strong>Atur sendiri</strong><small>Tentukan harga jual</small></button>
                </div>
                {form.isManualPrice
                  ? <label>Harga jual paket <b className="required-mark">*</b><CurrencyInput name="price" value={form.price} onValueChange={(value) => setForm((current) => ({ ...current, price: value }))} placeholder="Contoh: Rp 1.100.000" /><small>Harga jual untuk satu paket, tidak termasuk biaya admin.</small></label>
                  : <div className="parcel-auto-price">Harga jual dihitung dari jumlah dan harga satuan barang.</div>}
                <div className="parcel-price-breakdown" aria-live="polite">
                  <div><span>Total modal barang</span><strong>{money(basePrice)}</strong></div>
                  <div><span>Harga jual paket</span><strong>{money(sellingPrice)}</strong></div>
                  <div className={grossMargin < 0 ? 'is-loss' : 'is-profit'}><span>Perkiraan margin</span><strong>{money(grossMargin)}</strong></div>
                  <div><span>Biaya admin tetap</span><strong>{money(PARCEL_ADMIN_FEE)}</strong></div>
                  <div className="parcel-price-total"><span>Total target peserta</span><strong>{money(annualTarget)}</strong></div>
                </div>
                <p className="parcel-price-note">Target tabungan peserta = harga jual paket + biaya admin Rp50.000.</p>
              </aside>
            </div>
            <div className="parcel-form-actions">
              <button className="btn btn-secondary" type="button" onClick={resetForm} disabled={saving}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Simpan parsel'}</button>
            </div>
          </form>
          </section>
          </div>}

          <section className="crud-table-panel">
            <div className="participant-table-heading">
              <div>
                <span className="panel-kicker">Daftar paket</span>
                <h2>{visibleParcels.length} paket parsel</h2>
              </div>
              <span className="participant-table-total">{parcels.length} tersimpan</span>
            </div>
            <BulkTableActions selectedCount={selectedIds.length} totalCount={visibleParcels.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? visibleParcels.map((parcel) => parcel.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="crud-toolbar parcel-list-toolbar">
              <label className="crud-search">
                <Search className="w-4 h-4 text-emerald-600 inline mr-1" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, deskripsi..." />
              </label>
            <label className="parcel-status-filter">Tampilkan
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">Semua paket</option>
                <option value="ACTIVE">Aktif</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
            </div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Nama paket</th>
                    <th>Isi</th>
                    <th>Harga jual</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleParcels.map((parcel) => (
                    <tr key={parcel.id}>
                      <td className="bulk-check-column"><BulkRowCheckbox checked={selectedIds.includes(parcel.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, parcel.id])] : current.filter((id) => id !== parcel.id))} label={`Pilih ${parcel.name}`} /></td>
                      <td>
                        <div className="parcel-name-cell">
                          <span className="parcel-table-thumb">
                            {parcel.imageUrl
                              ? <img src={parcel.imageUrl} alt="" loading="lazy" />
                              : <Gift size={19} strokeWidth={1.8} aria-hidden="true" />}
                          </span>
                          <span className="parcel-name-copy">
                            <strong>{parcel.name}</strong>
                            {parcel.description && <small>{parcel.description}</small>}
                          </span>
                        </div>
                      </td>
                      <td>{(parcel.itemCount || parcel.items?.length || 0) > 0
                        ? <span className="parcel-item-count"><Gift size={13} /> {parcel.itemCount || parcel.items.length} barang</span>
                        : <span className="parcel-no-items">Isi belum lengkap</span>}</td>
                      <td>
                        <div className="parcel-price-cell">
                          <strong>{money(parcel.price)}</strong>
                          <small>Target peserta <b>{money(Number(parcel.price) + PARCEL_ADMIN_FEE)}</b></small>
                        </div>
                      </td>
                      <td><span className={`status-chip parcel-status-chip ${parcel.status === 'Aktif' ? 'good' : 'neutral'}`}>{parcel.status}</span></td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="parcel-row-edit" onClick={() => editParcel(parcel)} title={(parcel.itemCount || parcel.items?.length || 0) > 0 ? 'Edit paket' : 'Lengkapi isi paket'} aria-label={`${(parcel.itemCount || parcel.items?.length || 0) > 0 ? 'Edit paket' : 'Lengkapi isi paket'} ${parcel.name}`}><Pencil size={15} /></button>
                          <button type="button" onClick={async () => {
                            if (deletingId) return;
                            if (!await confirmAction(`Hapus parsel "${parcel.name}"?`)) return;
                            setDeletingId(parcel.id);
                            try {
                              const response = await apiFetch(`/parcels/${parcel.id}`, { method: 'DELETE' });
                              const data = await response.json();
                              if (!response.ok || !data.success) throw new Error(data.message || 'Hapus parcel gagal');
                              setNotice('Parsel berhasil dihapus dari database.');
                              await loadParcels();
                            } catch (error) {
                              setNotice(error.message || 'Hapus parcel gagal');
                            } finally {
                              setDeletingId(null);
                            }
                          }} disabled={deletingId === parcel.id} className="parcel-row-delete" title="Hapus paket" aria-label={`Hapus ${parcel.name}`}>{deletingId === parcel.id ? <span className="parcel-delete-loading">...</span> : <Trash2 size={15} />}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleParcels.length === 0 && <div className="table-empty">{search ? 'Parsel tidak ditemukan. Coba ubah kata pencarian.' : 'Belum ada parsel. Klik “Tambah parsel” untuk membuat paket pertama.'}</div>}
            </div>
          </section>
        </section>

        <footer className="admin-footer">Glosir Owner Workspace <span>Data parsel sinkron dari database</span></footer>
      </AdminShell>
  );
}
