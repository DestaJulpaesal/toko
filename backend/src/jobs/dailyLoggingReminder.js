import cron from 'node-cron';
import prisma from '../config/db.js';
import { sendWhatsappMessage } from '../services/whatsappService.js';

export async function sendDailyLoggingReminders(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['OWNER', 'CASHIER'] }, phone: { not: null } },
    select: { id: true, phone: true, financeLoggingStreak: { select: { currentStreak: true } } },
  });
  const sent = [];
  for (const user of users) {
    const count = await prisma.financeTransaction.count({ where: { userId: user.id, orderId: null, deletedAt: null, createdAt: { gte: start, lt: end } } });
    if (count > 0) continue;
    await sendWhatsappMessage(user.phone, `Halo! Hari ini belum ada catatan pengeluaran/pemasukan manual. Yuk catat sekarang biar streak-nya nggak putus 🔥 (streak saat ini: ${user.financeLoggingStreak?.currentStreak || 0} hari)`);
    sent.push(user.id);
  }
  return sent;
}

export function startDailyLoggingReminderJob() {
  if (process.env.ENABLE_DAILY_LOGGING_REMINDER === 'false') return null;
  return cron.schedule('0 20 * * *', () => sendDailyLoggingReminders().catch((error) => console.error('Daily logging reminder failed:', error.message)));
}
