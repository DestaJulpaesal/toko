import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { createDatabaseBackup, getBackupStatus, getBackupFilePath } from '../services/backupService.js';
import { runDailyPreflightCheck } from '../services/preflightService.js';

const router = Router();

/**
 * GET /api/backup/status
 * Mengambil status backup terakhir, kesehatan backup, dan riwayat file backup
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = await getBackupStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[BackupRoutes] Error reading status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Gagal memeriksa status backup database.',
      error: error.message,
    });
  }
});

/**
 * POST /api/backup/run
 * Memicu proses backup database manual oleh Admin / Owner
 */
router.post('/run', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const initiatedBy = req.user?.name || req.user?.email || 'admin';
    const meta = await createDatabaseBackup({
      trigger: 'MANUAL',
      initiatedBy,
    });

    res.json({
      success: true,
      message: 'Backup database berhasil dibuat.',
      data: meta,
    });
  } catch (error) {
    console.error('[BackupRoutes] Error running backup:', error.message);
    res.status(500).json({
      success: false,
      message: 'Gagal membuat backup database.',
      error: error.message,
    });
  }
});

/**
 * GET /api/backup/download/:filename
 * Mengunduh file backup JSON
 */
router.get('/download/:filename', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = getBackupFilePath(filename);

    res.download(filePath, filename, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Gagal mengunduh file backup.',
        });
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || 'File backup tidak ditemukan.',
    });
  }
});

/**
 * GET /api/backup/latest-download
 * Mengunduh file backup paling baru yang tersedia
 */
router.get('/latest-download', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const status = await getBackupStatus();
    if (!status.lastBackup?.filename) {
      return res.status(404).json({
        success: false,
        message: 'Belum ada file backup yang tersedia untuk diunduh.',
      });
    }

    const filePath = getBackupFilePath(status.lastBackup.filename);
    res.download(filePath, status.lastBackup.filename);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Gagal mengunduh backup terbaru.',
    });
  }
});

/**
 * POST /api/backup/preflight-test
 * Menjalankan uji otomatis pra-operasional (kasir, stok, keuangan) sebelum toko dibuka
 */
router.post('/preflight-test', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const result = await runDailyPreflightCheck();
    res.json({
      success: true,
      message: result.allPassed
        ? 'Semua uji otomatis operasional kasir, stok, dan keuangan berhasil 100%!'
        : 'Terdapat uji otomatis yang gagal. Periksa hasil pemeriksaan sistem.',
      data: result,
    });
  } catch (error) {
    console.error('[BackupRoutes] Preflight check error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Uji otomatis pra-operasional mengalami kegagalan teknis.',
      error: error.message,
    });
  }
});

export default router;
