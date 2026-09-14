import cron from 'node-cron';
import prisma from '../config/db.js';
import { sendWhatsappMessage } from '../services/whatsappService.js';

export async function generateFinanceReminders(now = new Date()) {
  const horizon = new Date(now); horizon.setDate(horizon.getDate() + 3);
  const debts = await prisma.debtRecord.findMany({ where: { status: 'OPEN', deletedAt: null, dueDate: { not: null, lte: horizon } }, select: { id: true, dueDate: true, customer: { select: { name: true } } } });
  const reminders = [];
  for (const debt of debts) {
    const dueDate = debt.dueDate;
    const exists = await prisma.financeReminder.findFirst({ where: { type: 'DEBT_DUE', refId: debt.id, status: { not: 'DISMISSED' }, dueDate } });
    if (!exists) reminders.push(await prisma.financeReminder.create({ data: { type: 'DEBT_DUE', refId: debt.id, title: `Piutang ${debt.customer?.name || ''} jatuh tempo`, dueDate, channel: 'APP' } }));
  }

  const recurring = await prisma.recurringTransaction.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, description: true, startDate: true, lastRunAt: true } });
  for (const item of recurring) {
    const due = new Date(item.lastRunAt || item.startDate); due.setDate(due.getDate() + 1);
    if (due >= now && due <= horizon) {
      const exists = await prisma.financeReminder.findFirst({ where: { type: 'BILL_DUE', refId: item.id, dueDate: due, status: { not: 'DISMISSED' } } });
      if (!exists) reminders.push(await prisma.financeReminder.create({ data: { type: 'BILL_DUE', refId: item.id, title: `Tagihan berulang: ${item.description}`, dueDate: due, channel: 'APP' } }));
    }
  }
  const whatsapp = await prisma.financeReminder.findMany({ where: { channel: 'WHATSAPP', status: 'PENDING', dueDate: { lte: horizon } }, take: 20 });
  for (const reminder of whatsapp) {
    try {
      await sendWhatsappMessage(null, `🔔 ${reminder.title}\nJatuh tempo: ${reminder.dueDate.toLocaleDateString('id-ID')}`);
      await prisma.financeReminder.update({ where: { id: reminder.id }, data: { status: 'SENT' } });
    } catch (error) { console.error('WhatsApp reminder failed:', error.message); }
  }
  return reminders;
}

export async function captureNetWorthSnapshot() {
  const [items, accounts, debts] = await Promise.all([
    prisma.netWorthItem.findMany({ where: { deletedAt: null } }),
    prisma.financeAccount.findMany({ where: { deletedAt: null, isActive: true }, include: { transactions: { where: { deletedAt: null }, select: { type: true, amount: true } }, transfersIn: { select: { amount: true } }, transfersOut: { select: { amount: true } } } }),
    prisma.debtRecord.findMany({ where: { status: 'OPEN', deletedAt: null }, select: { amount: true, paidAmount: true } }),
  ]);
  const accountTotal = accounts.reduce((sum, account) => sum + Number(account.startBalance) + account.transactions.reduce((value, tx) => value + (tx.type === 'INCOME' ? Number(tx.amount) : tx.type === 'EXPENSE' ? -Number(tx.amount) : 0), 0) + account.transfersIn.reduce((value, tx) => value + Number(tx.amount), 0) - account.transfersOut.reduce((value, tx) => value + Number(tx.amount), 0), 0);
  const totalAsset = accountTotal + items.filter((item) => item.kind === 'ASSET').reduce((sum, item) => sum + Number(item.value), 0);
  const totalLiability = items.filter((item) => item.kind === 'LIABILITY').reduce((sum, item) => sum + Number(item.value), 0) + debts.reduce((sum, debt) => sum + Math.max(Number(debt.amount) - Number(debt.paidAmount || 0), 0), 0);
  return prisma.netWorthSnapshot.create({ data: { totalAsset, totalLiability, netWorth: totalAsset - totalLiability } });
}

export function startReminderJob() {
  if (process.env.ENABLE_REMINDER_JOB === 'false') return null;
  const hourly = cron.schedule('0 * * * *', () => generateFinanceReminders().catch((error) => console.error('Reminder job failed:', error.message)));
  cron.schedule('0 2 1 * *', () => captureNetWorthSnapshot().catch((error) => console.error('Net worth snapshot failed:', error.message)));
  return hourly;
}
