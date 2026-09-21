import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../services/api';

export default function AuthActionPage({ action }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(action === 'verify');

  useEffect(() => {
    if (action !== 'verify') return undefined;
    apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((data) => setMessage(data.message || 'Verifikasi email selesai.'))
      .catch(() => setMessage('Verifikasi belum bisa diproses. Coba lagi nanti.'))
      .finally(() => setLoading(false));
    return undefined;
  }, [action, token]);

  const submitReset = async (event) => {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage('Password baru dan ulangi password harus sama.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password, passwordConfirmation: confirmation }),
        silentNotify: true,
      });
      const data = await response.json();
      setMessage(data.message || 'Password berhasil diubah.');
    } catch {
      setMessage('Password belum berhasil diubah. Periksa koneksi internet lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel auth-action-panel">
        <span className="eyebrow dark">Keamanan akun</span>
        <h1>{action === 'verify' ? 'Verifikasi email' : 'Buat password baru'}</h1>
        {action === 'verify' ? <p>{loading ? 'Sedang memeriksa tautan...' : message}</p> : (
          <form onSubmit={submitReset} className="login-form">
            <label>Password baru<input type="password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" /></label>
            <label>Ulangi password<input type="password" minLength="8" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Ketik ulang password" /></label>
            <button className="btn btn-primary login-submit" type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan password'}</button>
            {message && <p className="login-message error">{message}</p>}
          </form>
        )}
        <Link to="/login" className="login-back">Kembali ke halaman masuk</Link>
      </section>
    </main>
  );
}
