import cron from 'node-cron';
import { createDatabaseBackup, getBackupStatus } from '../services/backupService.js';

export function startBackupJob() {
  const scheduleTime = process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *'; // Pukul 02:00 WIB setiap hari
  const timezone = process.env.BACKUP_TIMEZONE || 'Asia/Jakarta';

  console.log(`[BackupJob] Initializing automated backup job (Schedule: "${scheduleTime}", TZ: ${timezone})`);

  // Jadwalkan cron backup harian
  const task = cron.schedule(
    scheduleTime,
    async () => {
      console.log('[BackupJob] Starting scheduled automated database backup...');
      try {
        const meta = await createDatabaseBackup({
          trigger: 'AUTOMATED',
          initiatedBy: 'cron-job',
        });
        console.log(`[BackupJob] Automated backup completed successfully: ${meta.filename} (${meta.fileSizeFormatted}, ${meta.totalRecords} records)`);
      } catch (error) {
        console.error(`[BackupJob] Automated database backup failed: ${error.message}`);
      }
    },
    { timezone }
  );

  // Periksa apakah sudah pernah ada backup. Jika belum pernah sama sekali, buat backup awal setelah server stabil
  setTimeout(async () => {
    try {
      const status = await getBackupStatus();
      if (!status.lastBackup) {
        console.log('[BackupJob] No prior database backup detected. Creating initial baseline backup...');
        const initial = await createDatabaseBackup({
          trigger: 'AUTOMATED',
          initiatedBy: 'system-bootstrap',
        });
        console.log(`[BackupJob] Baseline backup created: ${initial.filename}`);
      } else {
        console.log(`[BackupJob] Last backup on record: ${status.lastBackup.filename} (${status.lastBackup.lastBackupAt})`);
      }
    } catch (err) {
      console.warn(`[BackupJob] Bootstrap check warning: ${err.message}`);
    }
  }, 10000); // 10 detik setelah boot

  return task;
}
