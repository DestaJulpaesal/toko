import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';

const emptyForm = {
  name: '',
  year: new Date().getFullYear(),
  targetAmount: '',
  notes: '',
};

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminParcelProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/parcel-programs');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Program gagal dimuat.');
      setPrograms(data.programs || []);
    } catch (error) {
      setNotice(error.message || 'Program gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || Number(form.year) < 2000 || Number(form.targetAmount) <= 0) {
      setNotice('Nama program, tahun, dan target wajib diisi.');
      return;
    }
    const action = editingId ? 'Simpan perubahan program' : 'Tambah program';
    if (!await confirmAction(`${action} "${form.name}"?`)) return;

    try {
      const response = await apiFetch(
        editingId
          ? `/parcel-programs/${editingId}`
          : '/parcel-programs',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            year: Number(form.year),
            targetAmount: Number(form.targetAmount),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Program gagal disimpan.');
      setNotice(editingId ? 'Program berhasil diperbarui.' : 'Program berhasil ditambahkan.');
      reset();
      await load();
    } catch (error) {
      setNotice(error.message || 'Program gagal disimpan.');
    }
  };

  const edit = (program) => {
    setEditingId(program.id);
    setForm({
      name: program.name,
      year: program.year,
      targetAmount: program.targetAmount,
      notes: program.notes || '',
    });
  };

  const remove = async (program) => {
    if (program.participantCount > 0) {
      setNotice('Program yang sudah memiliki peserta tidak dapat dihapus.');
      return;
    }
    if (!await confirmAction(`Hapus program "${program.name}"?`)) return;
    try {
      const response = await apiFetch(`/parcel-programs/${program.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Program gagal dihapus.');
      setNotice('Program berhasil dihapus.');
      await load();
    } catch (error) {
      setNotice(error.message || 'Program gagal dihapus.');
    }
  };

  const eligiblePrograms = programs.filter((program) => program.participantCount === 0);
  const allSelected = eligiblePrograms.length > 0 && eligiblePrograms.every((program) => selectedIds.includes(program.id));
  const deleteSelected = async () => {
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} program terpilih yang belum memiliki peserta?`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/parcel-programs/${id}`, { method: 'DELETE', silentNotify: true }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const count = results.filter((result) => result.status === 'fulfilled').length;
    setSelectedIds([]); setBulkDeleting(false); await load();
    setNotice(`${count} program berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
    showNotice(`${count} program berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`, count < results.length ? 'error' : 'success');
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Program Parsel" />
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Parcel program catalog</p>
            <h1>Program Parsel</h1>
            <p className="admin-subtitle">Buat daftar program tahunan agar peserta tinggal memilih dari tabel.</p>
          </div>
        </header>

        {notice && (
          <div className="crud-notice" role="status">
            {notice}
            <button type="button" onClick={() => setNotice('')}>×</button>
          </div>
        )}

        <section className="crud-layout">
          <form className="crud-form-panel" onSubmit={submit}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Edit program' : 'Program baru'}</span>
                <h2>{editingId ? 'Perbarui program' : 'Tambah program'}</h2>
              </div>
              {editingId && (
                <button type="button" className="text-button" onClick={reset}>
                  Batal
                </button>
              )}
            </div>

            <label>
              Nama program
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Parsel Lebaran 2027"
              />
            </label>
            <label>
              Tahun
              <input
                type="number"
                min="2000"
                value={form.year}
                onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
              />
            </label>
            <label>
              Target program
              <CurrencyInput
                value={form.targetAmount}
                onValueChange={(value) => setForm((current) => ({ ...current, targetAmount: value }))}
                placeholder="Rp 3.650.000"
              />
            </label>
            <label>
              Catatan
              <textarea
                rows="2"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Catatan program (opsional)"
              />
            </label>
            <button className="btn btn-primary full" type="submit">
              {editingId ? 'Simpan perubahan' : 'Simpan program'}
            </button>
          </form>

          <section className="crud-table-panel">
            <BulkTableActions selectedCount={selectedIds.length} totalCount={eligiblePrograms.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? eligiblePrograms.map((program) => program.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Program</th>
                    <th>Tahun</th>
                    <th>Target</th>
                    <th>Peserta</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((program) => (
                    <tr key={program.id}>
                      <td className="bulk-check-column">{program.participantCount === 0 && <BulkRowCheckbox checked={selectedIds.includes(program.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, program.id])] : current.filter((id) => id !== program.id))} label={`Pilih ${program.name}`} />}</td>
                      <td>
                        <strong>{program.name}</strong>
                        {program.notes && <small>{program.notes}</small>}
                      </td>
                      <td>{program.year}</td>
                      <td>{money(program.targetAmount)}</td>
                      <td>{program.participantCount}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" onClick={() => edit(program)}>Edit</button>
                          <button type="button" onClick={() => remove(program)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="table-empty">Memuat program...</div>}
              {!loading && !programs.length && <div className="table-empty">Belum ada program.</div>}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
