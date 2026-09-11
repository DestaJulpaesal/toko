import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyForm = {
  type: 'TERMS',
  title: '',
  content: '',
  sortOrder: 0,
  isPublished: true,
};

const typeOptions = [
  { value: 'TERMS', label: 'Syarat & Ketentuan' },
  { value: 'PRIVACY', label: 'Kebijakan Privasi' },
  { value: 'CONTACT', label: 'Contact Us' },
  { value: 'FAQ', label: 'Pusat Bantuan / FAQ' },
  { value: 'HELP', label: 'Pusat Bantuan' },
  { value: 'TESTIMONIAL', label: 'Testimoni / Ulasan' },
];

const typeLabelMap = Object.fromEntries(typeOptions.map((option) => [option.value, option.label]));

export default function AdminContentPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/site-content');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Konten gagal dimuat.');
      setItems(data.items || []);
    } catch (error) {
      setNotice(error.message || 'Konten gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submitForm = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.content.trim()) {
      setNotice('Judul dan isi konten wajib diisi.');
      return;
    }

    if (!await confirmAction(`Yakin ingin ${editingId ? 'memperbarui konten publik ini' : 'menambahkan konten publik baru'}?`)) return;

    setSaving(true);
    try {
      const payload = {
        type: form.type,
        title: form.title,
        content: form.content,
        sortOrder: Number(form.sortOrder) || 0,
        isPublished: form.isPublished,
      };

      const response = await apiFetch(editingId ? `/site-content/${editingId}` : '/site-content', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Konten gagal disimpan.');

      await loadItems();
      setNotice(editingId ? 'Konten berhasil diperbarui.' : 'Konten berhasil ditambahkan.');
      resetForm();
    } catch (error) {
      setNotice(error.message || 'Konten gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const editItem = (item) => {
    setEditingId(item.id);
    setForm({
      type: item.type,
      title: item.title,
      content: item.content,
      sortOrder: item.sortOrder,
      isPublished: item.isPublished,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteItem = async (id) => {
    const item = items.find((content) => content.id === id);
    if (!await confirmAction(`Hapus konten publik "${item?.title || 'ini'}"?`)) return;

    try {
      const response = await apiFetch(`/site-content/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Konten gagal dihapus.');
      await loadItems();
      setNotice('Konten berhasil dihapus.');
      if (editingId === id) resetForm();
    } catch (error) {
      setNotice(error.message || 'Konten gagal dihapus.');
    }
  };

  const visibleItems = items.filter((item) => {
    const searchable = `${item.title} ${item.type} ${item.content}`.toLowerCase();
    return searchable.includes(search.toLowerCase());
  });
  const allSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.includes(item.id));
  const deleteSelected = async () => {
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} konten terpilih?`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/site-content/${id}`, { method: 'DELETE' }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const count = results.filter((result) => result.status === 'fulfilled').length;
    setSelectedIds([]); setBulkDeleting(false); await loadItems();
    setNotice(`${count} konten berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Konten Publik" />
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Public content</p>
            <h1>Kelola Halaman Publik</h1>
            <p className="admin-subtitle">Atur Syarat & Ketentuan, Kebijakan Privasi, FAQ, Contact Us, dan Testimoni.</p>
          </div>
          <span className={`database-status ${loading ? 'loading' : 'ready'}`}><i /> {loading ? 'Memuat data' : 'Terhubung ke API'}</span>
        </header>

        {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup notifikasi">x</button></div>}

        <section className="crud-layout">
          <form className="crud-form-panel" onSubmit={submitForm}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Edit konten' : 'Konten baru'}</span>
                <h2>{editingId ? 'Perbarui halaman publik' : 'Tambah halaman publik'}</h2>
              </div>
              {editingId && <button type="button" className="text-button" onClick={resetForm}>Batal</button>}
            </div>

            <label>
              Tipe halaman
              <select name="type" value={form.type} onChange={updateField}>
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              Judul
              <input name="title" value={form.title} onChange={updateField} placeholder="Contoh: Syarat & Ketentuan" />
            </label>

            <label>
              Isi konten
              <textarea name="content" value={form.content} onChange={updateField} rows="8" placeholder="Tulis isi halaman. Untuk FAQ, gunakan format Q: ... dan A: ..." />
            </label>

            <div className="form-two-columns">
              <label>
                Urutan tampilan
                <input name="sortOrder" value={form.sortOrder} onChange={updateField} type="number" min="0" />
              </label>
              <label className="checkbox-label">
                <span>Status publik</span>
                <input name="isPublished" type="checkbox" checked={form.isPublished} onChange={updateField} />
              </label>
            </div>

            <button className="btn btn-primary full" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah konten'}</button>
          </form>

          <section className="crud-table-panel">
            <div className="crud-toolbar">
              <label className="crud-search">
                <span>cari</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari judul atau isi..." />
              </label>
            </div>

            <BulkTableActions selectedCount={selectedIds.length} totalCount={visibleItems.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? visibleItems.map((item) => item.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                          <th className="bulk-check-column">Pilih</th><th>Judul</th>
                    <th>Tipe</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={item.id}>
                      <td className="bulk-check-column"><BulkRowCheckbox checked={selectedIds.includes(item.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} label={`Pilih ${item.title}`} /></td>
                      <td>
                        <strong>{item.title}</strong>
                        <small>{item.content.slice(0, 60)}{item.content.length > 60 ? '...' : ''}</small>
                      </td>
                      <td>{typeLabelMap[item.type] || item.type}</td>
                      <td>{item.isPublished ? 'Publik' : 'Draft'}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" onClick={() => editItem(item)}>Edit</button>
                          <button type="button" onClick={() => deleteItem(item.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && visibleItems.length === 0 && <div className="table-empty">Konten tidak ditemukan.</div>}
              {loading && <div className="table-empty">Memuat konten publik...</div>}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
