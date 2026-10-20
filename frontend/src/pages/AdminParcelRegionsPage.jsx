import { useEffect, useState } from 'react';
import { CheckCircle2, CircleDollarSign, KeyRound, MapPinned, Pencil, RefreshCw, Target, Trash2, UserPlus, Users, WalletCards, X } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminParcelRegionsPage() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [managers, setManagers] = useState([]);
  const [regionForm, setRegionForm] = useState({ name: '', code: '' });
  const [managerForm, setManagerForm] = useState({ name: '', email: '', password: '', phone: '', regionId: '' });
  const [saving, setSaving] = useState(false);
  const [editingManagerId, setEditingManagerId] = useState(null);
  const totalParticipants = regions.reduce((sum, region) => sum + Number(region.participantCount || 0), 0);
  const totalTarget = regions.reduce((sum, region) => sum + Number(region.targetAmount || 0), 0);
  const totalPaid = regions.reduce((sum, region) => sum + Number(region.paidAmount || 0), 0);
  const totalRemaining = Math.max(totalTarget - totalPaid, 0);

  const loadRegions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('glosir_token');
      const headers = { Authorization: `Bearer ${token || ''}` };
      const loadRegions = async () => {
        const response = await apiFetch('/parcel-regions', { headers });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Wilayah gagal dimuat.');
        setRegions(data.regions || []);
      };
      const loadManagers = async () => {
        const response = await apiFetch('/parcel-managers', { headers });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Data manager gagal dimuat.');
        setManagers(data.managers || []);
      };
      const results = await Promise.allSettled([loadRegions(), loadManagers()]);
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length) {
        console.error('Some parcel region data failed to load:', failures.map((result) => result.reason));
        setNotice(`Sebagian data wilayah gagal dimuat (${failures.length} bagian).`);
      }
    } catch (error) {
      setNotice(error.message || 'Wilayah gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRegions(); }, []);

  const createRegion = async (event) => {
    event.preventDefault();
    if (!regionForm.name.trim() || !regionForm.code.trim()) return setNotice('Nama dan kode wilayah wajib diisi.');
    setSaving(true);
    try {
      const response = await apiFetch('/parcel-regions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(regionForm) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Wilayah gagal dibuat.');
      setRegionForm({ name: '', code: '' }); setNotice('Wilayah berhasil dibuat.'); await loadRegions();
    } catch (error) { setNotice(error.message); } finally { setSaving(false); }
  };

  const createManager = async (event) => {
    event.preventDefault();
    if (!managerForm.name.trim() || !managerForm.email.trim() || (!editingManagerId && !managerForm.password) || !managerForm.regionId) return setNotice('Lengkapi nama, email, wilayah, dan password untuk akun baru.');
    setSaving(true);
    try {
      const response = await apiFetch(editingManagerId ? `/parcel-managers/${editingManagerId}` : '/parcel-managers', { method: editingManagerId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(managerForm) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Akun manager gagal dibuat.');
      setManagerForm({ name: '', email: '', password: '', phone: '', regionId: '' }); setEditingManagerId(null); setNotice(editingManagerId ? 'Akun berhasil diperbarui.' : 'Akun manager berhasil dibuat.'); await loadRegions();
    } catch (error) { setNotice(error.message); } finally { setSaving(false); }
  };

  const editManager = (manager) => {
    setEditingManagerId(manager.id);
    setManagerForm({ name: manager.name, email: manager.email, password: '', phone: manager.phone || '', regionId: manager.regionId || '' });
    document.querySelector('.region-setup-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const removeManager = async (manager) => {
    if (!await confirmAction(`Nonaktifkan akun ${manager.name}? Akun tidak bisa login lagi, tetapi riwayat datanya tetap aman.`)) return;
    try {
      const response = await apiFetch(`/parcel-managers/${manager.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Akun gagal dinonaktifkan.');
      setNotice('Akun berhasil dinonaktifkan.'); await loadRegions();
    } catch (error) { setNotice(error.message); }
  };

  return (
    <AdminShell active="Wilayah Parsel" mainClassName="parcel-region-workspace">
        <header className="admin-header region-page-header">
          <div><p className="eyebrow light">Pengelolaan wilayah</p><h1>Wilayah Parsel</h1><p className="admin-subtitle">Atur wilayah penagihan, hubungkan petugas, dan pantau setoran parsel dari satu halaman.</p></div>
          <button type="button" className="btn btn-secondary" onClick={loadRegions} disabled={loading}><RefreshCw size={15} className={loading ? 'region-refreshing' : ''} /> {loading ? 'Memuat...' : 'Muat ulang'}</button>
        </header>
        {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button></div>}
        <section className="region-steps" aria-label="Panduan mengelola wilayah">
          <div><span>1</span><p><strong>Buat wilayah</strong><small>Contoh: Area Timur</small></p></div>
          <i aria-hidden="true" />
          <div><span>2</span><p><strong>Hubungkan petugas</strong><small>Buat akun manager parsel</small></p></div>
          <i aria-hidden="true" />
          <div><span>3</span><p><strong>Pantau setoran</strong><small>Lihat progres dan sisa target</small></p></div>
        </section>
        <section className="region-summary-grid">
          <div className="dashboard-stat-card"><span className="region-stat-icon"><MapPinned size={16} /></span><span>Total wilayah</span><strong>{regions.length}</strong><small>Wilayah terdaftar</small></div>
          <div className="dashboard-stat-card"><span className="region-stat-icon is-blue"><Users size={16} /></span><span>Total peserta</span><strong>{totalParticipants}</strong><small>Peserta di semua wilayah</small></div>
          <div className="dashboard-stat-card"><span className="region-stat-icon is-green"><WalletCards size={16} /></span><span>Total setoran</span><strong>{money(totalPaid)}</strong><small>Sudah terkumpul</small></div>
          <div className="dashboard-stat-card"><span className="region-stat-icon is-amber"><Target size={16} /></span><span>Sisa target</span><strong>{money(totalRemaining)}</strong><small>Dari target {money(totalTarget)}</small></div>
        </section>
        <section className="region-setup-grid">
          <form className="dashboard-panel region-setup-card region-create-form" onSubmit={createRegion}>
            <div className="dashboard-panel-heading"><div><span className="panel-kicker">Langkah 1 · Lokasi penagihan</span><h2><MapPinned size={17} /> Buat wilayah</h2></div></div>
            <p className="region-form-help">Wilayah membantu mengelompokkan peserta dan setoran berdasarkan area.</p>
            <label>Nama wilayah<input required maxLength="80" value={regionForm.name} onChange={(event) => setRegionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Area Timur" /></label>
            <label>Kode wilayah<input required maxLength="20" value={regionForm.code} onChange={(event) => setRegionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="Contoh: TIMUR" /><small>Kode singkat untuk membedakan wilayah.</small></label>
            <button className="btn btn-primary full" disabled={saving || loading}><MapPinned size={15} /> {saving ? 'Menyimpan...' : 'Simpan wilayah'}</button>
          </form>
          <form className="dashboard-panel region-setup-card region-manager-form" onSubmit={createManager}>
            <div className="dashboard-panel-heading"><div><span className="panel-kicker">Langkah 2 · Petugas lapangan</span><h2>{editingManagerId ? <Pencil size={17} /> : <UserPlus size={17} />} {editingManagerId ? 'Perbarui akun manager' : 'Buat akun manager parsel'}</h2></div>{editingManagerId && <button type="button" className="region-cancel-button" onClick={() => { setEditingManagerId(null); setManagerForm({ name: '', email: '', password: '', phone: '', regionId: '' }); }} title="Batal edit" aria-label="Batal edit"><X size={15} /></button>}</div>
            <p className="region-form-help">Manager dapat mencatat setoran peserta di wilayah yang dipilih. Akun baru bisa digunakan untuk login.</p>
            <div className="form-two-columns"><label>Nama manager<input required maxLength="100" autoComplete="name" value={managerForm.name} onChange={(event) => setManagerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Andi Pratama" /></label><label>No. HP <span className="region-optional-label">(opsional)</span><input autoComplete="tel" value={managerForm.phone} onChange={(event) => setManagerForm((current) => ({ ...current, phone: event.target.value }))} placeholder="08..." /></label></div>
            <label>Email untuk login<input required type="email" autoComplete="email" value={managerForm.email} onChange={(event) => setManagerForm((current) => ({ ...current, email: event.target.value }))} placeholder="andi@contoh.com" /></label>
            <label>{editingManagerId ? 'Password baru (opsional)' : 'Password awal'}<input type="password" required={!editingManagerId} minLength="6" autoComplete={editingManagerId ? 'new-password' : 'new-password'} value={managerForm.password} onChange={(event) => setManagerForm((current) => ({ ...current, password: event.target.value }))} placeholder={editingManagerId ? 'Kosongkan jika tidak ingin mengganti' : 'Minimal 6 karakter'} /><small>{editingManagerId ? 'Isi hanya jika ingin mengganti password manager.' : 'Gunakan minimal 6 karakter dan sampaikan kepada manager.'}</small></label>
            <label>Wilayah penugasan<select required value={managerForm.regionId} onChange={(event) => setManagerForm((current) => ({ ...current, regionId: event.target.value }))}><option value="">Pilih wilayah</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name} ({region.code})</option>)}</select></label>
            <button className="btn btn-primary full" disabled={saving || loading || !regions.length}>{saving ? 'Menyimpan...' : editingManagerId ? <><Pencil size={15} /> Simpan perubahan akun</> : <><KeyRound size={15} /> Buat akun & hubungkan ke wilayah</>}</button>
          </form>
        </section>
        <section className="dashboard-panel region-grid-panel">
          <div className="dashboard-panel-heading"><div><span className="panel-kicker">Langkah 3 · Pantau pembayaran</span><h2>Progres setoran per wilayah</h2></div><span className="dashboard-panel-total">{regions.length} wilayah</span></div>
          <p className="region-section-help">Progres menunjukkan berapa bagian dari target peserta yang sudah dibayarkan.</p>
          <div className="region-card-grid">
            {regions.map((region) => {
              const remaining = Math.max(Number(region.targetAmount || 0) - Number(region.paidAmount || 0), 0);
              const progress = Math.max(0, Math.min(Number(region.progress || 0), 100));
              return <article className="region-card" key={region.id}>
                <div className="region-card-head"><div className="region-card-title"><span className="region-card-icon"><MapPinned size={17} /></span><span><strong>{region.name}</strong><small>Kode wilayah: {region.code}</small></span></div><span className="region-progress-number">{progress}%</span></div>
                <div className="region-manager-chip">{region.managerName ? <><CheckCircle2 size={13} /> Manager: {region.managerName}</> : <><Users size={13} /> Belum ada manager terhubung</>}</div>
                <div className="region-progress" role="progressbar" aria-label={`Progres setoran ${region.name}`} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${progress}%` }} /></div>
                <div className="region-progress-caption"><span>Progres setoran</span><strong>{progress}%</strong></div>
                <div className="region-card-stats"><span><small>Peserta</small><b>{region.participantCount}</b></span><span><small>Terkumpul</small><b>{money(region.paidAmount)}</b></span><span><small>Sisa target</small><b>{money(remaining)}</b></span></div>
                <div className="region-commission"><CircleDollarSign size={14} /><span>Komisi manager</span><strong>{money(region.managerCommission)}</strong></div>
              </article>;
            })}
            {!loading && !regions.length && <div className="region-empty-state"><MapPinned size={24} /><strong>Belum ada wilayah parsel</strong><span>Mulai dengan mengisi nama dan kode wilayah pada formulir “Buat wilayah” di atas.</span></div>}
            {loading && <div className="region-empty-state" role="status">Memuat data wilayah...</div>}
          </div>
        </section>
        <section className="dashboard-panel manager-accounts-panel">
          <div className="dashboard-panel-heading"><div><span className="panel-kicker">Petugas penagihan</span><h2>Akun manager parsel</h2></div><span className="dashboard-panel-total">{managers.length} akun</span></div>
          <p className="region-section-help">Kelola akun yang bertugas mencatat pembayaran peserta. Nonaktifkan akun jika petugas sudah tidak bertugas.</p>
          <div className="manager-account-list">
            {managers.map((manager) => <div className="manager-account-row" key={manager.id}><div className="manager-account-avatar">{(manager.name || 'PM').slice(0, 2).toUpperCase()}</div><div className="manager-account-info"><strong>{manager.name}</strong><small>{manager.email}{manager.phone ? ` · ${manager.phone}` : ''}</small></div><span className={`manager-role-badge ${manager.role === 'PARCEL_MANAGER' ? 'parcel' : 'cashier'}`}>{manager.role === 'PARCEL_MANAGER' ? 'Manager Parsel' : 'Kasir'}</span><span className="manager-region-label">{manager.regionName || 'Belum terhubung wilayah'}</span><div className="manager-account-actions"><button type="button" className="icon-action" onClick={() => editManager(manager)} title="Edit akun" aria-label={`Edit akun ${manager.name}`}><Pencil size={14} /></button><button type="button" className="icon-action icon-action-danger" onClick={() => removeManager(manager)} title="Nonaktifkan akun" aria-label={`Nonaktifkan akun ${manager.name}`}><Trash2 size={14} /></button></div></div>)}
            {!loading && !managers.length && <div className="region-empty-state"><Users size={24} /><strong>Belum ada akun manager</strong><span>Buat akun manager parsel dari formulir di atas agar petugas bisa mencatat setoran wilayah.</span></div>}
            {loading && <div className="region-empty-state" role="status">Memuat akun manager...</div>}
          </div>
        </section>
      </AdminShell>
  );
}
