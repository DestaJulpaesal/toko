import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { updateFinanceLoggingStreak } from '../services/financeStreakService.js';

const router = express.Router();
router.use(authenticateToken, requireRole('OWNER', 'ADMIN'));
const uploadDir = path.resolve(process.cwd(), 'uploads', 'finance');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsv = file.mimetype === 'text/csv'
      || file.mimetype === 'application/vnd.ms-excel'
      || file.originalname.toLowerCase().endsWith('.csv');
    if (!isCsv) {
      return cb(new Error('Hanya file CSV yang diperbolehkan.'));
    }
    return cb(null, true);
  },
});
const decimal = (value) => Number(value || 0);
const csvRows = (text) => {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const parse = (line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((value) => value.trim().replace(/^"|"$/g, ''));
  const headers = parse(lines.shift()).map((header) => header.toLowerCase());
  return lines.map((line) => Object.fromEntries(parse(line).map((value, index) => [headers[index], value])));
};
const amount = (value) => Number(String(value || '').replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
const date = (value) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? new Date() : parsed; };
const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((word) => word.length > 1);
const similarity = (left, right) => {
  const a = new Set(normalizeText(left)); const b = new Set(normalizeText(right));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.max(a.size, b.size);
};

router.post('/:transactionId/attachments', upload.single('file'), async (req, res) => {
  try {
    const transaction = await prisma.financeTransaction.findFirst({ where: { id: req.params.transactionId, deletedAt: null } });
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    const fileUrl = req.file ? `/uploads/finance/${path.basename(req.file.path)}` : String(req.body.fileUrl || '');
    if (!fileUrl) return res.status(400).json({ success: false, message: 'File atau fileUrl wajib diisi.' });
    const rawText = req.body.ocrRawText ? String(req.body.ocrRawText) : null;
    const numbers = rawText ? [...rawText.matchAll(/(?:rp\s*)?([\d][\d.,]*)/gi)].map((match) => amount(match[1])).filter(Boolean) : [];
    const row = await prisma.financeAttachment.create({ data: { transactionId: transaction.id, fileUrl, fileType: String(req.file?.mimetype || req.body.fileType || 'IMAGE').toUpperCase(), ocrRawText: rawText } });
    return res.status(201).json({ success: true, data: { ...row, suggestedAmount: numbers.length ? Math.max(...numbers) : null } });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Lampiran gagal disimpan.' }); }
});

router.delete('/attachments/:id', async (req, res) => {
  try { const row = await prisma.financeAttachment.delete({ where: { id: req.params.id } }); return res.json({ success: true, data: row }); } catch { return res.status(404).json({ success: false, message: 'Lampiran tidak ditemukan.' }); }
});

router.post('/import/preview', upload.single('file'), async (req, res) => {
  try {
    const text = req.file ? fs.readFileSync(req.file.path, 'utf8') : String(req.body.csv || '');
    const rows = csvRows(text);
    const existing = await prisma.financeTransaction.findMany({ where: { deletedAt: null }, select: { createdAt: true, amount: true, description: true } });
    const preview = rows.map((row, index) => {
      const debit = amount(row.debit || row.debet || row.keluar); const credit = amount(row.credit || row.kredit || row.masuk); const value = credit || debit; const type = credit ? 'INCOME' : 'EXPENSE'; const description = row.keterangan || row.description || row.deskripsi || `Import baris ${index + 1}`; const createdAt = date(row.tanggal || row.date);
      const duplicate = existing.some((item) => item.createdAt.toISOString().slice(0, 10) === createdAt.toISOString().slice(0, 10) && decimal(item.amount) === value && item.description.toLowerCase().includes(description.toLowerCase().slice(0, 12)));
      return { row: index + 1, date: createdAt.toISOString(), description, amount: value, type, duplicate };
    }).filter((row) => row.amount > 0);
    return res.json({ success: true, data: preview, duplicates: preview.filter((row) => row.duplicate).length });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'File mutasi tidak dapat dibaca.' }); }
});

router.post('/import/confirm', async (req, res) => {
  try {
    const rows = Array.isArray(req.body.transactions) ? req.body.transactions : []; const accountId = String(req.body.accountId || '');
    const account = await prisma.financeAccount.findFirst({ where: { id: accountId, deletedAt: null, isActive: true } }); if (!account) return res.status(400).json({ success: false, message: 'Akun import tidak valid.' });
    const result = await prisma.$transaction(async (tx) => {
      const imported = [];
      for (const row of rows) {
        const type = row.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
        const category = await tx.financeCategory.upsert({ where: { name_type: { name: type === 'INCOME' ? 'Import pemasukan' : 'Import pengeluaran', type } }, create: { name: type === 'INCOME' ? 'Import pemasukan' : 'Import pengeluaran', type }, update: {} });
        imported.push(await tx.financeTransaction.create({ data: { accountId, categoryId: category.id, type, amount: Number(row.amount), description: String(row.description || 'Import mutasi'), createdAt: date(row.date), userId: req.user.id } }));
      }
      return imported;
    });
    await updateFinanceLoggingStreak(req.user.id);
    return res.status(201).json({ success: true, data: result.map((row) => ({ ...row, amount: decimal(row.amount) })), count: result.length });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Import mutasi gagal.' }); }
});

router.get('/suggest', async (req, res) => {
  try {
    const description = String(req.query.description || '').trim();
    const type = String(req.query.type || 'EXPENSE').toUpperCase();
    if (description.length < 2 || !['INCOME', 'EXPENSE'].includes(type)) return res.json({ success: true, data: [] });
    const rows = await prisma.financeTransaction.findMany({
      where: { type, deletedAt: null, categoryId: { not: null } },
      select: { description: true, categoryId: true, accountId: true, categoryRef: { select: { id: true, name: true } }, account: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const suggestions = rows
      .map((row) => ({ ...row, score: similarity(description, row.description) }))
      .filter((row) => row.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .filter((row, index, all) => index === all.findIndex((item) => item.categoryId === row.categoryId && item.accountId === row.accountId))
      .slice(0, 5)
      .map((row) => ({ categoryId: row.categoryId, category: row.categoryRef, accountId: row.accountId, account: row.account, matchedDescription: row.description, confidence: Math.round(row.score * 100) }));
    return res.json({ success: true, data: suggestions });
  } catch (error) { return res.status(503).json({ success: false, message: error.message || 'Saran transaksi gagal dimuat.' }); }
});

router.get('/templates', async (req, res) => {
  const rows = await prisma.financeQuickTemplate.findMany({ where: { userId: req.user.id }, include: { category: true, account: true }, orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }] });
  return res.json({ success: true, data: rows.map((row) => ({ ...row, amount: row.amount == null ? null : decimal(row.amount) })) });
});
router.get('/quick-templates', async (req, res) => {
  const rows = await prisma.financeQuickTemplate.findMany({ where: { userId: req.user.id }, include: { category: true, account: true }, orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }] });
  return res.json({ success: true, data: rows.map((row) => ({ ...row, amount: row.amount == null ? null : decimal(row.amount) })) });
});
router.post('/templates', async (req, res) => {
  try { const row = await prisma.financeQuickTemplate.create({ data: { userId: req.user.id, label: String(req.body.label || '').trim(), type: req.body.type, amount: req.body.amount == null ? null : Number(req.body.amount), description: String(req.body.description || '').trim(), categoryId: req.body.categoryId || null, accountId: req.body.accountId || null, icon: req.body.icon || null } }); return res.status(201).json({ success: true, data: { ...row, amount: row.amount == null ? null : decimal(row.amount) } }); } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Template gagal dibuat.' }); }
});
router.post('/quick-templates', async (req, res) => {
  try {
    const label = String(req.body.label || '').trim(); const description = String(req.body.description || '').trim();
    if (!label || !description || !['INCOME', 'EXPENSE'].includes(String(req.body.type).toUpperCase())) return res.status(400).json({ success: false, message: 'Label, jenis, dan keterangan template wajib diisi.' });
    const row = await prisma.financeQuickTemplate.create({ data: { userId: req.user.id, label, type: String(req.body.type).toUpperCase(), amount: req.body.amount == null || req.body.amount === '' ? null : Number(req.body.amount), description, categoryId: req.body.categoryId || null, accountId: req.body.accountId || null, icon: req.body.icon || null } });
    return res.status(201).json({ success: true, data: { ...row, amount: row.amount == null ? null : decimal(row.amount) } });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Template gagal dibuat.' }); }
});
router.post('/quick-templates/:id/use', async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const template = await tx.financeQuickTemplate.findFirst({ where: { id: req.params.id, userId: req.user.id } });
      if (!template) throw new Error('Template tidak ditemukan.');
      const amount = template.amount == null ? Number(req.body.amount) : decimal(template.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Nominal transaksi wajib diisi.');
      const account = template.accountId ? await tx.financeAccount.findFirst({ where: { id: template.accountId, isActive: true, deletedAt: null } }) : await tx.financeAccount.upsert({ where: { id: 'finance-default-cash' }, create: { id: 'finance-default-cash', name: 'Kas Toko', type: 'CASH' }, update: {} });
      if (!account) throw new Error('Akun template tidak tersedia.');
      const category = template.categoryId ? await tx.financeCategory.findFirst({ where: { id: template.categoryId, type: template.type, deletedAt: null } }) : await tx.financeCategory.upsert({ where: { name_type: { name: template.type === 'INCOME' ? 'Pendapatan lain-lain' : 'Pengeluaran lain-lain', type: template.type } }, create: { name: template.type === 'INCOME' ? 'Pendapatan lain-lain' : 'Pengeluaran lain-lain', type: template.type, isDefault: true }, update: {} });
      if (!category) throw new Error('Kategori template tidak tersedia.');
      const transaction = await tx.financeTransaction.create({ data: { userId: req.user.id, type: template.type, amount, description: template.description, accountId: account.id, categoryId: category.id } });
      await updateFinanceLoggingStreak(req.user.id, tx);
      await tx.financeQuickTemplate.update({ where: { id: template.id }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } });
      return transaction;
    });
    return res.status(201).json({ success: true, data: { ...result, amount: decimal(result.amount) } });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Template gagal dipakai.' }); }
});
router.patch('/templates/:id', async (req, res) => {
  try { const row = await prisma.financeQuickTemplate.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: req.body }); if (!row.count) return res.status(404).json({ success: false, message: 'Template tidak ditemukan.' }); return res.json({ success: true, data: row }); } catch (error) { return res.status(400).json({ success: false, message: error.message || 'Template gagal diperbarui.' }); }
});
router.delete('/templates/:id', async (req, res) => {
  const row = await prisma.financeQuickTemplate.deleteMany({ where: { id: req.params.id, userId: req.user.id } }); return row.count ? res.json({ success: true }) : res.status(404).json({ success: false, message: 'Template tidak ditemukan.' });
});
router.delete('/quick-templates/:id', async (req, res) => {
  const row = await prisma.financeQuickTemplate.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  return row.count ? res.json({ success: true }) : res.status(404).json({ success: false, message: 'Template tidak ditemukan.' });
});

export default router;
