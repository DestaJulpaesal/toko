import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiUrl, authHeaders } from '../services/api';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Belum ada';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return 'Kemarin';
  return `${diffDays} hari lalu`;
}

function formatFullDateTime(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export default function DatabaseBackupIndicator({ compact = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [testingSystem, setTestingSystem] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/backup/status');
      const data = await res.json();
      if (data.success && data.data) {
        setStatus(data.data);
      }
    } catch (err) {
      console.warn('Gagal memuat status backup database:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 60000); // perbarui tiap 1 menit
    return () => clearInterval(interval);
  }, [loadStatus]);

  const handleRunBackup = async () => {
    setBackingUp(true);
    setNotice('');
    try {
      const res = await apiFetch('/backup/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotice('✓ Backup database berhasil dibuat!');
        await loadStatus();
        setTimeout(() => setNotice(''), 4000);
      } else {
        setNotice(`Gagal: ${data.message || 'Error membuat backup'}`);
      }
    } catch (err) {
      setNotice(`Error: ${err.message}`);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRunPreflightTest = async () => {
    setTestingSystem(true);
    setNotice('');
    try {
      const res = await apiFetch('/backup/preflight-test', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setTestResult(data.data);
        setTestModalOpen(true);
        setNotice('✓ Uji otomatis kasir, stok, & keuangan selesai dengan sukses!');
        setTimeout(() => setNotice(''), 4000);
      } else {
        setNotice(`Uji gagal: ${data.message || 'Terjadi kesalahan sistem'}`);
      }
    } catch (err) {
      setNotice(`Error uji sistem: ${err.message}`);
    } finally {
      setTestingSystem(false);
    }
  };

  const handleDownloadLatest = async (filename) => {
    setDownloading(true);
    try {
      const targetFilename = filename || status?.lastBackup?.filename;
      const downloadPath = targetFilename
        ? apiUrl(`/backup/download/${encodeURIComponent(targetFilename)}`)
        : apiUrl('/backup/latest-download');

      const response = await fetch(downloadPath, {
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error('Gagal mengunduh file backup dari server.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = targetFilename || `backup-glosir-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setNotice(`Gagal unduh: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const lastBackup = status?.lastBackup;
  const isHealthy = status?.isHealthy;
  const elapsedText = lastBackup?.lastBackupAt ? formatRelativeTime(lastBackup.lastBackupAt) : 'Belum ada';
  const fullDateText = lastBackup?.lastBackupAt ? formatFullDateTime(lastBackup.lastBackupAt) : null;

  if (compact) {
    return (
      <div className="backup-indicator-compact" title={`Backup Terakhir: ${fullDateText || 'Belum ada'}`}>
        <span className={`backup-status-dot ${isHealthy ? 'healthy' : 'warning'}`} />
        <span className="backup-compact-label">
          Backup: <strong>{elapsedText}</strong>
        </span>
        <button
          type="button"
          className="backup-quick-btn"
          disabled={backingUp}
          onClick={handleRunBackup}
          title="Jalankan backup database sekarang"
        >
          {backingUp ? '⏳' : '⚡'}
        </button>
      </div>
    );
  }

  return (
    <div className="backup-widget-card">
      <div className="backup-widget-header">
        <div className="backup-widget-info">
          <div className="backup-status-badge-row">
            <span className={`backup-status-pill ${isHealthy ? 'status-ok' : 'status-warning'}`}>
              <span className="pulse-dot" />
              {loading ? 'Memeriksa backup...' : isHealthy ? 'Database Dicadangkan' : 'Perlu Backup'}
            </span>
            {lastBackup?.trigger && (
              <span className="backup-trigger-tag">
                {lastBackup.trigger === 'AUTOMATED' ? '🤖 Otomatis' : '👤 Manual'}
              </span>
            )}
          </div>

          <div className="backup-timestamp-line">
            <span className="backup-label">Backup Terakhir:</span>
            <strong className="backup-value">{fullDateText || 'Belum pernah dibackup'}</strong>
            {lastBackup?.lastBackupAt && (
              <span className="backup-relative">({elapsedText})</span>
            )}
          </div>

          {lastBackup && (
            <div className="backup-stats-meta">
              <span>Ukuran: {lastBackup.fileSizeFormatted || '-'}</span>
              <span>•</span>
              <span>Total Data: {lastBackup.totalRecords ? `${lastBackup.totalRecords} baris` : '-'}</span>
            </div>
          )}

          {notice && <div className="backup-inline-notice">{notice}</div>}
        </div>

        <div className="backup-widget-actions">
          <button
            type="button"
            className="btn-backup-action btn-backup-preflight"
            disabled={testingSystem}
            onClick={handleRunPreflightTest}
            title="Jalankan uji otomatis kasir, stok, dan keuangan sebelum operasional toko"
          >
            {testingSystem ? '⏳ Menguji Sistem...' : '🧪 Uji Sistem Kasir & Stok'}
          </button>

          <button
            type="button"
            className="btn-backup-action btn-backup-run"
            disabled={backingUp}
            onClick={handleRunBackup}
            title="Buat snapshot database baru sekarang"
          >
            {backingUp ? '⏳ Menyimpan...' : '⚡ Backup Sekarang'}
          </button>

          {lastBackup && (
            <button
              type="button"
              className="btn-backup-action btn-backup-download"
              disabled={downloading}
              onClick={() => handleDownloadLatest()}
              title="Unduh file snapshot JSON ke komputer"
            >
              {downloading ? '⏳ Mengunduh...' : '💾 Unduh'}
            </button>
          )}

          {status?.backups?.length > 1 && (
            <button
              type="button"
              className="btn-backup-action btn-backup-history"
              onClick={() => setHistoryOpen(!historyOpen)}
              title="Lihat daftar arsip backup"
            >
              📂 Riwayat ({status.backups.length})
            </button>
          )}
        </div>
      </div>

      {/* Accordion Riwayat Backup */}
      {historyOpen && status?.backups?.length > 0 && (
        <div className="backup-history-drawer">
          <div className="backup-history-title">
            <span>Daftar Cadangan Tersimpan ({status.backups.length} file terbaru):</span>
          </div>
          <div className="backup-history-list">
            {status.backups.map((item) => (
              <div key={item.filename} className="backup-history-item">
                <div className="backup-item-left">
                  <span className="backup-item-name">{item.filename}</span>
                  <small className="backup-item-date">{formatFullDateTime(item.createdAt)}</small>
                </div>
                <div className="backup-item-right">
                  <span className="backup-item-size">{item.sizeFormatted}</span>
                  <button
                    type="button"
                    className="btn-download-small"
                    onClick={() => handleDownloadLatest(item.filename)}
                    title="Unduh file backup ini"
                  >
                    ⬇ Unduh
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Hasil Uji Sistem Otomatis Kasir & Stok */}
      {testModalOpen && (
        <div className="backup-test-modal-overlay" onClick={() => setTestModalOpen(false)}>
          <div
            className="backup-test-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preflight-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="backup-test-header">
              <div>
                <h3 id="preflight-modal-title" className="backup-test-title">
                  🧪 Hasil Uji Otomatis Pra-Operasional Harian
                </h3>
                <p className="backup-test-subtitle">
                  Verifikasi integritas database, transaksi kasir, pengurangan stok, mutasi kartu stok, dan pencatatan kas/piutang.
                </p>
              </div>
              <button
                type="button"
                className="btn-close-test-modal"
                onClick={() => setTestModalOpen(false)}
                title="Tutup Modal"
              >
                ✕
              </button>
            </div>

            <div className="backup-test-body">
              {testingSystem && (
                <div className="backup-test-loading">
                  <div className="spinner"></div>
                  <p>Sedang mengeksekusi 4 skenario uji operasional... Harap tunggu sebentar.</p>
                </div>
              )}

              {!testingSystem && testResult && (
                <div className="backup-test-result-wrapper">
                  <div className={`backup-test-summary-card ${testResult.success ? 'is-pass' : 'is-fail'}`}>
                    <div className="test-summary-badge">
                      {testResult.success ? '✅ SEMUA UJI LULUS (SIAP DIGUNAKAN)' : '❌ ADA UJI YANG GAGAL'}
                    </div>
                    <div className="test-summary-meta">
                      <span>Total Uji: {testResult.totalTests}</span>
                      <span>•</span>
                      <span>Lulus: {testResult.passedCount}</span>
                      <span>•</span>
                      <span>Gagal: {testResult.failedCount}</span>
                      <span>•</span>
                      <span>Durasi: {testResult.durationMs}ms</span>
                    </div>
                  </div>

                  <div className="backup-test-steps-list">
                    {testResult.steps?.map((step) => (
                      <div
                        key={step.id}
                        className={`backup-test-step-card ${step.passed ? 'step-pass' : 'step-fail'}`}
                      >
                        <div className="step-card-header">
                          <span className="step-icon">{step.passed ? '✅' : '❌'}</span>
                          <span className="step-number">#{step.id}</span>
                          <strong className="step-name">{step.name}</strong>
                          <span className="step-duration">{step.durationMs}ms</span>
                        </div>
                        <div className="step-card-detail">{step.detail}</div>
                        {step.error && (
                          <div className="step-card-error">
                            <strong>Pesan Error:</strong> {step.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="backup-test-teardown-info">
                    ℹ️ <em>Catatan: Data simulasi (order, produk uji, mutasi stok, transaksi kas) telah otomatis dibersihkan dan tidak meninggalkan sampah pada database utama.</em>
                  </div>
                </div>
              )}
            </div>

            <div className="backup-test-footer">
              <button
                type="button"
                className="btn-backup-action btn-backup-preflight"
                disabled={testingSystem}
                onClick={handleRunPreflightTest}
              >
                {testingSystem ? '⏳ Menguji...' : '🔄 Jalankan Uji Ulang'}
              </button>
              <button
                type="button"
                className="btn-close-modal-footer"
                onClick={() => setTestModalOpen(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
