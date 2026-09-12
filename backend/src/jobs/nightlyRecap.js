import cron from 'node-cron';
import prisma from '../config/db.js';
import { sendWhatsappMessage } from '../services/whatsappService.js';

async function buildNightlyRecap() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  const [income, criticalProducts, dueDebts] = await Promise.all([
    prisma.financeTransaction.aggregate({ where: { type: 'INCOME', deletedAt: null, createdAt: { gte: start, lt: next } }, _sum: { amount: true } }),
    prisma.product.findMany({ where: { status: { not: 'HIDDEN' } }, select: { name: true, stockWarning: true, variants: { where: { isDefault: true, isActive: true }, select: { stockQty: true }, take: 1 } } }),
    prisma.debtRecord.findMany({ where: { status: 'OPEN', deletedAt: null, dueDate: { gte: start, lte: new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000) } }, include: { customer: { select: { name: true } } } }),
  ]);
  const critical = criticalProducts.filter((product) => Number(product.variants[0]?.stockQty || 0) <= Number(product.stockWarning || 0));
  const lines = [
    `Rekap Glosir ${start.toLocaleDateString('id-ID')}`,
    `Omzet hari ini: Rp ${Number(income._sum.amount || 0).toLocaleString('id-ID')}`,
    `Stok kritis: ${critical.length ? critical.map((item) => `${item.name} (${item.variants[0]?.stockQty || 0})`).join(', ') : 'tidak ada'}`,
    `Piutang jatuh tempo 3 hari: ${dueDebts.length ? dueDebts.map((item) => `${item.customer.name} Rp ${Number(item.amount).toLocaleString('id-ID')}`).join(', ') : 'tidak ada'}`,
  ];
  return lines.join('\n');
}

export function startNightlyRecap() {
  if (process.env.ENABLE_NIGHTLY_RECAP !== 'true') return null;
  return cron.schedule('0 21 * * *', async () => {
    try {
      await sendWhatsappMessage(process.env.OWNER_WHATSAPP_NUMBER, await buildNightlyRecap());
    } catch (error) {
      console.error(`Nightly WhatsApp recap failed: ${error.message}`);
    }
  }, { timezone: process.env.RECAP_TIMEZONE || 'Asia/Jakarta' });
}

export { buildNightlyRecap };
