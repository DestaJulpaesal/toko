import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';

export default function LoginPage() {
  const [form, setForm] = useState({ email: 'cashier@glosir.com', password: '123456' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectDemo = (email) => {
    setForm({ email, password: '123456' });
    setMessage('');
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

          <form onSubmit={handleSubmit} className="login-form">
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
            <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
              {loading ? 'Memproses login...' : 'Masuk ke sistem'}
            </button>
          </form>

          {message && (
            <p className={`login-message ${message.startsWith('Login berhasil') ? 'success' : 'error'}`}>
              {message}
            </p>
          )}

          <div className="demo-accounts-box">
            <span className="demo-title">Pilih Akun Demo Cepat:</span>
            <div className="demo-chips">
              <button
                type="button"
                className={`demo-chip ${form.email === 'cashier@glosir.com' ? 'active' : ''}`}
                onClick={() => handleSelectDemo('cashier@glosir.com')}
              >
                <strong>Karyawan / Kasir</strong>
                <small>cashier@glosir.com</small>
              </button>
              <button
                type="button"
                className={`demo-chip ${form.email === 'owner@glosir.com' ? 'active' : ''}`}
                onClick={() => handleSelectDemo('owner@glosir.com')}
              >
                <strong>Owner / Admin</strong>
                <small>owner@glosir.com</small>
              </button>
            </div>
            <p className="demo-hint">Password demo: <code>123456</code></p>
          </div>

          <Link to="/" className="login-back">← Kembali ke website utama</Link>
        </section>
      </div>
    </div>
  );
}
