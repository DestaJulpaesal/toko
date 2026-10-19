import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { confirmAction } from '../utils/confirmService';
import { apiFetch, monitorSessionExpiry } from '../services/api';
import { clearStaffCaches } from '../utils/catalogStorage';

const emptyForm = { name: '', email: '', phone: '', headline: '', story: '' };

export default function AdminProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState({});
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'CASHIER', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', passwordConfirmation: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [sessionAction, setSessionAction] = useState('');

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

  const logoutOtherDevices = async () => {
    if (!await confirmAction('Keluarkan semua perangkat lain dari akun ini? Perangkat yang sedang dipakai tetap masuk.')) return;
    setSessionAction('others');
    setNotice('');
    try {
      const response = await apiFetch('/auth/logout-others', { method: 'POST', silentNotify: true });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Belum berhasil. Coba lagi sebentar.');
      // Perangkat ini menerima token baru supaya tidak ikut keluar.
      if (data.token) {
        localStorage.setItem('glosir_token', data.token);
        monitorSessionExpiry();
      }
      setNotice(data.message || 'Semua perangkat lain sudah dikeluarkan.');
    } catch (error) {
      setNotice(error.message || 'Belum berhasil. Coba lagi sebentar.');
    } finally {
      setSessionAction('');
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.passwordConfirmation) {
      setNotice('Password baru dan konfirmasi password harus sama.');
      return;
    }

    setPasswordSaving(true);
    setNotice('');
    try {
      const response = await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
        silentNotify: true,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Password gagal diganti.');
      if (!data.token) throw new Error('Password berhasil diubah, tetapi sesi baru tidak diterima. Silakan login kembali.');
      localStorage.setItem('glosir_token', data.token);
      monitorSessionExpiry();
      setPasswordForm({ newPassword: '', passwordConfirmation: '' });
      setNotice(data.message || 'Password berhasil diganti.');
    } catch (error) {
      setNotice(error.message || 'Password gagal diganti. Coba lagi.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const logoutAllDevices = async () => {
    if (!await confirmAction('Keluarkan semua perangkat, termasuk perangkat ini? Anda harus login kembali.')) return;
    setSessionAction('all');
    setNotice('');
    try {
      const response = await apiFetch('/auth/logout-all', { method: 'POST', silentNotify: true });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Belum berhasil mengeluarkan semua perangkat.');
      localStorage.removeItem('glosir_token');
      localStorage.removeItem('glosir_user');
      clearStaffCaches();
      navigate('/login', { replace: true });
    } catch (error) {
      setNotice(error.message || 'Belum berhasil mengeluarkan semua perangkat.');
    } finally {
      setSessionAction('');
    }
  };

  return (
    <AdminShell active="Profil" className="admin-crud-shell" mainClassName="admin-profile-page">
        <header className="admin-header profile-page-header"><div><p className="eyebrow light">PENGATURAN AKUN</p><h1>Profil & Pengaturan</h1><p className="admin-subtitle">Kelola informasi website, notifikasi, keamanan, dan akun tim.</p></div><span className={`database-status ${loading ? 'loading' : 'ready'}`}><i /> {loading ? 'Memuat data' : 'Profil terhubung'}</span></header>
        {notice && <div className="crud-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tutup notifikasi">x</button></div>}
        <form className="crud-form-panel profile-settings-form profile-identity-card" onSubmit={submitForm}>
          <div className="panel-heading"><div><span className="panel-kicker">Website publik</span><h2>Identitas Glosir</h2><p>Informasi ini akan tampil pada halaman profil toko.</p></div></div>
          <div className="form-two-columns"><label>Nama pemilik<input name="name" value={form.name} onChange={updateField} placeholder="Nama pemilik" required /></label><label>Email<input name="email" value={form.email} onChange={updateField} type="email" placeholder="email@glosir.com" required /></label></div>
          <div className="profile-contact-fields">
            <label>Nomor WhatsApp<input name="phone" value={form.phone} onChange={updateField} placeholder="081234567890" inputMode="tel" required /></label>
            <label>Foto pemilik<input type="file" accept="image/*" onChange={handlePhoto} /></label>
            {form.photoUrl && <img className="profile-photo-preview" src={form.photoUrl} alt="Preview foto pemilik" />}
          </div>
          <label>Headline profil<input name="headline" value={form.headline} onChange={updateField} placeholder="Cerita singkat tentang usaha" required /></label>
          <label>Deskripsi usaha<textarea name="story" value={form.story} onChange={updateField} rows="6" placeholder="Ceritakan Glosir kepada pelanggan" required /></label>
          <button className="btn btn-primary" type="submit" disabled={loading || saving}>{saving ? 'Menyimpan...' : 'Simpan profil publik'}</button>
        </form>
        <section className="crud-form-panel profile-settings-form profile-notification-card">
          <div className="panel-heading"><div><span className="panel-kicker">EMAIL</span><h2>Notifikasi</h2><p>Pilih kabar penting yang ingin diterima.</p></div></div>
          <div className="notification-preferences-list">
            {[
              ['criticalStock', 'Stok kritis atau hampir habis'],
              ['overdueDebt', 'Piutang jatuh tempo'],
              ['newOnlineOrder', 'Pesanan online baru'],
              ['onlinePayment', 'Pembayaran online berhasil atau gagal'],
              ['dailySummary', 'Ringkasan omzet harian'],
              ['backupFailure', 'Backup gagal'],
              ['newDeviceLogin', 'Login dari perangkat baru'],
            ].map(([key, label]) => (
              <label key={key} className="notification-preference-option">
                <input
                  type="checkbox"
                  checked={Boolean(notificationPreferences[key])}
                  onChange={(event) => setNotificationPreferences((current) => ({ ...current, [key]: event.target.checked }))}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button className="btn btn-primary" type="button" onClick={saveNotificationPreferences}>Simpan pilihan notifikasi</button>
        </section>
        <section className="crud-form-panel profile-settings-form profile-security-card">
          <div className="panel-heading"><div><span className="panel-kicker">KEAMANAN</span><h2>Keamanan akun</h2><p>Jaga akses akun dan sesi perangkat tetap aman.</p></div></div>
          <form onSubmit={changePassword}>
            <div className="form-two-columns">
              <label>Password baru<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} placeholder="Minimal 8 karakter" /></label>
              <label>Ulangi password baru<input type="password" autoComplete="new-password" minLength={8} required value={passwordForm.passwordConfirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, passwordConfirmation: event.target.value }))} placeholder="Ketik ulang password baru" /></label>
            </div>
            <button className="btn btn-primary" type="submit" disabled={passwordSaving}>{passwordSaving ? 'Mengganti password...' : 'Ganti password'}</button>
          </form>
          <hr />
          <h3>Kelola sesi login</h3>
          <p>Kalau HP atau komputer pernah hilang, dipinjam, atau lupa logout, tekan tombol ini. Semua perangkat lain harus masuk lagi dengan password.</p>
          <div className="form-two-columns">
            <button className="btn btn-secondary" type="button" disabled={Boolean(sessionAction)} onClick={logoutOtherDevices}>Keluarkan perangkat lain</button>
            <button className="btn btn-secondary" type="button" disabled={Boolean(sessionAction)} onClick={logoutAllDevices}>{sessionAction === 'all' ? 'Mengeluarkan perangkat...' : 'Keluarkan semua perangkat'}</button>
          </div>
        </section>
        <form className="crud-form-panel profile-settings-form profile-invite-card" onSubmit={inviteEmployee}>
          <div className="panel-heading"><div><span className="panel-kicker">TIM GLOSIR</span><h2>Undang karyawan</h2><p>Kirim undangan agar anggota tim dapat mengakses sistem.</p></div></div>
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
      </AdminShell>
  );
}
