import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // form, success, error
  const [token, setToken] = useState('');
  const [form, setForm] = useState({
    newPassword: '',
    passwordConfirmation: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (!tokenFromUrl) {
      setStep('error');
      setMessage('Tautan reset password tidak lengkap atau tidak valid.');
      return;
    }
    setToken(tokenFromUrl);
  }, [searchParams]);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    // Validasi
    if (!form.newPassword || !form.passwordConfirmation) {
      setMessage('Password dan ulangi password wajib diisi.');
      setLoading(false);
      return;
    }

    if (form.newPassword.length < 8) {
      setMessage('Password minimal 8 karakter.');
      setLoading(false);
      return;
    }

    if (form.newPassword !== form.passwordConfirmation) {
      setMessage('Password dan ulangi password harus sama.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: form.newPassword,
          passwordConfirmation: form.passwordConfirmation,
        }),
        silentNotify: true,
      });

      const data = await response.json();

      if (!data.success) {
        setStep('error');
        setMessage(data.message || 'Password gagal direset. Tautan mungkin sudah kedaluwarsa.');
        setLoading(false);
        return;
      }

      setStep('success');
      setMessage('Password berhasil dibuat!');
      setLoading(false);

      // Redirect ke login setelah 3 detik
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setStep('error');
      setMessage('Terjadi kesalahan. Coba lagi atau hubungi admin.');
      setLoading(false);
      console.error('Password reset error:', error);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {step === 'form' && (
          <>
            <h2 style={styles.title}>Buat Password Baru</h2>
            <p style={styles.subtitle}>Masukkan password baru untuk akun Glosir Anda.</p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Password Baru</label>
                <div style={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={form.newPassword}
                    onChange={handleChange}
                    placeholder="Minimal 8 karakter"
                    style={styles.input}
                    minLength="8"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.toggleButton}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                <small style={styles.hint}>
                  ✓ Gunakan kombinasi huruf, angka, dan simbol untuk keamanan lebih baik
                </small>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Ulangi Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="passwordConfirmation"
                  value={form.passwordConfirmation}
                  onChange={handleChange}
                  placeholder="Ulangi password"
                  style={styles.input}
                  minLength="8"
                  required
                />
              </div>

              {message && (
                <div style={styles.message}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.button,
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Memproses...' : 'Buat Password Baru'}
              </button>
            </form>

            <p style={styles.helpText}>
              Ingat password Anda? <Link to="/login" style={styles.linkText}>Masuk sekarang</Link>
            </p>
          </>
        )}

        {step === 'success' && (
          <>
            <div style={{ ...styles.icon, color: '#4CAF50' }}>✓</div>
            <h2 style={styles.title}>Password Berhasil Dibuat!</h2>
            <p style={styles.subtitle}>Akun Anda sudah siap digunakan.</p>
            <p style={styles.redirectText}>Anda akan diarahkan ke halaman login dalam beberapa detik...</p>
            <Link to="/login" style={styles.primaryButton}>
              Masuk Sekarang
            </Link>
          </>
        )}

        {step === 'error' && (
          <>
            <div style={{ ...styles.icon, color: '#d32f2f' }}>✗</div>
            <h2 style={styles.title}>Reset Password Gagal</h2>
            <p style={styles.subtitle}>{message}</p>
            <div style={styles.actions}>
              <Link to="/login" style={styles.primaryButton}>
                Kembali ke Login
              </Link>
              <Link to="/login" style={styles.secondaryButton}>
                Minta Reset Password Lagi
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f5f5f5',
    padding: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '8px',
    padding: '40px 30px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxWidth: '450px',
    width: '100%',
  },
  icon: {
    display: 'block',
    fontSize: '48px',
    marginBottom: '20px',
    textAlign: 'center',
  },
  title: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#333',
    margin: '0 0 10px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '10px 0 30px',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '10px 40px 10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  toggleButton: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
  },
  hint: {
    fontSize: '12px',
    color: '#999',
    margin: '4px 0 0',
  },
  message: {
    padding: '12px',
    background: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    fontSize: '13px',
  },
  button: {
    padding: '12px',
    fontSize: '15px',
    fontWeight: '600',
    background: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  primaryButton: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '12px 20px',
    background: '#1976d2',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: '500',
    fontSize: '14px',
    textAlign: 'center',
  },
  secondaryButton: {
    display: 'inline-block',
    padding: '12px 20px',
    background: '#f0f0f0',
    color: '#333',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: '500',
    fontSize: '14px',
    border: '1px solid #ddd',
    textAlign: 'center',
    marginTop: '10px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '30px',
  },
  redirectText: {
    fontSize: '13px',
    color: '#999',
    margin: '20px 0',
    textAlign: 'center',
  },
  helpText: {
    fontSize: '13px',
    color: '#666',
    textAlign: 'center',
    margin: '20px 0 0',
  },
  linkText: {
    color: '#1976d2',
    textDecoration: 'none',
    fontWeight: '500',
  },
};
