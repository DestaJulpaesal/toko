import { useEffect, useState } from 'react';
import { FolderTree, Image as ImageIcon, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import CatalogImageField from '../components/CatalogImageField';
import ModalForm from '../components/ModalForm';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', description: '', imageUrl: '' };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    setLoadError('');
    setNotice('');
    try {
      const response = await apiFetch('/categories');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Kategori gagal dimuat.');
      setCategories(data.categories);
    } catch (error) {
      const message = error.message || 'Kategori gagal dimuat.';
      setLoadError(message);
      setNotice(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormModalOpen(false);
  };

  const closeFormModal = () => {
    if (!saving) resetForm();
  };

  const addCategory = () => {
    setNotice('');
    setForm(emptyForm);
    setEditingId(null);
    setFormModalOpen(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setNotice('Nama kategori wajib diisi.');
      return;
    }

    if (!await confirmAction(`Yakin ingin ${editingId ? 'memperbarui kategori ini' : 'menambahkan kategori baru'}?`)) return;

    setSaving(true);
    try {
      const response = await apiFetch(editingId ? `/categories/${editingId}` : '/categories', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Kategori gagal disimpan.');
      await loadCategories();
      setNotice(editingId ? 'Kategori berhasil diperbarui.' : 'Kategori berhasil ditambahkan.');
      resetForm();
    } catch (error) {
      setNotice(error.message || 'Kategori gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category) => {
    setEditingId(category.id);
    setForm({ name: category.name, description: category.description, imageUrl: category.imageUrl || '' });
    setNotice('');
    setFormModalOpen(true);
  };

  const deleteCategory = async (id) => {
    const category = categories.find((item) => item.id === id);
    if (!await confirmAction(`Hapus kategori "${category?.name || 'ini'}"? Data kategori yang masih dipakai produk mungkin tidak dapat dihapus.`)) return;

    try {
      const response = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Kategori gagal dihapus.');
      await loadCategories();
      setNotice('Kategori berhasil dihapus.');
      if (editingId === id) resetForm();
    } catch (error) {
      setNotice(error.message || 'Kategori gagal dihapus.');
    }
  };

  const visibleCategories = categories.filter((category) => `${category.name} ${category.slug} ${category.description}`.toLowerCase().includes(search.toLowerCase()));
  const allSelected = visibleCategories.length > 0 && visibleCategories.every((item) => selectedIds.includes(item.id));
  const deleteSelected = async () => {
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} kategori terpilih?`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/categories/${id}`, { method: 'DELETE', silentNotify: true }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const count = results.filter((result) => result.status === 'fulfilled').length;
    setSelectedIds([]); setBulkDeleting(false); await loadCategories();
    setNotice(`${count} kategori berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
    showNotice(`${count} kategori berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`, count < results.length ? 'error' : 'success');
  };

  return (
    <AdminShell active="Kategori" className="admin-crud-shell">
        <header className="admin-header category-page-header">
          <div><p className="eyebrow light">Struktur katalog</p><h1>Kelola Kategori</h1><p className="admin-subtitle">Atur kelompok produk, gambar, dan struktur katalog toko.</p></div>
          <div className="category-header-actions">
            <span className={`database-status ${loading ? 'loading' : loadError ? 'error' : 'ready'}`}><i /> {loading ? 'Memuat kategori' : loadError ? 'Gagal terhubung' : 'Terhubung ke API'}</span>
            <button type="button" className="category-header-button" onClick={loadCategories} disabled={loading} title="Muat ulang kategori">
              <RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> {loading ? 'Memuat...' : 'Muat ulang'}
            </button>
            <button type="button" className="btn btn-primary category-add-button" onClick={addCategory}>
              <Plus size={16} /> Tambah kategori
            </button>
          </div>
        </header>
        <section className="category-summary-grid" aria-label="Ringkasan kategori">
          <article className="category-summary-card"><span>Total kategori</span><strong>{categories.length.toLocaleString('id-ID')}</strong><small>Kelompok produk di katalog</small></article>
          <article className="category-summary-card"><span>Produk terkelompok</span><strong>{categories.reduce((total, category) => total + Number(category.productCount || 0), 0).toLocaleString('id-ID')}</strong><small>Total produk di seluruh kategori</small></article>
          <article className="category-summary-card"><span>Kategori dengan gambar</span><strong>{categories.filter((category) => Boolean(category.imageUrl)).length.toLocaleString('id-ID')}</strong><small>Gambar untuk membantu katalog tampil menarik</small></article>
        </section>
        {loadError && (
          <div className="customer-load-error" role="alert">
            <div><strong>Daftar kategori belum berhasil dimuat</strong><span>{loadError}</span></div>
            <button type="button" onClick={loadCategories} disabled={loading}>Coba lagi</button>
          </div>
        )}
        {notice && !formModalOpen && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button></div>}
        <ModalForm
          isOpen={formModalOpen}
          onClose={closeFormModal}
          title={editingId ? 'Edit kategori' : 'Tambah kategori'}
          subtitle={editingId ? 'Perbarui informasi dan tampilan kategori katalog.' : 'Buat kelompok produk baru agar katalog toko lebih rapi.'}
          kicker={editingId ? 'Perbarui katalog' : 'Kategori baru'}
          maxWidth="900px"
          cardClassName="category-editor-modal"
        >
          {notice && (
            <div className="crud-notice" role="status">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button>
            </div>
          )}
          <form className="category-editor-form" onSubmit={submitForm}>
            <div className="category-editor-fields">
              <label>Nama kategori<input name="name" required autoFocus value={form.name} onChange={updateField} placeholder="Contoh: Makanan Ringan" /></label>
              <label>Deskripsi<textarea name="description" value={form.description} onChange={updateField} placeholder="Jelaskan isi kategori secara singkat" rows="5" /></label>
            </div>
            <CatalogImageField value={form.imageUrl} onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))} group="categories" label="Gambar kategori" />
            <div className="category-editor-actions">
              <button type="button" className="btn btn-secondary" onClick={closeFormModal} disabled={saving}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah kategori'}</button>
            </div>
          </form>
        </ModalForm>
        <section className="crud-layout-full">
          <section className="crud-table-panel category-table-panel">
            <div className="category-list-heading">
              <div><span className="panel-kicker">Direktori katalog</span><h2>Daftar kategori</h2><p>Cari kategori, lihat jumlah produk, lalu kelola informasinya.</p></div>
              <span className="category-result-count">{visibleCategories.length} dari {categories.length} kategori</span>
            </div>
            <div className="crud-toolbar"><label className="crud-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, slug, atau deskripsi kategori..." /></label></div>
            <BulkTableActions selectedCount={selectedIds.length} totalCount={visibleCategories.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? visibleCategories.map((item) => item.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="product-table-wrap category-table-wrap"><table className="product-table"><thead><tr><th className="bulk-check-column">Pilih</th><th>Gambar</th><th>Kategori</th><th>Slug</th><th>Produk</th><th>Aksi</th></tr></thead><tbody>{visibleCategories.map((category) => <tr key={category.id}><td className="bulk-check-column"><BulkRowCheckbox checked={selectedIds.includes(category.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, category.id])] : current.filter((id) => id !== category.id))} label={`Pilih ${category.name}`} /></td><td>{category.imageUrl ? <img className="category-table-image" src={category.imageUrl} alt="" loading="lazy" /> : <span className="category-table-image-empty" aria-label="Belum ada gambar"><ImageIcon size={16} /></span>}</td><td><strong>{category.name}</strong><small>{category.description || 'Tanpa deskripsi'}</small></td><td><span className="category-slug">{category.slug}</span></td><td><span className="category-product-count"><FolderTree size={14} /> {Number(category.productCount || 0)}</span></td><td><div className="row-actions category-row-actions"><button type="button" className="category-action-button" onClick={() => editCategory(category)} title="Edit kategori" aria-label={`Edit kategori ${category.name}`}><Pencil size={14} /><span>Edit</span></button><button type="button" className="category-action-button category-action-danger" onClick={() => deleteCategory(category.id)} title="Hapus kategori" aria-label={`Hapus kategori ${category.name}`}><Trash2 size={14} /><span>Hapus</span></button></div></td></tr>)}</tbody></table>{loading && <div className="table-empty">Memuat kategori...</div>}{!loading && visibleCategories.length === 0 && <div className="table-empty">{search ? 'Tidak ada kategori yang cocok dengan pencarian.' : 'Belum ada kategori. Pilih “Tambah kategori” untuk mulai menyusun katalog.'}</div>}</div>
          </section>
        </section>
        <footer className="admin-footer">Glosir Owner Workspace <span>Data kategori tersimpan di Supabase</span></footer>
      </AdminShell>
  );
}
