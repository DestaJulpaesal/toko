import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, monitorSessionExpiry } from '../services/api';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '', rememberMe: false });
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const googleButtonRef = useRef(null);
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!data.success) {
        setMessage(data.message || 'Login gagal');
        setLoading(false);
        return;
      }

      localStorage.setItem('glosir_token', data.token);
      localStorage.setItem('glosir_user', JSON.stringify(data.user));
      monitorSessionExpiry();

      if (data.mustChangePassword) {
        setForcePasswordChange(true);
        setMessage('Demi keamanan, buat password baru sebelum melanjutkan.');
        setLoading(false);
        return;
      }

      if (data.emailVerificationRequired) {
        setVerificationRequired(true);
        setMessage('Verifikasi email dulu. Tautan verifikasi akan dikirim ke email akun.');
        setLoading(false);
        return;
      }

      const roleLabel = data.user.role === 'OWNER' ? 'Owner / Admin' : 'Karyawan / Kasir';
      setMessage(`Login berhasil sebagai ${roleLabel}. Mengalihkan...`);

      setTimeout(() => {
        if (data.user.role === 'OWNER') {
          window.location.href = '/admin';
        } else if (data.user.role === 'PARCEL_MANAGER') {
          window.location.href = '/parcel-manager';
        } else {
          window.location.href = '/kasir';
        }
      }, 500);
    } catch (error) {
      setMessage('Backend belum berjalan. Jalankan server backend di port 5000 lalu coba lagi.');
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (response) => {
    setLoading(true);
    setMessage('Memeriksa akun Google...');
    try {
      const result = await apiFetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
        silentNotify: true,
      });
      const data = await result.json();
      if (!result.ok || !data.success) {
        setMessage(data.message || 'Login Google belum berhasil.');
        setLoading(false);
        return;
      }
      localStorage.setItem('glosir_token', data.token);
      localStorage.setItem('glosir_user', JSON.stringify(data.user));
      monitorSessionExpiry();
      setMessage('Login Google berhasil. Mengalihkan...');
      window.location.href = data.user.role === 'OWNER' || data.user.role === 'ADMIN' ? '/admin' : data.user.role === 'PARCEL_MANAGER' ? '/parcel-manager' : '/kasir';
    } catch {
      setMessage('Login Google belum berhasil. Periksa koneksi internet lalu coba lagi.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;
    let attempts = 0;
    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        attempts += 1;
        if (attempts >= 100) window.clearInterval(timer);
        return;
      }
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', width: 320, text: 'signin_with', locale: 'id' });
      window.clearInterval(timer);
    };
    const timer = window.setInterval(renderGoogleButton, 100);
    renderGoogleButton();
    return () => window.clearInterval(timer);
  }, [googleClientId]);

  const resendVerification = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/auth/request-verification', { method: 'POST', silentNotify: true });
      const data = await response.json();
      setMessage(data.message || 'Tautan verifikasi sudah dikirim.');
    } catch {
      setMessage('Tautan verifikasi belum bisa dikirim. Coba lagi sebentar.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (newPassword !== passwordConfirmation) {
      setMessage('Password baru dan ulangi password harus sama.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, passwordConfirmation }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.message || 'Password belum berhasil diganti.');
        setLoading(false);
        return;
      }
      setForcePasswordChange(false);
      setMessage('Password berhasil diganti. Mengalihkan...');
      const user = JSON.parse(localStorage.getItem('glosir_user') || '{}');
      window.location.href = user.role === 'OWNER' || user.role === 'ADMIN' ? '/admin' : '/kasir';
    } catch {
      setMessage('Password belum berhasil diganti. Periksa koneksi internet lalu coba lagi.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email) {
      setMessage('Isi email terlebih dahulu, lalu pilih lupa password.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch('/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
        silentNotify: true,
      });
      const data = await response.json();
      setMessage(data.message || 'Jika email terdaftar, tautan reset password sudah dikirim.');
      setResetRequested(true);
    } catch {
      setMessage('Permintaan reset belum bisa diproses. Coba lagi sebentar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-story">
          <Link to="/" className="login-brand">Glosir</Link>
          <div className="login-story-copy">
            <span className="pill">Portal Internal Glosir</span>
            <h1>Kelola usaha dengan lebih tenang.</h1>
            <p>Ruang kerja kasir & manajemen toko untuk kemudahan transaksi harian, pelanggan, dan laporan.</p>
          </div>
          <div className="login-note">
            <strong>Rapi di depan, lancar di belakang.</strong>
            <span>Karyawan memiliki akses langsung ke Kasir (POS) & Data Pelanggan. Owner memiliki akses penuh.</span>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-panel-head">
            <span className="eyebrow dark">Portal Karyawan & Admin</span>
            <h2>Masuk ke akunmu</h2>
            <p>Gunakan akun Karyawan / Kasir atau Owner untuk melanjutkan.</p>
          </div>

          {!forcePasswordChange && <form onSubmit={handleSubmit} className="login-form">
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="nama@glosir.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="Masukkan password"
              />
            </label>
            <label className="login-remember"><input name="rememberMe" type="checkbox" checked={form.rememberMe} onChange={(event) => setForm((current) => ({ ...current, rememberMe: event.target.checked }))} /> Ingat saya di perangkat ini</label>
            <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
              {loading ? 'Memproses login...' : 'Masuk ke sistem'}
            </button>
            <button type="button" className="login-back" onClick={handleForgotPassword} disabled={loading || resetRequested}>
              {resetRequested ? 'Tautan reset sudah diminta' : 'Lupa password?'}
            </button>
            {googleClientId && <><div className="login-divider"><span>atau</span></div><div ref={googleButtonRef} className="google-login-button" /></>}
          </form>}

          {forcePasswordChange && (
            <form onSubmit={handleChangePassword} className="login-form">
              <label>
                Password baru
                <input name="newPassword" type="password" minLength="8" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Minimal 8 karakter" />
              </label>
              <label>
                Ulangi password baru
                <input name="passwordConfirmation" type="password" minLength="8" required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Ketik ulang password baru" />
              </label>
              <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
                {loading ? 'Menyimpan password...' : 'Simpan password baru'}
              </button>
            </form>
          )}

          {message && (
            <p className={`login-message ${message.startsWith('Login berhasil') ? 'success' : 'error'}`}>
              {message}
            </p>
          )}

          {verificationRequired && <button type="button" className="btn btn-primary login-submit" onClick={resendVerification} disabled={loading}>Kirim ulang tautan verifikasi</button>}

          <Link to="/" className="login-back">← Kembali ke website utama</Link>
        </section>
      </div>
    </div>
  );
}
