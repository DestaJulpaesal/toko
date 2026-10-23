import { useEffect, useState } from 'react';
import AdminShell from '../layouts/AdminShell';
import { confirmAction } from '../utils/confirmService';
import { apiFetch } from '../services/api';

const emptyForm = { name: '', email: '', phone: '', headline: '', story: '' };

export default function AdminProfilePage() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState({});

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

  return (
    <AdminShell active="Profil" className="admin-crud-shell" mainClassName="admin-profile-page">
        <header className="admin-header profile-page-header"><div><p className="eyebrow light">PENGATURAN TOKO</p><h1>Profil & Pengaturan</h1><p className="admin-subtitle">Kelola informasi website dan pilihan notifikasi akun.</p></div><span className={`database-status ${loading ? 'loading' : 'ready'}`}><i /> {loading ? 'Memuat data' : 'Profil terhubung'}</span></header>
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
      </AdminShell>
  );
}
