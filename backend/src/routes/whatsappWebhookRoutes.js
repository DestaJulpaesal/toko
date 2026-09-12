import express from 'express';
import prisma from '../config/db.js';

const router = express.Router();
const normalizePhone = (value) => String(value || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
const allowedNumbers = () => String(process.env.OWNER_WHATSAPP_NUMBER || '').split(',').map(normalizePhone).filter(Boolean);
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

async function sendReply(target, message) {
  if (!process.env.FONNTE_API_KEY) return;
  await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: process.env.FONNTE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, message }),
  });
}

async function answerOwner(command) {
  const text = String(command || '').trim().toLowerCase();
  if (text === 'bantuan' || text === 'help') return 'Perintah Glosir:\n• stok [nama barang]\n• omzet hari ini\n• piutang\n• stok menipis';
  if (text.startsWith('stok menipis')) {
    const products = await prisma.product.findMany({ where: { status: { not: 'HIDDEN' } }, select: { name: true, stockWarning: true, variants: { where: { isDefault: true, isActive: true }, select: { stockQty: true }, take: 1 } } });
    const low = products.filter((product) => Number(product.variants[0]?.stockQty || 0) <= Number(product.stockWarning || 0));
    return low.length ? `Stok menipis:\n${low.slice(0, 15).map((item) => `• ${item.name}: ${item.variants[0]?.stockQty || 0}`).join('\n')}` : 'Stok aman, belum ada barang menipis.';
  }
  if (text === 'omzet' || text.includes('omzet hari ini')) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const result = await prisma.financeTransaction.aggregate({ where: { type: 'INCOME', deletedAt: null, createdAt: { gte: start } }, _sum: { amount: true } });
    return `Omzet hari ini: ${money(result._sum.amount)}`;
  }
  if (text === 'piutang' || text.includes('piutang')) {
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const debts = await prisma.debtRecord.findMany({ where: { status: 'OPEN', deletedAt: null, dueDate: { lte: end } }, include: { customer: { select: { name: true } } }, orderBy: { dueDate: 'asc' }, take: 15 });
    return debts.length ? `Piutang jatuh tempo:\n${debts.map((item) => `• ${item.customer.name}: ${money(item.amount)}`).join('\n')}` : 'Tidak ada piutang yang jatuh tempo minggu ini.';
  }
  if (text.startsWith('stok ')) {
    const query = text.slice(6).trim();
    const products = await prisma.product.findMany({ where: { name: { contains: query, mode: 'insensitive' } }, select: { name: true, variants: { where: { isDefault: true, isActive: true }, select: { stockQty: true, unit: true }, take: 1 } }, take: 5 });
    return products.length ? products.map((item) => `• ${item.name}: ${item.variants[0]?.stockQty || 0} ${item.variants[0]?.unit || 'unit'}`).join('\n') : `Barang "${query}" tidak ditemukan.`;
  }
  return 'Perintah belum dikenali. Ketik *bantuan* untuk melihat daftar perintah.';
}

async function answerCustomer(sender, command) {
  const text = String(command || '').trim().toLowerCase();
  const customer = await prisma.customer.findFirst({ where: { phone: sender } });
  if (!customer) return 'Nomor ini belum memiliki pesanan Glosir yang tercatat.';
  const baseWhere = { customerId: customer.id, status: { notIn: ['COMPLETED', 'CANCELLED', 'VOIDED'] } };
  if (text === 'cek pesanan' || text === 'status') {
    const orders = await prisma.order.findMany({ where: baseWhere, orderBy: { createdAt: 'desc' }, take: 3 });
    return orders.length ? `Pesanan Anda:\n${orders.map((order) => `• ${order.orderNumber}: ${order.status}`).join('\n')}` : 'Belum ada pesanan aktif.';
  }
  if (text.startsWith('lacak ')) {
    const orderNumber = text.slice(6).trim().toUpperCase();
    const order = await prisma.order.findFirst({ where: { ...baseWhere, orderNumber } });
    return order ? `Status pesanan ${order.orderNumber}: ${order.status}\nTotal: ${money(order.total)}` : 'Nomor pesanan tidak ditemukan atau bukan milik nomor ini.';
  }
  return 'Perintah customer:\n• cek pesanan\n• status\n• lacak [nomor pesanan]';
}

router.post('/', async (req, res) => {
  const providedSecret = req.headers['x-webhook-secret'] || req.body?.secret;
  if (process.env.WHATSAPP_WEBHOOK_SECRET && providedSecret !== process.env.WHATSAPP_WEBHOOK_SECRET) return res.status(401).json({ success: false, message: 'Webhook tidak sah' });
  const sender = normalizePhone(req.body?.sender || req.body?.from || req.body?.phone);
  if (!sender) return res.json({ success: true, ignored: true });
  try {
    const message = req.body?.message || req.body?.text || req.body?.body || '';
    const reply = allowedNumbers().includes(sender) ? await answerOwner(message) : await answerCustomer(sender, message);
    await sendReply(sender, reply);
    return res.json({ success: true, replied: true });
  } catch (error) {
    console.error(`WhatsApp webhook failed: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Perintah gagal diproses' });
  }
});

export default router;
