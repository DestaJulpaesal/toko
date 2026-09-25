import cron from 'node-cron';
import { getExpiringProducts } from '../services/loyaltyService.js';
import { sendEmail, renderActionEmail } from '../services/emailService.js';
import prisma from '../config/db.js';

/**
 * FASE 5: Expiry Notification Job
 * Cek barang yang mendekati kadaluarsa dan kirim notifikasi email ke owner.
 * Jalan setiap pagi jam 07:00 WIB.
 */

async function checkAndNotifyExpiry() {
  try {
    // Ambil barang yang kadaluarsa dalam 30 hari ke depan
    const expiringProducts = await getExpiringProducts(30);

    if (expiringProducts.length === 0) {
      console.log('[ExpiryJob] Tidak ada barang yang mendekati kadaluarsa.');
      return;
    }

    // Pisahkan berdasarkan urgency
    const expired = expiringProducts.filter((p) => p.urgency === 'EXPIRED');
    const critical = expiringProducts.filter((p) => p.urgency === 'CRITICAL');
    const warning = expiringProducts.filter((p) => p.urgency === 'WARNING');

    console.log(`[ExpiryJob] Ditemukan: ${expired.length} kadaluarsa, ${critical.length} kritis (H-7), ${warning.length} perhatian (H-30)`);

    // Kirim email ke semua owner
    const owners = await prisma.user.findMany({
      where: { role: 'OWNER', isActive: true },
      select: { id: true, email: true, name: true, notificationPreferences: true },
    });

    for (const owner of owners) {
      // Cek preferensi notifikasi
      const prefs = owner.notificationPreferences || {};
      if (prefs.criticalStock === false) continue;

      const lines = [];

      if (expired.length > 0) {
        lines.push('<h3 style="color:#dc2626">🔴 Sudah Kadaluarsa</h3>');
        lines.push('<ul>');
        for (const p of expired) {
          lines.push(`<li><strong>${p.productName}</strong> (${p.unitName}) — kadaluarsa ${new Date(p.expiryDate).toLocaleDateString('id-ID')}</li>`);
        }
        lines.push('</ul>');
      }

      if (critical.length > 0) {
        lines.push('<h3 style="color:#f59e0b">🟡 Kadaluarsa dalam 7 hari</h3>');
        lines.push('<ul>');
        for (const p of critical) {
          lines.push(`<li><strong>${p.productName}</strong> (${p.unitName}) — ${p.daysLeft} hari lagi (${new Date(p.expiryDate).toLocaleDateString('id-ID')})</li>`);
        }
        lines.push('</ul>');
      }

      if (warning.length > 0) {
        lines.push('<h3 style="color:#6b7280">📋 Kadaluarsa dalam 30 hari</h3>');
        lines.push('<ul>');
        for (const p of warning.slice(0, 10)) {
          lines.push(`<li><strong>${p.productName}</strong> (${p.unitName}) — ${p.daysLeft} hari lagi</li>`);
        }
        if (warning.length > 10) lines.push(`<li>...dan ${warning.length - 10} barang lainnya</li>`);
        lines.push('</ul>');
      }

      const message = lines.join('\n');

      await sendEmail({
        to: owner.email,
        subject: `⚠️ Peringatan Kadaluarsa: ${expired.length + critical.length} barang perlu perhatian`,
        html: renderActionEmail({
          title: 'Peringatan Barang Kadaluarsa',
          message,
          actionLabel: 'Buka Stok Opname',
          actionUrl: `${process.env.APP_BASE_URL || 'http://localhost:5174'}/admin/stock-opname`,
        }),
        type: 'EXPIRY_ALERT',
        userId: owner.id,
      });
    }

    console.log(`[ExpiryJob] Notifikasi kadaluarsa dikirim ke ${owners.length} owner.`);
  } catch (error) {
    console.error('[ExpiryJob] Gagal cek kadaluarsa:', error.message);
  }
}

/**
 * Start expiry notification job
 * Jalan setiap pagi jam 07:00 WIB
 */
export function startExpiryNotificationJob() {
  // Jadwal: setiap hari jam 07:00
  cron.schedule('0 7 * * *', checkAndNotifyExpiry, {
    timezone: 'Asia/Jakarta',
  });
  console.log('[ExpiryJob] Scheduled: cek kadaluarsa setiap pagi jam 07:00 WIB');
}

// Export untuk testing manual
export { checkAndNotifyExpiry };
