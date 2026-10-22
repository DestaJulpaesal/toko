import { useEffect, useMemo, useState } from 'react';
import { FileText, HandCoins, Pencil, Plus, Printer, RefreshCw, Search, Trash2, X } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
import CurrencyInput from '../components/CurrencyInput';
import BulkTableActions, { BulkRowCheckbox } from '../components/BulkTableActions';
import { confirmAction } from '../utils/confirmService';
import { showNotice } from '../utils/noticeService';
import { apiFetch } from '../services/api';

const emptyForm = {
  customerId: '',
  parcelId: '',
  programId: '',
  name: '',
  targetAmount: '',
  contributionAmount: '',
  adminFee: '',
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
  const [parcels, setParcels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordingContribution, setRecordingContribution] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
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
      const loadResource = async (path, label, update, options = {}) => {
        const response = await apiFetch(path, options);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || `${label} gagal dimuat.`);
        update(data);
      };
      const requests = [
        loadResource('/parcel-participants', 'Data peserta', (data) => setParticipants(data.participants || []), { headers: authHeaders }),
        loadResource('/parcels', 'Data parsel', (data) => setParcels(data.parcels || [])),
      ];
      if (!isParcelManager) {
        requests.push(loadResource('/parcel-regions', 'Data wilayah', (data) => setRegions(data.regions || []), { headers: authHeaders }));
      }
      const results = await Promise.allSettled(requests);
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length) {
        console.error('Some parcel participant data failed to load:', failures.map((result) => result.reason));
        setNotice(`Sebagian data peserta parsel gagal dimuat (${failures.length} bagian).`);
      }
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
    if (!formOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        setForm(emptyForm);
        setEditingId(null);
        setFormOpen(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [formOpen, saving]);

  useEffect(() => {
    if (!isParcelManager && regions.length === 1 && !form.regionId) {
      setForm((current) => ({ ...current, regionId: regions[0].id }));
    }
  }, [regions, isParcelManager, form.regionId]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'frequency' && Number(current.targetAmount) > 0) {
        const periods = value === 'WEEKLY' ? 52 : 365;
        next.contributionAmount = String(Math.ceil(Number(current.targetAmount) / periods));
      }
      return next;
    });
  };

  const selectParcel = (event) => {
    const parcelId = event.target.value;
    const parcel = parcels.find((item) => item.id === parcelId);
    setForm((current) => ({
      ...current,
      parcelId,
      programId: parcel ? '' : current.programId,
      targetAmount: parcel ? String(Number(parcel.price || 0) + Number(parcel.adminFee || 0)) : '',
      adminFee: parcel ? String(Number(parcel.adminFee || 0)) : '',
      contributionAmount: parcel
        ? String(Math.ceil((Number(parcel.price || 0) + Number(parcel.adminFee || 0)) / (current.frequency === 'WEEKLY' ? 52 : 365)))
        : '',
    }));
  };

  const selectedParcel = parcels.find((parcel) => parcel.id === form.parcelId) || null;
  const targetAmount = Number(form.targetAmount || 0);
  const contributionAmount = Number(form.contributionAmount || 0);
  const installmentCount = targetAmount > 0 ? (form.frequency === 'WEEKLY' ? 52 : 365) : 0;
  const plannedTotal = contributionAmount * installmentCount;
  const finalContributionAmount = installmentCount ? Math.max(0, contributionAmount - (plannedTotal - targetAmount)) : 0;
  const scheduleLabel = form.frequency === 'WEEKLY' ? 'minggu' : 'hari';
  const durationLabel = installmentCount
    ? `${installmentCount} kali setoran selama 1 tahun`
    : 'Pilih paket parsel untuk melihat rencana tabungan';

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
  };

  const filtered = useMemo(
    () =>
      participants.filter((item) =>
        `${item.name} ${item.customerName || ''} ${item.parcelName || ''} ${item.regionName || ''}`
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
    if (bulkDeleting) return;
    if (!selectedIds.length || !await confirmAction(`Hapus ${selectedIds.length} peserta terpilih beserta riwayat setorannya?`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => apiFetch(`/parcel-participants/${id}`, { method: 'DELETE', silentNotify: true }).then(async (response) => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menghapus'); return id; })));
      const count = results.filter((result) => result.status === 'fulfilled').length;
      setSelectedIds([]); await load();
      setNotice(`${count} peserta berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`);
      showNotice(`${count} peserta berhasil dihapus${count < results.length ? `, ${results.length - count} gagal` : ''}.`, count < results.length ? 'error' : 'success');
    } finally { setBulkDeleting(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const isLegacyParticipant = Boolean(editingId && form.programId && !form.parcelId);
    if (!form.participantName.trim() || (!form.parcelId && !isLegacyParticipant) || Number(form.targetAmount) <= 0 || Number(form.contributionAmount) <= 0 || (!isParcelManager && !form.regionId)) {
      setNotice(isParcelManager ? 'Nama peserta, paket parsel, dan wilayah serta jadwal setoran yang valid wajib diisi.' : 'Nama peserta, wilayah, paket parsel, dan jadwal setoran yang valid wajib diisi.');
      return;
    }
    if (!await confirmAction(`${editingId ? 'Perbarui' : 'Daftarkan'} peserta parsel ini?`)) return;
    setSaving(true);
    try {
      const response = await apiFetch(
        editingId ? `/parcel-participants/${editingId}` : '/parcel-participants',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('glosir_token') ? { Authorization: `Bearer ${localStorage.getItem('glosir_token')}` } : {}) },
          body: JSON.stringify({
            ...form,
            regionId: isParcelManager ? undefined : form.regionId,
            targetAmount: Number(form.targetAmount),
            contributionAmount: Number(form.contributionAmount),
            adminFee: Number(form.adminFee || 0),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Peserta gagal disimpan.');
      setNotice(editingId ? 'Peserta parsel berhasil diperbarui.' : 'Peserta parsel berhasil ditambahkan.');
      reset();
      await load();
    } catch (error) {
      setNotice(error.message || 'Peserta gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const recordContribution = async (event) => {
    event.preventDefault();
    const participant = collectionParticipant;
    if (!participant || Number(collectionForm.amount) <= 0) return;
    if (recordingContribution) return;
    setRecordingContribution(true);
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
    } finally {
      setRecordingContribution(false);
    }
  };

  const openCollection = (participant) => {
    setCollectionParticipant(participant);
    setCollectionForm({
      amount: String(Math.min(participant.contributionAmount, participant.remainingAmount)),
      paidAt: new Date().toISOString().slice(0, 10),
      note: 'Penagihan keliling cash',
    });
  };

  const printReceipt = (participant) => {
    const receipt = window.open('', '_blank', 'width=420,height=650');
    if (!receipt) return;
    receipt.document.write(`<html><head><title>Bukti Setoran Parsel</title><style>body{font:14px Arial;padding:24px;color:#202820}h1{font-size:20px}p{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px 0}strong{font-size:16px}</style></head><body><h1>Bukti Setoran Parsel</h1><p><span>Peserta</span><strong>${participant.name}</strong></p><p><span>Paket parsel</span><strong>${participant.parcelName || participant.programName || '-'}</strong></p><p><span>Tanggal</span><strong>${new Date().toLocaleDateString('id-ID')}</strong></p><p><span>Nominal cash</span><strong>${money(participant.contributionAmount)}</strong></p><p><span>Total terkumpul</span><strong>${money(participant.paidAmount)}</strong></p><p><span>Sisa</span><strong>${money(participant.remainingAmount)}</strong></p><p>Petugas: Penagihan keliling</p><script>window.print()</script></body></html>`);
    receipt.document.close();
  };

  const exportReport = () => {
    const rows = [['Nama Peserta', 'Paket Parsel', 'Wilayah', 'Target Paket + Admin', 'Setoran', 'Terkumpul', 'Sisa', 'Status', 'Setoran Berikutnya'], ...participants.map((item) => [item.name, item.parcelName || item.programName || '', item.regionName || '', item.targetAmount, `${item.contributionAmount}/${item.frequency === 'WEEKLY' ? 'minggu' : 'hari'}`, item.paidAmount, item.remainingAmount, item.collectionStatus, new Date(item.nextDueDate).toLocaleDateString('id-ID')])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `laporan-parsel-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const remove = async (participant) => {
    if (deletingId) return;
    if (!await confirmAction(`Hapus peserta "${participant.name}" beserta riwayat setorannya?`)) return;
    setDeletingId(participant.id);
    try {
      const response = await apiFetch(`/parcel-participants/${participant.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Peserta gagal dihapus.');
      setNotice('Peserta parsel berhasil dihapus.');
      await load();
    } catch (error) {
      setNotice(error.message || 'Peserta gagal dihapus.');
    } finally {
      setDeletingId(null);
    }
  };

  const edit = (item) => {
    setEditingId(item.id);
    setFormOpen(true);
    setForm({
      customerId: item.customerId || '',
      parcelId: item.parcelId || '',
      programId: item.programId || '',
      name: item.name,
      targetAmount: item.targetAmount,
      contributionAmount: item.contributionAmount,
      adminFee: item.adminFee || 0,
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

  const addParticipant = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(true);
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Peserta Parsel" />
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow light">Tabungan paket parsel</p>
              <h1>Peserta Parsel</h1>
              <p className="admin-subtitle">Daftarkan peserta untuk paket parsel dan pantau tabungan hingga lunas.</p>
          </div>
          <button type="button" className="btn btn-primary participant-add-button" onClick={addParticipant}>
            <Plus size={17} /> Tambah peserta
          </button>
        </header>

        <section className="parcel-summary-grid">
          <article><span>Total peserta</span><strong>{summary.total}</strong><small>{summary.completed} sudah lunas</small></article>
          <article><span>Cash terkumpul</span><strong>{money(summary.collected)}</strong><small>Hasil penagihan keliling</small></article>
          <article><span>Sisa tagihan</span><strong>{money(summary.remaining)}</strong><small>Belum tertagih</small></article>
          <article className={summary.overdue ? 'is-warning' : ''}><span>Perlu ditagih</span><strong>{summary.overdue}</strong><small>Peserta melewati jadwal</small></article>
        </section>

        {collectionParticipant && <div className="parcel-collection-modal"><form onSubmit={recordContribution} className="parcel-collection-card"><div className="panel-heading"><div><span className="panel-kicker">Penagihan keliling</span><h2>Catat setoran: {collectionParticipant.name}</h2></div><button type="button" className="text-button" onClick={() => setCollectionParticipant(null)} disabled={recordingContribution}>Tutup</button></div><p>Sisa tabungan: <strong>{money(collectionParticipant.remainingAmount)}</strong></p><label>Nominal diterima<CurrencyInput value={collectionForm.amount} max={collectionParticipant.remainingAmount} onValueChange={(value) => setCollectionForm((current) => ({ ...current, amount: value }))} /></label><label>Tanggal<input type="date" value={collectionForm.paidAt} onChange={(event) => setCollectionForm((current) => ({ ...current, paidAt: event.target.value }))} /></label><label>Catatan<textarea rows="2" value={collectionForm.note} onChange={(event) => setCollectionForm((current) => ({ ...current, note: event.target.value }))} /></label><button className="btn btn-primary full" type="submit" disabled={recordingContribution || collectionParticipant.remainingAmount <= 0}>{recordingContribution ? 'Menyimpan...' : 'Simpan setoran'}</button></form></div>}

        {notice && (
          <div className="crud-notice" role="status">
            {notice}
            <button onClick={() => setNotice('')}>×</button>
          </div>
        )}

        {formOpen && (
          <div
            className="participant-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving) reset();
            }}
          >
            <section className="participant-form-modal" role="dialog" aria-modal="true" aria-labelledby="participant-form-title">
              <form className="crud-form-panel participant-form-panel" onSubmit={submit}>
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">{editingId ? 'Edit peserta' : 'Peserta baru'}</span>
                <h2 id="participant-form-title">{editingId ? 'Perbarui peserta' : 'Daftarkan peserta'}</h2>
              </div>
              <button type="button" className="participant-modal-close" onClick={reset} disabled={saving} aria-label="Tutup form">
                <X size={19} />
              </button>
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
              Pilih paket parsel
              <select name="parcelId" value={form.parcelId} onChange={selectParcel}>
                <option value="">Pilih paket untuk peserta ini</option>
                {parcels.map((parcel) => (
                  <option key={parcel.id} value={parcel.id}>
                    {parcel.name} · Harga jual {money(parcel.price)}
                  </option>
                ))}
              </select>
              {!parcels.length && <small>Belum ada paket parsel. Buat paket terlebih dahulu di menu Kelola Parsel.</small>}
            </label>

            {selectedParcel && (
              <section className="parcel-calculation-card" aria-label="Rincian paket parsel">
                <div>
                  <span>Paket yang dipilih</span>
                  <strong>{selectedParcel.name}</strong>
                  {selectedParcel.description && <small>Kode paket: {selectedParcel.description}</small>}
                </div>
                {selectedParcel.items?.length > 0 && (
                  <ul className="parcel-selected-items">
                    {selectedParcel.items.map((item) => (
                      <li key={item.id || item.variantId}>
                        {item.productName || item.variantName || 'Barang'}{item.variantName && item.productName ? ` · ${item.variantName}` : ''} × {Number(item.quantity)}
                      </li>
                    ))}
                  </ul>
                )}
                {!selectedParcel.items?.length && <small className="parcel-items-missing">Rincian barang belum tersedia. Perbarui isi paket di menu Kelola Parsel.</small>}
                <div><span>Harga jual paket</span><strong>{money(selectedParcel.price)}</strong></div>
                <div><span>Biaya admin tetap</span><strong>{money(selectedParcel.adminFee || 50000)}</strong></div>
                <div><span>Total target tabungan</span><strong>{money(Number(selectedParcel.price || 0) + Number(selectedParcel.adminFee || 0))}</strong></div>
              </section>
            )}

            <div className="form-two-columns">
              <label>
                Target tabungan (paket + admin)
                <CurrencyInput
                  value={form.targetAmount}
                  readOnly
                  placeholder="Pilih paket parsel"
                />
              </label>
              <label>
                Setoran rutin
                <CurrencyInput
                  value={form.contributionAmount}
                  readOnly
                  placeholder="Dihitung otomatis"
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
                <small>Setoran dihitung otomatis selama satu tahun: 365 kali harian atau 52 kali mingguan.</small>
              </label>
              <label>
                Tanggal mulai
                <input name="startDate" type="date" value={form.startDate} onChange={update} />
              </label>
            </div>

            <div className="parcel-calculation-card">
              <div><span>Rencana setoran</span><strong>{contributionAmount ? `${money(contributionAmount)} × ${installmentCount} kali ${scheduleLabel}` : '-'}</strong></div>
              <div><span>Setoran terakhir</span><strong>{installmentCount ? money(finalContributionAmount) : '-'}</strong></div>
              <div><span>Durasi</span><strong>{durationLabel}</strong></div>
            </div>

            <label>
              Status peserta
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

                <div className="participant-form-actions">
                  <button className="btn btn-secondary" type="button" onClick={reset} disabled={saving}>Batal</button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah peserta'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

          <section className="crud-table-panel participant-table-panel">
            <div className="participant-table-heading">
              <div>
                <span className="panel-kicker">Daftar peserta</span>
                <h2>{visibleParticipants.length} peserta</h2>
              </div>
              <span className="participant-table-total">{summary.total} terdaftar</span>
            </div>
            <BulkTableActions selectedCount={selectedIds.length} totalCount={filtered.length} allSelected={allSelected} onToggleAll={(checked) => setSelectedIds(checked ? filtered.map((item) => item.id) : [])} onDelete={deleteSelected} deleting={bulkDeleting} />
            <div className="crud-toolbar-actions">
              <label className="crud-search">
                <Search size={16} aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari peserta, paket, atau wilayah..." />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter status tagihan"><option value="ALL">Semua status</option><option value="OVERDUE">Perlu ditagih</option><option value="DUE">Jadwal berikutnya</option><option value="COMPLETED">Lunas</option></select>
              <button type="button" className="bulk-refresh-btn" onClick={exportReport}><FileText size={14} /> Export CSV</button>
            </div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead>
                  <tr>
                    <th className="bulk-check-column">Pilih</th><th>Peserta / Paket</th><th>Wilayah</th>
                    <th>Target tabungan</th>
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
                          {item.parcelName || item.programName || 'Paket belum ditentukan'}
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
                        <small className="parcel-next-due">{item.collectionStatus === 'COMPLETED' ? 'Tabungan lunas' : `Berikutnya: ${new Date(item.nextDueDate).toLocaleDateString('id-ID')}`}</small>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-action icon-action-debt" onClick={() => openCollection(item)} disabled={item.remainingAmount <= 0} title="Catat setoran" aria-label="Catat setoran"><HandCoins size={15} /><span>Catat setoran</span></button>
                          <button className="icon-action" onClick={() => printReceipt(item)} title="Cetak bukti" aria-label="Cetak bukti"><Printer size={14} /><span>Cetak bukti</span></button>
                          <button className="icon-action" onClick={() => edit(item)} title="Edit peserta" aria-label="Edit peserta"><Pencil size={14} /><span>Edit</span></button>
                          <button className="icon-action icon-action-danger" onClick={() => remove(item)} disabled={deletingId === item.id} title="Hapus peserta" aria-label="Hapus peserta">{deletingId === item.id ? '...' : <Trash2 size={14} />}<span>Hapus</span></button>
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
      </main>
    </div>
  );
}