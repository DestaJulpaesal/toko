import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDollarSign, MapPinned, Plus, RefreshCw, Target, UserPlus, Users, WalletCards } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import ModalForm from '../components/ModalForm';
import { apiFetch } from '../services/api';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function AdminParcelRegionsPage() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [regionForm, setRegionForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);
  const [activeForm, setActiveForm] = useState(null);
  const totalParticipants = regions.reduce((sum, region) => sum + Number(region.participantCount || 0), 0);
  const totalTarget = regions.reduce((sum, region) => sum + Number(region.targetAmount || 0), 0);
  const totalPaid = regions.reduce((sum, region) => sum + Number(region.paidAmount || 0), 0);
  const totalRemaining = Math.max(totalTarget - totalPaid, 0);

  const loadRegions = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/parcel-regions');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Wilayah gagal dimuat.');
      setRegions(data.regions || []);
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
      setRegionForm({ name: '', code: '' }); setActiveForm(null); setNotice('Wilayah berhasil dibuat.'); await loadRegions();
    } catch (error) { setNotice(error.message); } finally { setSaving(false); }
  };

  return (
    <AdminShell active="Wilayah Parsel" mainClassName="parcel-region-workspace">
        <header className="admin-header region-page-header">
          <div><p className="eyebrow light">Pengelolaan wilayah</p><h1>Wilayah Parsel</h1><p className="admin-subtitle">Atur area penagihan dan pantau setoran parsel. Pengelolaan akun petugas tersedia di halaman Akun & Akses.</p></div>
          <button type="button" className="btn btn-secondary" onClick={loadRegions} disabled={loading}><RefreshCw size={15} className={loading ? 'region-refreshing' : ''} /> {loading ? 'Memuat...' : 'Muat ulang'}</button>
        </header>
        {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button></div>}
        <section className="region-steps" aria-label="Panduan mengelola wilayah">
          <div><span>1</span><p><strong>Buat wilayah</strong><small>Contoh: Area Timur</small></p></div>
          <i aria-hidden="true" />
          <div><span>2</span><p><strong>Hubungkan petugas</strong><small>Atur akun manager di Akun & Akses</small></p></div>
          <i aria-hidden="true" />
          <div><span>3</span><p><strong>Pantau setoran</strong><small>Lihat progres dan sisa target</small></p></div>
        </section>
        <section className="region-summary-grid">
          <div className="dashboard-stat-card"><span className="region-stat-icon"><MapPinned size={16} /></span><span>Total wilayah</span><strong>{regions.length}</strong><small>Wilayah terdaftar</small></div>
          <div className="dashboard-stat-card"><span className="region-stat-icon is-blue"><Users size={16} /></span><span>Total peserta</span><strong>{totalParticipants}</strong><small>Peserta di semua wilayah</small></div>
          <div className="dashboard-stat-card"><span className="region-stat-icon is-green"><WalletCards size={16} /></span><span>Total setoran</span><strong>{money(totalPaid)}</strong><small>Sudah terkumpul</small></div>
          <div className="dashboard-stat-card"><span className="region-stat-icon is-amber"><Target size={16} /></span><span>Sisa target</span><strong>{money(totalRemaining)}</strong><small>Dari target {money(totalTarget)}</small></div>
        </section>
        <section className="region-management-toolbar" aria-label="Aksi pengelolaan wilayah">
          <div><span className="panel-kicker">Kelola wilayah</span><strong>Atur area penagihan parsel</strong></div>
          <div className="region-management-actions">
            <button type="button" className="btn btn-secondary" onClick={() => { setRegionForm({ name: '', code: '' }); setNotice(''); setActiveForm('region'); }}><Plus size={16} /> Tambah wilayah</button>
            <Link className="btn btn-primary" to="/admin/accounts"><UserPlus size={16} /> Kelola akun petugas</Link>
          </div>
        </section>
        <section className="region-data-grid">
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
            {!loading && !regions.length && <div className="region-empty-state"><MapPinned size={24} /><strong>Belum ada wilayah parsel</strong><span>Mulai dengan menambahkan wilayah melalui tombol “Tambah wilayah”.</span></div>}
            {loading && <div className="region-empty-state" role="status">Memuat data wilayah...</div>}
          </div>
        </section>
        </section>
        <ModalForm
          isOpen={activeForm === 'region'}
          onClose={() => setActiveForm(null)}
          title="Tambah wilayah parsel"
          subtitle="Buat area untuk mengelompokkan peserta dan setoran."
          kicker="Lokasi penagihan"
          maxWidth="540px"
          cardClassName="region-modal-card"
        >
          <form className="region-setup-card region-modal-form" onSubmit={createRegion}>
            {notice && <div className="region-modal-notice" role="alert">{notice}</div>}
            <label>Nama wilayah<input required maxLength="80" autoFocus value={regionForm.name} onChange={(event) => setRegionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Area Timur" /></label>
            <label>Kode wilayah<input required maxLength="20" value={regionForm.code} onChange={(event) => setRegionForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="Contoh: TIMUR" /><small>Kode singkat untuk membedakan wilayah.</small></label>
            <div className="region-modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setActiveForm(null)}>Batal</button><button className="btn btn-primary" disabled={saving || loading}><MapPinned size={15} /> {saving ? 'Menyimpan...' : 'Simpan wilayah'}</button></div>
          </form>
        </ModalForm>
      </AdminShell>
  );
}
