import cron from 'node-cron';
import prisma from '../config/db.js';
import { getNotificationPreferences, sendEmail } from '../services/emailService.js';

function rupiah(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

export async function sendDailyEmailSummaries(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [users, income, products, debts] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true, email: { not: '' } }, select: { id: true, email: true, name: true, notificationPreferences: true } }),
    prisma.financeTransaction.aggregate({ where: { type: 'INCOME', deletedAt: null, createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.product.findMany({ where: { status: { not: 'HIDDEN' } }, select: { name: true, stockWarning: true, variants: { where: { isDefault: true, isActive: true }, select: { stockQty: true }, take: 1 } } }),
    prisma.debtRecord.findMany({ where: { status: 'OPEN', deletedAt: null, dueDate: { gte: start, lte: new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000) }, customer: { isNot: null } }, select: { amount: true, customer: { select: { name: true } } } }),
  ]);
  const critical = products.filter((product) => Number(product.variants[0]?.stockQty || 0) <= Number(product.stockWarning || 0));
  const sent = [];
  for (const user of users) {
    const preferences = getNotificationPreferences(user.notificationPreferences);
    const parts = [];
    if (preferences.dailySummary) parts.push(`<p><strong>Omzet hari ini:</strong> Rp ${rupiah(income._sum.amount)}</p>`);
    if (preferences.criticalStock) parts.push(`<p><strong>Stok perlu diperiksa:</strong> ${critical.length ? critical.map((item) => `${item.name} (${item.variants[0]?.stockQty || 0})`).join(', ') : 'tidak ada'}</p>`);
    if (preferences.overdueDebt) parts.push(`<p><strong>Piutang jatuh tempo:</strong> ${debts.length ? debts.map((item) => `${item.customer?.name || 'Pelanggan'} Rp ${rupiah(item.amount)}`).join(', ') : 'tidak ada'}</p>`);
    if (!parts.length) continue;
    const result = await sendEmail({
      to: user.email,
      userId: user.id,
      type: 'DAILY_SUMMARY',
      subject: `Ringkasan Glosir ${start.toLocaleDateString('id-ID')}`,
      text: `Ringkasan omzet hari ini: Rp ${rupiah(income._sum.amount)}. Stok kritis: ${critical.length}. Piutang jatuh tempo: ${debts.length}.`,
      html: `<html lang="id"><body style="font-family:Arial,sans-serif"><h1>Ringkasan Glosir</h1>${parts.join('')}<p><a href="${process.env.APP_BASE_URL || 'http://localhost:5174'}">Buka Aplikasi</a></p></body></html>`,
    });
    if (result.sent) sent.push(user.id);
  }
  return sent;
}

export function startEmailNotificationJob() {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') return null;
  return cron.schedule('0 21 * * *', () => sendDailyEmailSummaries().catch((error) => console.error('Email summary failed:', error.message)), { timezone: process.env.RECAP_TIMEZONE || 'Asia/Jakarta' });
}
