import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

export default function UserSettingsPage() {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState({
    criticalStock: true,
    overdueDebt: true,
    newOnlineOrder: true,
    onlinePayment: true,
    dailySummary: true,
    backupFailure: true,
    newDeviceLogin: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [userRes, prefRes] = await Promise.all([
          apiFetch('/auth/me', { silentNotify: true }),
          apiFetch('/auth/me/notification-preferences', { silentNotify: true }),
        ]);

        const userData = await userRes.json();
        const prefData = await prefRes.json();

        if (userData.success) setUser(userData.user);
        if (prefData.success) setPreferences(prefData.preferences);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handlePreferenceChange = (key) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      const response = await apiFetch('/auth/me/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
        silentNotify: true,
      });

      const data = await response.json();

      if (data.success) {
        setMessage('✓ Pilihan notifikasi berhasil disimpan!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('✗ Gagal menyimpan. Coba lagi.');
      }
    } catch (error) {
      setMessage('✗ Terjadi kesalahan. Coba lagi nanti.');
      console.error('Save preferences error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Memuat pengaturan...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Pengaturan Akun</h1>
          <p style={styles.subtitle}>Kelola preferensi notifikasi dan pengaturan keamanan Anda</p>
        </div>

        {/* User Info Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>📋 Informasi Akun</h2>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <label style={styles.label}>Nama</label>
              <p style={styles.infoValue}>{user?.name}</p>
            </div>
            <div style={styles.infoItem}>
              <label style={styles.label}>Email</label>
              <p style={styles.infoValue}>{user?.email}</p>
            </div>
            <div style={styles.infoItem}>
              <label style={styles.label}>Role</label>
              <p style={styles.infoValue}>
                {user?.role === 'OWNER' ? 'Owner / Admin' : user?.role === 'CASHIER' ? 'Kasir' : user?.role}
              </p>
            </div>
          </div>
        </section>

        {/* Notification Preferences Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🔔 Pilihan Notifikasi Email</h2>
          <p style={styles.sectionSubtitle}>
            Pilih notifikasi mana saja yang ingin dikirim ke email Anda
          </p>

          <div style={styles.preferencesGrid}>
            {[
              { key: 'criticalStock', label: '⚠️ Stok Barang Kritis', desc: 'Saat stok hampir habis' },
              { key: 'overdueDebt', label: '💳 Utang Jatuh Tempo', desc: 'Piutang yang sudah waktunya' },
              { key: 'newOnlineOrder', label: '🛒 Pesanan Online Baru', desc: 'Ada pemesanan baru dari toko online' },
              { key: 'onlinePayment', label: '✅ Status Pembayaran', desc: 'Pembayaran berhasil atau gagal' },
              { key: 'dailySummary', label: '📊 Ringkasan Harian', desc: 'Omzet, stok, dan utang tiap hari' },
              { key: 'backupFailure', label: '💾 Backup Gagal', desc: 'Notifikasi jika backup database gagal' },
              { key: 'newDeviceLogin', label: '🔐 Login Device Baru', desc: 'Saat ada login dari device baru' },
            ].map(({ key, label, desc }) => (
              <label key={key} style={styles.preferenceItem}>
                <input
                  type="checkbox"
                  checked={preferences[key] || false}
                  onChange={() => handlePreferenceChange(key)}
                  style={styles.checkbox}
                />
                <div style={styles.preferenceContent}>
                  <span style={styles.preferenceLabel}>{label}</span>
                  <span style={styles.preferenceDesc}>{desc}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Message */}
        {message && (
          <div
            style={{
              ...styles.message,
              background: message.startsWith('✓') ? '#e8f5e9' : '#ffebee',
              color: message.startsWith('✓') ? '#2e7d32' : '#c62828',
            }}
          >
            {message}
          </div>
        )}

        {/* Save Button */}
        <div style={styles.actions}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...styles.saveButton,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '💾 Menyimpan...' : '💾 Simpan Perubahan'}
          </button>
        </div>

        {/* Security Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🔒 Keamanan</h2>
          <div style={styles.securityItem}>
            <div>
              <h3 style={styles.securityLabel}>Ubah Password</h3>
              <p style={styles.securityDesc}>Ganti password akun Anda untuk keamanan lebih</p>
            </div>
            <button style={styles.secondaryButton}>
              Ubah Password
            </button>
          </div>
          <div style={styles.securityItem}>
            <div>
              <h3 style={styles.securityLabel}>Logout Semua Device</h3>
              <p style={styles.securityDesc}>Keluarkan semua sesi login di device lain (emergency)</p>
            </div>
            <button style={styles.dangerButton}>
              Logout Semua
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    background: '#f5f5f5',
    minHeight: '100vh',
  },
  card: {
    background: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  header: {
    padding: '30px',
    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
    color: 'white',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: '14px',
    opacity: 0.9,
    margin: 0,
  },
  section: {
    padding: '30px',
    borderBottom: '1px solid #eee',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
    margin: '0 0 8px',
  },
  sectionSubtitle: {
    fontSize: '13px',
    color: '#999',
    margin: '0 0 20px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  infoValue: {
    fontSize: '15px',
    color: '#333',
    margin: 0,
  },
  preferencesGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  preferenceItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    background: '#f9f9f9',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '1px solid #eee',
    transition: 'all 0.2s ease',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    marginTop: '2px',
    cursor: 'pointer',
  },
  preferenceContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
  },
  preferenceLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  preferenceDesc: {
    fontSize: '12px',
    color: '#999',
  },
  message: {
    padding: '12px 30px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
  },
  actions: {
    padding: '30px',
    textAlign: 'center',
  },
  saveButton: {
    padding: '12px 30px',
    fontSize: '15px',
    fontWeight: '600',
    background: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  securityItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '20px',
    borderBottom: '1px solid #f0f0f0',
  },
  securityLabel: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#333',
    margin: '0 0 4px',
  },
  securityDesc: {
    fontSize: '13px',
    color: '#999',
    margin: 0,
  },
  secondaryButton: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#f0f0f0',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#ffebee',
    color: '#c62828',
    border: '1px solid #ef5350',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#666',
  },
};
