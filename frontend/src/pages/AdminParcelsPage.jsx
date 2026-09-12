import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { Link } from 'react-router-dom';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', code: '', type: 'Standard', price: '', originalPrice: '', status: 'Aktif', isManualPrice: false, items: [] };

export default function AdminParcelsPage() {
  const [parcels, setParcels] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const loadParcels = async () => {
    try {
      const response = await apiFetch('/parcels');
      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.parcels)) {
        setParcels(data.parcels.map((parcel) => ({
          ...parcel,
          code: parcel.slug || parcel.name,
          type: parcel.type === 'CUSTOM' ? 'Custom' : 'Standard',
          status: parcel.isActive ? 'Aktif' : 'Draft',
          originalPrice: parcel.price,
          discountPercent: 0,
        })));
      }
    } catch (error) {
      setParcels([]);
      setNotice('Gagal memuat data parcel dari database.');
    }
  };

  useEffect(() => {
    loadParcels();
    apiFetch('/products?all=true').then((response) => response.json()).then((data) => setProducts(data.products || [])).catch(() => setProducts([]));
  }, []);

  const toggleItem = (variantId) => setForm((current) => ({ ...current, items: current.items.some((item) => item.variantId === variantId) ? current.items.filter((item) => item.variantId !== variantId) : [...current.items, { variantId, quantity: 1 }] }));
  const updateItemQuantity = (variantId, quantity) => setForm((current) => ({ ...current, items: current.items.map((item) => item.variantId === variantId ? { ...item, quantity: quantity === '' ? '' : Number(quantity) } : item) }));
  const autoPrice = form.items.reduce((sum, item) => sum + Number(products.find((product) => product.variantId === item.variantId)?.price || 0) * Number(item.quantity || 0), 0);
  const filteredProducts = products.filter((product) => `${product.name} ${product.sku} ${product.barcode || ''}`.toLowerCase().includes(productSearch.toLowerCase().trim()));

  const visibleParcels = parcels.filter((parcel) => `${parcel.name} ${parcel.code} ${parcel.type}`.toLowerCase().includes(search.toLowerCase()));
  const allSelected = visibleParcels.length > 0 && visibleParcels.every((parcel) => selectedIds.includes(parcel.id));
  const deleteSelected = async () => {
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} parsel terpilih?`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/parcels/${id}`, { method: 'DELETE' }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const count = results.filter((result) => result.status === 'fulfilled').length;
    setSelectedIds([]); setBulkDeleting(false); await loadParcels();
    setNotice(`${count} parsel berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
  };
  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.items.length || form.items.some((item) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) || (form.isManualPrice && !form.price)) { setNotice('Lengkapi nama, kode, isi parsel, dan jumlah barang minimal 1.'); return; }
    if (!await confirmAction(`Yakin ingin ${editingId ? 'memperbarui parsel ini' : 'menambahkan parsel baru'}?`)) return;

    const payload = {
      name: form.name,
      description: form.code,
      type: form.type === 'Custom' ? 'CUSTOM' : 'STANDARD',
      isActive: form.status === 'Aktif',
      isManualPrice: form.isManualPrice,
      price: form.isManualPrice ? Number(form.price) : autoPrice,
      items: form.items,
    };

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
    }
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Parsel" />
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Parcel management</p>
            <h1>Kelola Parsel</h1>
            <p className="admin-subtitle">Atur paket keluarga, premium, dan kebutuhan acara dengan harga diskon.</p>
          </div>
          <Link to="/parsel" className="btn btn-secondary">Lihat halaman parsel</Link>
        </header>

        {notice && (
          <div className="crud-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button>
          </div>
        )}

        <section className="crud-layout">
          <form className="crud-form-panel" onSubmit={submitForm}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Edit parsel' : 'Parsel baru'}</span>
                <h2>{editingId ? 'Perbarui informasi' : 'Tambah parsel'}</h2>
              </div>
              {editingId && <button type="button" className="text-button" onClick={resetForm}>Batal</button>}
            </div>
            <label>Nama parsel<input name="name" value={form.name} onChange={updateField} placeholder="Contoh: Parcel Keluarga" /></label>
            <label>Kode parsel<input name="code" value={form.code} onChange={updateField} placeholder="PRC-KEL-001" /></label>
            <div className="form-two-columns">
              <label>Tipe
                <select name="type" value={form.type} onChange={updateField}>
                  <option>Standard</option>
                  <option>Custom</option>
                </select>
              </label>
              <label>Status
                <select name="status" value={form.status} onChange={updateField}>
                  <option>Aktif</option>
                  <option>Draft</option>
                </select>
              </label>
            </div>
            <fieldset className="parcel-item-picker"><legend>Isi parsel <small>{form.items.length} barang dipilih</small></legend><div className="picker-toolbar"><span>Pilih barang yang masuk ke dalam paket</span><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Cari nama, SKU, barcode..." /></div><div className="parcel-item-grid">{filteredProducts.map((product) => { const selectedItem = form.items.find((item) => item.variantId === product.variantId); return <div key={product.variantId} className={`parcel-item-option${selectedItem ? ' selected' : ''}`}><input type="checkbox" checked={Boolean(selectedItem)} onChange={() => toggleItem(product.variantId)} /><span><strong>{product.name}</strong><small>Rp {Number(product.price).toLocaleString('id-ID')} · stok {product.stock}</small></span>{selectedItem && <input type="number" min="1" value={selectedItem.quantity} onClick={(event) => event.stopPropagation()} onChange={(event) => updateItemQuantity(product.variantId, event.target.value)} />}</div>; })}{!filteredProducts.length && <div className="picker-empty">Barang tidak ditemukan.</div>}</div></fieldset>
            <label className="parcel-manual-price"><input type="checkbox" checked={form.isManualPrice} onChange={(event) => setForm((current) => ({ ...current, isManualPrice: event.target.checked }))} /> Harga manual / nego</label>
            {!form.isManualPrice && <div className="parcel-auto-price">Harga otomatis dari isi: <strong>Rp {autoPrice.toLocaleString('id-ID')}</strong></div>}
            <div className="form-two-columns">
              <label>Harga Jual (Promo)
                <CurrencyInput name="price" value={form.price} onValueChange={(value) => setForm((current) => ({ ...current, price: value }))} placeholder="Rp 120.000" />
              </label>
              <label>Harga Normal / Coret (Opsional)
                <CurrencyInput name="originalPrice" value={form.originalPrice || ''} onValueChange={(value) => setForm((current) => ({ ...current, originalPrice: value }))} placeholder="Rp 150.000" />
              </label>
            </div>
            <button className="btn btn-primary full" type="submit">{editingId ? 'Simpan perubahan' : 'Tambah parsel'}</button>
          </form>

          <section className="crud-table-panel">
            <BulkTableActions selectedCount={selectedIds.length} totalCount={visibleParcels.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? visibleParcels.map((parcel) => parcel.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="crud-toolbar">
              <label className="crud-search">
                <span>cari</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau kode..." />
              </label>
            </div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Nama parsel</th>
                    <th>Tipe</th>
                    <th>Harga</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleParcels.map((parcel) => (
                    <tr key={parcel.id}>
                      <td className="bulk-check-column"><BulkRowCheckbox checked={selectedIds.includes(parcel.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, parcel.id])] : current.filter((id) => id !== parcel.id))} label={`Pilih ${parcel.name}`} /></td>
                      <td><strong>{parcel.name}</strong><small>{parcel.code}</small></td>
                      <td>{parcel.type}</td>
                      <td>
                        <strong>Rp {parcel.price.toLocaleString('id-ID')}</strong>
                        {parcel.originalPrice && parcel.originalPrice > parcel.price && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <del style={{ color: '#8c867e', fontSize: '0.78rem' }}>Rp {parcel.originalPrice.toLocaleString('id-ID')}</del>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c0392b', background: '#fdedec', padding: '1px 6px', borderRadius: '4px' }}>
                              -{parcel.discountPercent || Math.round(((parcel.originalPrice - parcel.price) / parcel.originalPrice) * 100)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td><span className="status-chip good">{parcel.status}</span></td>
                      <td>
                        <div className="row-actions">
                          <button onClick={() => { setEditingId(parcel.id); setForm({ ...parcel, items: parcel.items || [], isManualPrice: true }); }}>Edit</button>
                          <button onClick={async () => {
                            if (!await confirmAction(`Hapus parsel "${parcel.name}"?`)) return;
                            try {
                              const response = await apiFetch(`/parcels/${parcel.id}`, { method: 'DELETE' });
                              const data = await response.json();
                              if (!response.ok || !data.success) throw new Error(data.message || 'Hapus parcel gagal');
                              setNotice('Parsel berhasil dihapus dari database.');
                              await loadParcels();
                            } catch (error) {
                              setNotice(error.message || 'Hapus parcel gagal');
                            }
                          }}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleParcels.length === 0 && <div className="table-empty">Parsel tidak ditemukan.</div>}
            </div>
          </section>
        </section>

        <footer className="admin-footer">Glosir Owner Workspace <span>Data parsel sinkron dari database</span></footer>
      </main>
    </div>
  );
}
