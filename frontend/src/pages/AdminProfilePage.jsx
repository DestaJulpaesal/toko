import { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', email: '', phone: '', headline: '', story: '' };

export default function AdminProfilePage() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState({});
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'CASHIER', phone: '' });

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/site-profile');
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Profil gagal dimuat.');
      setForm(data.profile);
    } catch (error) {
      setNotice(error.message || 'Profil gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    apiFetch('/auth/me/notification-preferences').then((response) => response.json()).then((data) => {
      if (data.success) setNotificationPreferences(data.preferences);
    }).catch(() => {});
  }, []);
  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        setForm((current) => ({ ...current, photoUrl: canvas.toDataURL('image/jpeg', 0.82) }));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!await confirmAction('Yakin ingin menyimpan perubahan profil publik?')) return;
    setSaving(true);
    try {
      const response = await apiFetch('/site-profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Profil gagal disimpan.');
      setForm(data.profile);
      setNotice('Profil pemilik berhasil disimpan dan akan tampil di website publik.');
    } catch (error) {
      setNotice(error.message || 'Profil gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationPreferences = async () => {
    const response = await apiFetch('/auth/me/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationPreferences),
    });
    const data = await response.json();
    if (data.success) setNotificationPreferences(data.preferences);
  };

  const inviteEmployee = async (event) => {
    event.preventDefault();
    const response = await apiFetch('/auth/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });
    const data = await response.json();
    setNotice(data.message || 'Undangan belum berhasil dikirim.');
    if (data.success) setInviteForm({ name: '', email: '', role: 'CASHIER', phone: '' });
  };

  return (
    <div className="admin-shell admin-crud-shell">
      <AdminSidebar active="Profil" />
      <main className="admin-main">
        <header className="admin-header"><div><p className="eyebrow light">Public identity</p><h1>Profil Pemilik</h1><p className="admin-subtitle">Informasi ini akan tampil di halaman Profil website publik.</p></div><span className={`database-status ${loading ? 'loading' : 'ready'}`}><i /> {loading ? 'Memuat data' : 'Terhubung ke API'}</span></header>
        {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup notifikasi">x</button></div>}
        <form className="crud-form-panel profile-settings-form" onSubmit={submitForm}>
          <div className="panel-heading"><div><span className="panel-kicker">Website publik</span><h2>Identitas Glosir</h2></div></div>
          <div className="form-two-columns"><label>Nama pemilik<input name="name" value={form.name} onChange={updateField} placeholder="Nama pemilik" required /></label><label>Email<input name="email" value={form.email} onChange={updateField} type="email" placeholder="email@glosir.com" required /></label></div>
          <label>Nomor WhatsApp<input name="phone" value={form.phone} onChange={updateField} placeholder="081234567890" inputMode="tel" required /></label>
          <label>Foto pemilik<input type="file" accept="image/*" onChange={handlePhoto} /></label>
          {form.photoUrl && <img className="profile-photo-preview" src={form.photoUrl} alt="Preview foto pemilik" />}
          <label>Headline profil<input name="headline" value={form.headline} onChange={updateField} placeholder="Cerita singkat tentang usaha" required /></label>
          <label>Deskripsi usaha<textarea name="story" value={form.story} onChange={updateField} rows="6" placeholder="Ceritakan Glosir kepada pelanggan" required /></label>
          <button className="btn btn-primary" type="submit" disabled={loading || saving}>{saving ? 'Menyimpan...' : 'Simpan profil publik'}</button>
        </form>
        <section className="crud-form-panel profile-settings-form">
          <div className="panel-heading"><div><span className="panel-kicker">Email</span><h2>Pilih notifikasi</h2></div></div>
          {[
            ['criticalStock', 'Stok kritis atau hampir habis'],
            ['overdueDebt', 'Piutang jatuh tempo'],
            ['newOnlineOrder', 'Pesanan online baru'],
            ['onlinePayment', 'Pembayaran online berhasil atau gagal'],
            ['dailySummary', 'Ringkasan omzet harian'],
            ['backupFailure', 'Backup gagal'],
            ['newDeviceLogin', 'Login dari perangkat baru'],
          ].map(([key, label]) => <label key={key} className="login-remember"><input type="checkbox" checked={Boolean(notificationPreferences[key])} onChange={(event) => setNotificationPreferences((current) => ({ ...current, [key]: event.target.checked }))} /> {label}</label>)}
          <button className="btn btn-primary" type="button" onClick={saveNotificationPreferences}>Simpan pilihan notifikasi</button>
        </section>
        <form className="crud-form-panel profile-settings-form" onSubmit={inviteEmployee}>
          <div className="panel-heading"><div><span className="panel-kicker">Akun karyawan</span><h2>Undang karyawan</h2></div></div>
          <div className="form-two-columns">
            <label>Nama karyawan<input required value={inviteForm.name} onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nama lengkap" /></label>
            <label>Email pribadi<input required type="email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="nama@email.com" /></label>
          </div>
          <div className="form-two-columns">
            <label>Nomor WhatsApp<input value={inviteForm.phone} onChange={(event) => setInviteForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Opsional" /></label>
            <label>Peran<select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}><option value="CASHIER">Kasir</option><option value="ADMIN">Admin</option><option value="PARCEL_MANAGER">Pengelola Parsel</option></select></label>
          </div>
          <button className="btn btn-primary" type="submit">Kirim undangan email</button>
        </form>
      </main>
    </div>
  );
}
