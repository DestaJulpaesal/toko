import { useEffect, useState } from 'react';
import { KeyRound, MapPinned, Pencil, RefreshCw, Trash2, UserPlus, Users, WalletCards, X } from 'lucide-react';
import AdminSidebar from '../components/AdminSidebar';
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

  const loadRegions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('glosir_token');
      const headers = { Authorization: `Bearer ${token || ''}` };
      const [response, managerResponse] = await Promise.all([
        apiFetch('/parcel-regions', { headers }),
        apiFetch('/parcel-managers', { headers }),
      ]);
      const data = await response.json();
      const managerData = await managerResponse.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Wilayah gagal dimuat.');
      setRegions(data.regions || []);
      if (managerResponse.ok && managerData.success) setManagers(managerData.managers || []);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="admin-shell">
      <AdminSidebar active="Wilayah Parsel" />
      <main className="admin-main">
        <header className="admin-header">
          <div><p className="eyebrow light">Parcel operations</p><h1>Wilayah Parsel</h1><p className="admin-subtitle">Pantau peserta, setoran, progress, dan komisi manager per wilayah.</p></div>
          <button type="button" className="btn btn-secondary" onClick={loadRegions}><RefreshCw size={15} /> Refresh</button>
        </header>
        {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button></div>}
        <section className="region-summary-grid">
          <div className="dashboard-stat-card"><span>Total wilayah</span><strong>{regions.length}</strong><small><MapPinned size={14} /> Terdaftar di database</small></div>
          <div className="dashboard-stat-card"><span>Total peserta</span><strong>{regions.reduce((sum, region) => sum + region.participantCount, 0)}</strong><small><Users size={14} /> Semua wilayah</small></div>
          <div className="dashboard-stat-card"><span>Total setoran</span><strong>{money(regions.reduce((sum, region) => sum + region.paidAmount, 0))}</strong><small><WalletCards size={14} /> Terhimpun</small></div>
        </section>
        <section className="region-setup-grid">
          <form className="dashboard-panel region-setup-card" onSubmit={createRegion}><div className="dashboard-panel-heading"><div><span className="panel-kicker">Setup wilayah</span><h2><MapPinned size={17} /> Tambah wilayah</h2></div></div><label>Nama wilayah<input value={regionForm.name} onChange={(event) => setRegionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Area Timur" /></label><label>Kode wilayah<input value={regionForm.code} onChange={(event) => setRegionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="TIMUR" /></label><button className="btn btn-primary full" disabled={saving}><MapPinned size={15} /> Simpan wilayah</button></form>
          <form className="dashboard-panel region-setup-card" onSubmit={createManager}><div className="dashboard-panel-heading"><div><span className="panel-kicker">Akun operasional</span><h2>{editingManagerId ? <Pencil size={17} /> : <UserPlus size={17} />} {editingManagerId ? 'Edit akun manager' : 'Tambah manager parsel'}</h2></div>{editingManagerId && <button type="button" className="region-cancel-button" onClick={() => { setEditingManagerId(null); setManagerForm({ name: '', email: '', password: '', phone: '', regionId: '' }); }} title="Batal edit" aria-label="Batal edit"><X size={15} /></button>}</div><div className="form-two-columns"><label>Nama manager<input value={managerForm.name} onChange={(event) => setManagerForm((current) => ({ ...current, name: event.target.value }))} placeholder="Andi Pratama" /></label><label>No. HP<input value={managerForm.phone} onChange={(event) => setManagerForm((current) => ({ ...current, phone: event.target.value }))} placeholder="08..." /></label></div><label>Email login<input type="email" value={managerForm.email} onChange={(event) => setManagerForm((current) => ({ ...current, email: event.target.value }))} placeholder="andi@glosir.com" /></label><label>Password {editingManagerId ? '(isi hanya jika ingin reset)' : 'awal'}<input type="password" minLength="6" value={managerForm.password} onChange={(event) => setManagerForm((current) => ({ ...current, password: event.target.value }))} placeholder="Minimal 6 karakter" /></label><label>Wilayah<select value={managerForm.regionId} onChange={(event) => setManagerForm((current) => ({ ...current, regionId: event.target.value }))}><option value="">Pilih wilayah</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name} ({region.code})</option>)}</select></label><button className="btn btn-primary full" disabled={saving}>{editingManagerId ? <><Pencil size={15} /> Simpan perubahan</> : <><KeyRound size={15} /> Buat akun & hubungkan</>}</button></form>
        </section>
        <section className="dashboard-panel region-grid-panel">
          <div className="dashboard-panel-heading"><div><span className="panel-kicker">Performance by region</span><h2>Progress wilayah</h2></div></div>
          <div className="region-card-grid">
            {regions.map((region) => <article className="region-card" key={region.id}><div className="region-card-head"><div><strong>{region.name}</strong><small>{region.code} {region.managerName ? `· ${region.managerName}` : '· Belum ada manager'}</small></div><span>{region.progress}%</span></div><div className="region-progress"><i style={{ width: `${region.progress}%` }} /></div><div className="region-card-stats"><span><b>{region.participantCount}</b> peserta</span><span><b>{money(region.paidAmount)}</b> terkumpul</span><span><b>{money(region.managerCommission)}</b> komisi</span></div></article>)}
            {!loading && !regions.length && <div className="dashboard-empty-state">Belum ada wilayah. Buat wilayah pertama melalui API/admin wilayah.</div>}
          </div>
        </section>
        <section className="dashboard-panel manager-accounts-panel">
          <div className="dashboard-panel-heading"><div><span className="panel-kicker">Access management</span><h2>Akun operasional</h2></div><span className="dashboard-panel-total">{managers.length} akun aktif</span></div>
          <div className="manager-account-list">
            {managers.map((manager) => <div className="manager-account-row" key={manager.id}><div className="manager-account-avatar">{manager.name.slice(0, 2).toUpperCase()}</div><div className="manager-account-info"><strong>{manager.name}</strong><small>{manager.email}{manager.phone ? ` · ${manager.phone}` : ''}</small></div><span className={`manager-role-badge ${manager.role === 'PARCEL_MANAGER' ? 'parcel' : 'cashier'}`}>{manager.role === 'PARCEL_MANAGER' ? 'Manager Parsel' : 'Cashier'}</span><span className="manager-region-label">{manager.regionName || 'Belum terhubung wilayah'}</span><div className="manager-account-actions"><button type="button" className="icon-action" onClick={() => editManager(manager)} title="Edit akun" aria-label={`Edit akun ${manager.name}`}><Pencil size={14} /></button><button type="button" className="icon-action icon-action-danger" onClick={() => removeManager(manager)} title="Nonaktifkan akun" aria-label={`Nonaktifkan akun ${manager.name}`}><Trash2 size={14} /></button></div></div>)}
            {!loading && !managers.length && <div className="dashboard-empty-state">Belum ada akun operasional. Buat akun manager dari form di atas.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
