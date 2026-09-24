import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verify = async () => {
      const token = searchParams.get('token');
      if (!token) {
        setStatus('error');
        setMessage('Tautan verifikasi tidak lengkap atau tidak valid.');
        return;
      }

      try {
        const response = await apiFetch('/auth/verify-email', {
          method: 'GET',
          silentNotify: true,
        }, new URLSearchParams({ token }));

        const data = await response.json();

        if (!data.success) {
          setStatus('error');
          setMessage(data.message || 'Verifikasi email gagal. Tautan mungkin sudah kedaluwarsa.');
          return;
        }

        setStatus('success');
        setMessage('Email Anda berhasil diverifikasi!');
        
        // Redirect ke login setelah 3 detik
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (error) {
        setStatus('error');
        setMessage('Terjadi kesalahan saat memverifikasi email. Coba lagi atau hubungi admin.');
        console.error('Email verification error:', error);
      }
    };

    verify();
  }, [searchParams, navigate]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <div style={styles.spinner} />
            <h2 style={styles.title}>Memverifikasi Email...</h2>
            <p style={styles.subtitle}>Tunggu sebentar, kami sedang memverifikasi email Anda.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ ...styles.icon, color: '#4CAF50', fontSize: '48px' }}>✓</div>
            <h2 style={styles.title}>Email Berhasil Diverifikasi!</h2>
            <p style={styles.subtitle}>{message}</p>
            <p style={styles.redirectText}>Anda akan diarahkan ke halaman login dalam beberapa detik...</p>
            <Link to="/login" style={styles.link}>
              Kembali ke Login Sekarang
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ ...styles.icon, color: '#d32f2f', fontSize: '48px' }}>✗</div>
            <h2 style={styles.title}>Verifikasi Email Gagal</h2>
            <p style={styles.subtitle}>{message}</p>
            <div style={styles.actions}>
              <Link to="/login" style={styles.primaryButton}>
                Kembali ke Login
              </Link>
              <Link to="/login" style={styles.secondaryButton}>
                Minta Ulang Verifikasi
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
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #f0f0f0',
    borderTop: '4px solid #1976d2',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 1s linear infinite',
  },
  icon: {
    display: 'block',
    marginBottom: '20px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#333',
    margin: '20px 0 10px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '10px 0 20px',
    lineHeight: '1.5',
  },
  redirectText: {
    fontSize: '13px',
    color: '#999',
    margin: '20px 0',
  },
  link: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '10px 20px',
    background: '#1976d2',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: '500',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '30px',
  },
  primaryButton: {
    padding: '12px 20px',
    background: '#1976d2',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: '500',
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '12px 20px',
    background: '#f0f0f0',
    color: '#333',
    textDecoration: 'none',
    borderRadius: '4px',
    fontWeight: '500',
    fontSize: '14px',
    border: '1px solid #ddd',
    cursor: 'pointer',
  },
};
