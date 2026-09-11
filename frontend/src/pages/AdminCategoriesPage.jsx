import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', description: '' };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/categories');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Kategori gagal dimuat.');
      setCategories(data.categories);
    } catch (error) {
      setNotice(error.message || 'Kategori gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
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
    setForm({ name: category.name, description: category.description });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/categories/${id}`, { method: 'DELETE' }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const count = results.filter((result) => result.status === 'fulfilled').length;
    setSelectedIds([]); setBulkDeleting(false); await loadCategories();
    setNotice(`${count} kategori berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Kategori" />
      <main className="admin-main">
        <header className="admin-header">
          <div><p className="eyebrow light">Catalog structure</p><h1>Kelola Kategori</h1><p className="admin-subtitle">Atur kelompok produk agar katalog tetap rapi.</p></div>
          <div className="admin-header-actions"><span className={`database-status ${loading ? 'loading' : 'ready'}`}><i /> {loading ? 'Memuat data' : 'Terhubung ke API'}</span></div>
        </header>
        {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup notifikasi">x</button></div>}
        <section className="crud-layout">
          <form className="crud-form-panel" onSubmit={submitForm}>
            <div className="panel-heading"><div><span className="panel-kicker">{editingId ? 'Edit kategori' : 'Kategori baru'}</span><h2>{editingId ? 'Perbarui informasi' : 'Tambah kategori'}</h2></div>{editingId && <button type="button" className="text-button" onClick={resetForm}>Batal</button>}</div>
            <label>Nama kategori<input name="name" value={form.name} onChange={updateField} placeholder="Contoh: Makanan Ringan" /></label>
            <label>Deskripsi<textarea name="description" value={form.description} onChange={updateField} placeholder="Jelaskan isi kategori secara singkat" rows="5" /></label>
            <button className="btn btn-primary full" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah kategori'}</button>
          </form>
          <section className="crud-table-panel">
            <div className="crud-toolbar"><label className="crud-search"><span>cari</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kategori..." /></label></div>
            <BulkTableActions selectedCount={selectedIds.length} totalCount={visibleCategories.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? visibleCategories.map((item) => item.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="product-table-wrap"><table className="product-table"><thead><tr><th className="bulk-check-column">Pilih</th><th>Kategori</th><th>Slug</th><th>Produk</th><th>Aksi</th></tr></thead><tbody>{visibleCategories.map((category) => <tr key={category.id}><td className="bulk-check-column"><BulkRowCheckbox checked={selectedIds.includes(category.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, category.id])] : current.filter((id) => id !== category.id))} label={`Pilih ${category.name}`} /></td><td><strong>{category.name}</strong><small>{category.description || 'Tanpa deskripsi'}</small></td><td>{category.slug}</td><td>{category.productCount}</td><td><div className="row-actions"><button onClick={() => editCategory(category)}>Edit</button><button onClick={() => deleteCategory(category.id)}>Hapus</button></div></td></tr>)}</tbody></table>{loading && <div className="table-empty">Memuat kategori...</div>}{!loading && visibleCategories.length === 0 && <div className="table-empty">Kategori tidak ditemukan.</div>}</div>
          </section>
        </section>
        <footer className="admin-footer">Glosir Owner Workspace <span>Data kategori tersimpan di Supabase</span></footer>
      </main>
    </div>
  );
}
