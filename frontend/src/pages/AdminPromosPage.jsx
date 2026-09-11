import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { Link } from 'react-router-dom';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', code: '', type: 'Persentase', value: '', status: 'Aktif' };

export default function AdminPromosPage() {
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadPromos = async () => {
    try {
      const response = await apiFetch('/promos');
      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.promos)) {
        setPromos(data.promos.map((promo) => ({
          id: promo.id,
          name: promo.name,
          code: promo.slug || promo.name,
          type: promo.discountType === 'PERCENT' ? 'Persentase' : 'Potongan tetap',
          value: Number(promo.discountValue || 0),
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
  }, []);

  const visiblePromos = promos.filter((promo) => `${promo.name} ${promo.code}`.toLowerCase().includes(search.toLowerCase()));
  const allSelected = visiblePromos.length > 0 && visiblePromos.every((promo) => selectedIds.includes(promo.id));
  const deleteSelected = async () => {
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} promo terpilih?`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/promos/${id}`, { method: 'DELETE' }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const count = results.filter((result) => result.status === 'fulfilled').length;
    setSelectedIds([]); setBulkDeleting(false); await loadPromos();
    setNotice(`${count} promo berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
  };

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const updatePromoType = (event) => setForm((current) => ({ ...current, type: event.target.value, value: '' }));
  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.value) {
      setNotice('Lengkapi nama, kode, dan nilai promo.');
      return;
    }
    if (!await confirmAction(`Yakin ingin ${editingId ? 'memperbarui promo ini' : 'menambahkan promo baru'}?`)) return;

    const payload = {
      name: form.name,
      description: form.code,
      discountType: form.type === 'Persentase' ? 'PERCENT' : 'FIXED',
      discountValue: Number(form.value),
      isActive: form.status === 'Aktif',
    };

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
      setNotice(error.message || 'Promo gagal disimpan');
    }
  };

  const handleDelete = async (promo) => {
    if (!await confirmAction(`Hapus promo "${promo.name}"?`)) return;

    try {
      const response = await apiFetch(`/promos/${promo.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Promo gagal dihapus');
      setNotice('Promo berhasil dihapus dari database.');
      await loadPromos();
    } catch (error) {
      setNotice(error.message || 'Promo gagal dihapus');
    }
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Promo" />
      <main className="admin-main">
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

        <section className="crud-layout">
          <form className="crud-form-panel" onSubmit={submitForm}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Edit promo' : 'Promo baru'}</span>
                <h2>{editingId ? 'Perbarui campaign' : 'Tambah promo'}</h2>
              </div>
              {editingId && <button type="button" className="text-button" onClick={resetForm}>Batal</button>}
            </div>

            <label>Nama promo<input name="name" value={form.name} onChange={updateField} placeholder="Contoh: Promo Lebaran" /></label>
            <label>Kode promo<input name="code" value={form.code} onChange={updateField} placeholder="LEBARAN15" /></label>

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
            <button className="btn btn-primary full" type="submit">{editingId ? 'Simpan perubahan' : 'Tambah promo'}</button>
          </form>

          <section className="crud-table-panel">
            <div className="crud-toolbar">
              <label className="crud-search">
                <span>cari</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau kode..." />
              </label>
            </div>

            <BulkTableActions selectedCount={selectedIds.length} totalCount={visiblePromos.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? visiblePromos.map((promo) => promo.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Nama promo</th>
                    <th>Jenis</th>
                    <th>Nilai</th>
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
                      <td><span className="status-chip good">{promo.status}</span></td>
                      <td>
                        <div className="row-actions">
                          <button onClick={() => {
                            setEditingId(promo.id);
                            setForm({ name: promo.name, code: promo.code, type: promo.type, value: promo.value, status: promo.status });
                          }}>Edit</button>
                          <button onClick={() => handleDelete(promo)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {visiblePromos.length === 0 && <div className="table-empty">Promo tidak ditemukan.</div>}
            </div>
          </section>
        </section>

        <footer className="admin-footer">Glosir Owner Workspace <span>Data promo terhubung ke database</span></footer>
      </main>
    </div>
  );
}
