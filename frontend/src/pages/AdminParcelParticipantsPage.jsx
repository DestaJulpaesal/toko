import { useEffect, useMemo, useState } from 'react';
import { Check, FileText, Pencil, Printer, RefreshCw, Trash2 } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyForm = {
  customerId: '',
  parcelId: '',
  programId: '',
  name: '',
  targetAmount: '',
  contributionAmount: '',
  participantName: '',
  participantPhone: '',
  regionId: '',
  frequency: 'DAILY',
  startDate: '',
  endDate: '',
  notes: '',
  status: 'ACTIVE',
};

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminParcelParticipantsPage() {
  const [participants, setParticipants] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [collectionParticipant, setCollectionParticipant] = useState(null);
  const [collectionForm, setCollectionForm] = useState({ amount: '', paidAt: new Date().toISOString().slice(0, 10), note: '' });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [regions, setRegions] = useState([]);
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('glosir_user') || 'null'); } catch { return null; }
  })();
  const isParcelManager = currentUser?.role === 'PARCEL_MANAGER';

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('glosir_token');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const requests = [
        apiFetch('/parcel-participants', { headers: authHeaders }),
        apiFetch('/parcels'),
        apiFetch('/parcel-programs'),
      ];
      if (!isParcelManager) requests.push(apiFetch('/parcel-regions', { headers: authHeaders }));
      const [participantResponse, parcelResponse, programResponse, regionResponse] = await Promise.all(requests);
      const participantData = await participantResponse.json();
      const parcelData = await parcelResponse.json();
      const programData = await programResponse.json();
      const regionData = regionResponse ? await regionResponse.json() : null;
      if (participantData.success) setParticipants(participantData.participants || []);
      if (parcelData.success) setParcels(parcelData.parcels || []);
      if (programData.success) setPrograms(programData.programs || []);
      if (regionData?.success) setRegions(regionData.regions || []);
    } catch {
      setNotice('Data peserta parsel gagal dimuat dari backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!isParcelManager && regions.length === 1 && !form.regionId) {
      setForm((current) => ({ ...current, regionId: regions[0].id }));
    }
  }, [regions, isParcelManager, form.regionId]);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  // Pilih program tahunan -> auto isi nama & target dari data program,
  // supaya tabel ParcelParticipant.programId benar-benar kepakai (bukan cuma diketik ulang manual).
  const selectProgram = (event) => {
    const programId = event.target.value;
    const program = programs.find((item) => item.id === programId);
    setForm((current) => ({
      ...current,
      programId,
      name: program ? program.name : current.name,
      targetAmount: program ? String(program.targetAmount) : current.targetAmount,
    }));
  };

  // Pilih paket parsel -> auto isi nominal setoran dari harga paket kalau kolomnya masih kosong.
  const selectParcel = (event) => {
    const parcelId = event.target.value;
    const parcel = parcels.find((item) => item.id === parcelId);
    setForm((current) => ({
      ...current,
      parcelId,
      contributionAmount: parcel ? String(parcel.price) : current.contributionAmount,
      frequency: parcel ? (Number(parcel.price) >= 50000 ? 'WEEKLY' : 'DAILY') : current.frequency,
    }));
  };

  const targetAmount = Number(form.targetAmount || 0);
  const contributionAmount = Number(form.contributionAmount || 0);
  const installmentCount = targetAmount > 0 && contributionAmount > 0 ? Math.ceil(targetAmount / contributionAmount) : 0;
  const scheduleLabel = form.frequency === 'WEEKLY' ? 'minggu' : 'hari';
  const durationLabel = installmentCount
    ? `${installmentCount} ${scheduleLabel} ${form.frequency === 'DAILY' ? `(acuan 360 hari/tahun: ${(installmentCount / 360).toFixed(1)} tahun)` : `(sekitar ${(installmentCount / 52).toFixed(1)} tahun)`}`
    : 'Pilih program dan paket untuk melihat kalkulasi';

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const filtered = useMemo(
    () =>
      participants.filter((item) =>
        `${item.name} ${item.customerName || ''} ${item.parcelName || ''} ${item.programName || ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [participants, search]
  );
  const allSelected = filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id));
  const visibleParticipants = filtered.filter((item) => statusFilter === 'ALL' || item.collectionStatus === statusFilter || item.status === statusFilter);
  const summary = useMemo(() => ({
    total: participants.length,
    collected: participants.reduce((sum, item) => sum + item.paidAmount, 0),
    remaining: participants.reduce((sum, item) => sum + item.remainingAmount, 0),
    overdue: participants.filter((item) => item.collectionStatus === 'OVERDUE').length,
    completed: participants.filter((item) => item.collectionStatus === 'COMPLETED').length,
  }), [participants]);
  const deleteSelected = async () => {
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} peserta terpilih beserta riwayat setorannya?`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/parcel-participants/${id}`, { method: 'DELETE' }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
    const count = results.filter((result) => result.status === 'fulfilled').length;
    setSelectedIds([]); setBulkDeleting(false); await load();
    setNotice(`${count} peserta berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.participantName.trim() || !form.programId || Number(form.targetAmount) <= 0 || Number(form.contributionAmount) <= 0 || (!isParcelManager && !form.regionId)) {
      setNotice(isParcelManager ? 'Nama peserta, program, target, dan setoran wajib diisi.' : 'Nama peserta, wilayah, program, target, dan setoran wajib diisi.');
      return;
    }
    if (!await confirmAction(`${editingId ? 'Perbarui' : 'Daftarkan'} peserta parsel ini?`)) return;
    try {
      const response = await apiFetch(
        editingId ? `/parcel-participants/${editingId}` : '/parcel-participants',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('glosir_token') ? { Authorization: `Bearer ${localStorage.getItem('glosir_token')}` } : {}) },
          body: JSON.stringify({ ...form, regionId: isParcelManager ? undefined : form.regionId, targetAmount: Number(form.targetAmount), contributionAmount: Number(form.contributionAmount) }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Peserta gagal disimpan.');
      setNotice(editingId ? 'Peserta parsel berhasil diperbarui.' : 'Peserta parsel berhasil ditambahkan.');
      reset();
      await load();
    } catch (error) {
      setNotice(error.message || 'Peserta gagal disimpan.');
    }
  };

  const recordContribution = async (event) => {
    event.preventDefault();
    const participant = collectionParticipant;
    if (!participant || Number(collectionForm.amount) <= 0) return;
    try {
      const response = await apiFetch(`/parcel-participants/${participant.id}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('glosir_token') ? { Authorization: `Bearer ${localStorage.getItem('glosir_token')}` } : {}) },
        body: JSON.stringify(collectionForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Setoran gagal dicatat.');
      setNotice('Setoran berhasil dicatat ke database.');
      setCollectionParticipant(null);
      await load();
    } catch (error) {
      setNotice(error.message || 'Setoran gagal dicatat.');
    }
  };

  const openCollection = (participant) => {
    setCollectionParticipant(participant);
    setCollectionForm({ amount: String(participant.contributionAmount), paidAt: new Date().toISOString().slice(0, 10), note: 'Penagihan keliling cash' });
  };

  const printReceipt = (participant) => {
    const receipt = window.open('', '_blank', 'width=420,height=650');
    if (!receipt) return;
    receipt.document.write(`<html><head><title>Bukti Setoran Parsel</title><style>body{font:14px Arial;padding:24px;color:#202820}h1{font-size:20px}p{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px 0}strong{font-size:16px}</style></head><body><h1>Bukti Setoran Parsel</h1><p><span>Peserta</span><strong>${participant.name}</strong></p><p><span>Program</span><strong>${participant.programName || '-'}</strong></p><p><span>Tanggal</span><strong>${new Date().toLocaleDateString('id-ID')}</strong></p><p><span>Nominal cash</span><strong>${money(participant.contributionAmount)}</strong></p><p><span>Total terkumpul</span><strong>${money(participant.paidAmount)}</strong></p><p><span>Sisa</span><strong>${money(participant.remainingAmount)}</strong></p><p>Petugas: Penagihan keliling</p><script>window.print()</script></body></html>`);
    receipt.document.close();
  };

  const exportReport = () => {
    const rows = [['Nama Peserta', 'Program', 'Wilayah', 'Target', 'Terkumpul', 'Sisa', 'Status', 'Setoran Berikutnya'], ...participants.map((item) => [item.name, item.programName || '', item.regionName || '', item.targetAmount, item.paidAmount, item.remainingAmount, item.collectionStatus, new Date(item.nextDueDate).toLocaleDateString('id-ID')])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `laporan-parsel-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const remove = async (participant) => {
    if (!await confirmAction(`Hapus peserta "${participant.name}" beserta riwayat setorannya?`)) return;
    try {
      const response = await apiFetch(`/parcel-participants/${participant.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Peserta gagal dihapus.');
      setNotice('Peserta parsel berhasil dihapus.');
      await load();
    } catch (error) {
      setNotice(error.message || 'Peserta gagal dihapus.');
    }
  };

  const edit = (item) => {
    setEditingId(item.id);
    setForm({
      customerId: item.customerId || '',
      parcelId: item.parcelId || '',
      programId: item.programId || '',
      name: item.name,
      targetAmount: item.targetAmount,
      contributionAmount: item.contributionAmount,
      regionId: item.regionId || '',
      participantName: item.customerName || item.name || '',
      participantPhone: item.customerPhone || '',
      frequency: item.frequency,
      status: item.status || 'ACTIVE',
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : '',
      endDate: item.endDate ? String(item.endDate).slice(0, 10) : '',
      notes: item.notes || '',
    });
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Peserta Parsel" />
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Parcel membership</p>
            <h1>Peserta Parsel Tahunan</h1>
            <p className="admin-subtitle">Kelola peserta, setoran harian/mingguan, dan total dana parsel.</p>
          </div>
        </header>

        <section className="parcel-summary-grid">
          <article><span>Total peserta</span><strong>{summary.total}</strong><small>{summary.completed} sudah lunas</small></article>
          <article><span>Cash terkumpul</span><strong>{money(summary.collected)}</strong><small>Hasil penagihan keliling</small></article>
          <article><span>Sisa tagihan</span><strong>{money(summary.remaining)}</strong><small>Belum tertagih</small></article>
          <article className={summary.overdue ? 'is-warning' : ''}><span>Perlu ditagih</span><strong>{summary.overdue}</strong><small>Peserta melewati jadwal</small></article>
        </section>

        {collectionParticipant && <div className="parcel-collection-modal"><form onSubmit={recordContribution} className="parcel-collection-card"><div className="panel-heading"><div><span className="panel-kicker">Penagihan keliling</span><h2>Catat cash: {collectionParticipant.name}</h2></div><button type="button" className="text-button" onClick={() => setCollectionParticipant(null)}>Tutup</button></div><label>Nominal diterima<CurrencyInput value={collectionForm.amount} onValueChange={(value) => setCollectionForm((current) => ({ ...current, amount: value }))} /></label><label>Tanggal<input type="date" value={collectionForm.paidAt} onChange={(event) => setCollectionForm((current) => ({ ...current, paidAt: event.target.value }))} /></label><label>Catatan<textarea rows="2" value={collectionForm.note} onChange={(event) => setCollectionForm((current) => ({ ...current, note: event.target.value }))} /></label><button className="btn btn-primary full" type="submit">Simpan setoran cash</button></form></div>}

        {notice && (
          <div className="crud-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}

        <section className="crud-layout">
          <form className="crud-form-panel" onSubmit={submit}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Edit peserta' : 'Peserta baru'}</span>
                <h2>{editingId ? 'Perbarui peserta' : 'Daftarkan peserta'}</h2>
              </div>
              {editingId && (
                <button type="button" className="text-button" onClick={reset}>
                  Batal
                </button>
              )}
            </div>

            <div className="form-two-columns"><label>Nama peserta<input name="participantName" value={form.participantName} onChange={update} placeholder="Nama peserta parsel" /></label><label>No. HP<input name="participantPhone" value={form.participantPhone} onChange={update} placeholder="08..." /></label></div>

            {!isParcelManager && <label>
              <span className="parcel-region-label"><span>Wilayah parsel</span><button type="button" className="inline-refresh-button" onClick={load} title="Refresh wilayah" aria-label="Refresh wilayah"><RefreshCw size={12} /></button></span>
              <select name="regionId" value={form.regionId} onChange={update}>
                <option value="">Pilih wilayah peserta</option>
                {regions.map((region) => <option key={region.id} value={region.id}>{region.name} ({region.code})</option>)}
              </select>
              {!regions.length && <small>Buat wilayah terlebih dahulu di menu Wilayah Parsel.</small>}
            </label>}

            <label>
              Program tahunan
              <select name="programId" value={form.programId} onChange={selectProgram}>
                <option value="">Pilih program (dari menu Program Parsel)</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name} ({program.year}) · Target {money(program.targetAmount)}
                  </option>
                ))}
              </select>
              {form.programId && <small>Target otomatis dari program: {money(form.targetAmount)}</small>}
            </label>

            <label>
              Paket parsel
              <select name="parcelId" value={form.parcelId} onChange={selectParcel}>
                <option value="">Pilih paket (opsional)</option>
                {parcels.map((parcel) => (
                  <option key={parcel.id} value={parcel.id}>
                    {parcel.name} · {money(parcel.price)}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-two-columns">
              <label>
                Target tahunan
                <CurrencyInput
                  value={form.targetAmount}
                  readOnly={Boolean(form.programId)}
                  onValueChange={(value) => setForm((current) => ({ ...current, targetAmount: value }))}
                  placeholder="Rp 3.650.000"
                />
              </label>
              <label>
                Setoran per periode
                <CurrencyInput
                  value={form.contributionAmount}
                  onValueChange={(value) => setForm((current) => ({ ...current, contributionAmount: value }))}
                  placeholder="Rp 10.000"
                />
              </label>
            </div>

            <div className="form-two-columns">
              <label>
                Frekuensi
                <select name="frequency" value={form.frequency} onChange={update}>
                  <option value="DAILY">Harian</option>
                  <option value="WEEKLY">Mingguan</option>
                </select>
                <small>Otomatis dari paket: nominal besar mingguan, nominal kecil harian.</small>
              </label>
              <label>
                Tanggal mulai
                <input name="startDate" type="date" value={form.startDate} onChange={update} />
              </label>
            </div>

            <div className="parcel-calculation-card">
              <div><span>Rumus setoran</span><strong>{contributionAmount ? `${money(contributionAmount)} × ${installmentCount || '?'} ${scheduleLabel}` : '-'}</strong></div>
              <div><span>Estimasi target tercapai</span><strong>{durationLabel}</strong></div>
            </div>

            <label>
              Status program
              <select name="status" value={form.status} onChange={update}>
                <option value="ACTIVE">Aktif</option>
                <option value="COMPLETED">Lunas</option>
                <option value="CANCELLED">Dibatalkan</option>
              </select>
            </label>

            <label>
              Catatan
              <textarea name="notes" rows="2" value={form.notes} onChange={update} placeholder="Catatan peserta" />
            </label>

            <button className="btn btn-primary full" type="submit">
              {editingId ? 'Simpan perubahan' : 'Tambah peserta'}
            </button>
          </form>

          <section className="crud-table-panel">
            <BulkTableActions selectedCount={selectedIds.length} totalCount={filtered.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? filtered.map((item) => item.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="crud-toolbar-actions">
              <label className="crud-search">
                <span>Cari</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari peserta atau program..." />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status tagihan"><option value="ALL">Semua status</option><option value="OVERDUE">Perlu ditagih</option><option value="DUE">Jadwal berikutnya</option><option value="COMPLETED">Lunas</option></select>
              <button type="button" className="bulk-refresh-btn" onClick={exportReport}><FileText size={14} /> Export CSV</button>
            </div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Peserta / Program</th><th>Wilayah</th>
                    <th>Target</th>
                    <th>Setoran</th>
                    <th>Terkumpul</th>
                    <th>Progres</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleParticipants.map((item) => (
                    <tr key={item.id}>
                      <td className="bulk-check-column"><BulkRowCheckbox checked={selectedIds.includes(item.id)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} label={`Pilih ${item.name}`} /></td>
                      <td>
                        <strong>{item.name}</strong>
                        <small>
                          {item.name}
                          {item.programName ? ` · Program: ${item.programName}` : ''}
                          {item.parcelName ? ` · ${item.parcelName}` : ''}
                        </small>
                      </td>
                      <td>{item.regionName || 'Belum ditentukan'}</td>
                      <td>{money(item.targetAmount)}</td>
                      <td>
                        {money(item.contributionAmount)} / {item.frequency === 'WEEKLY' ? 'minggu' : 'hari'}
                      </td>
                      <td>
                        <strong>{money(item.paidAmount)}</strong>
                        <small>Sisa {money(item.remainingAmount)}</small>
                        {item.contributions?.[0] && <small>Terakhir: {new Date(item.contributions[0].paidAt).toLocaleDateString('id-ID')}</small>}
                      </td>
                      <td>
                        <span className={`status-chip ${item.collectionStatus === 'OVERDUE' ? 'warning' : item.collectionStatus === 'COMPLETED' ? 'good' : 'neutral'}`}>{item.collectionStatus === 'OVERDUE' ? 'Tagih' : item.collectionStatus === 'COMPLETED' ? 'Lunas' : `${item.progress}%`}</span>
                        <small className="parcel-next-due">{item.collectionStatus === 'COMPLETED' ? 'Program selesai' : `Berikutnya: ${new Date(item.nextDueDate).toLocaleDateString('id-ID')}`}</small>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-action icon-action-debt" onClick={() => openCollection(item)} title="Catat setoran cash" aria-label="Catat setoran cash"><Check size={15} /></button>
                          <button className="icon-action" onClick={() => printReceipt(item)} title="Cetak bukti" aria-label="Cetak bukti"><Printer size={14} /></button>
                          <button className="icon-action" onClick={() => edit(item)} title="Edit peserta" aria-label="Edit peserta"><Pencil size={14} /></button>
                          <button className="icon-action icon-action-danger" onClick={() => remove(item)} title="Hapus peserta" aria-label="Hapus peserta"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="table-empty">Memuat peserta parsel...</div>}
              {!loading && !visibleParticipants.length && <div className="table-empty">Belum ada peserta parsel pada filter ini.</div>}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}