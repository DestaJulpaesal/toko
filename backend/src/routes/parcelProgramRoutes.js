import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateBody, parcelProgramCreateSchema, parcelProgramUpdateSchema } from '../middleware/security.js';

const router = express.Router();
const format = (item) => ({ id: item.id, name: item.name, year: item.year, targetAmount: Number(item.targetAmount || 0), isActive: item.isActive, notes: item.notes || '', participantCount: item._count?.participants || 0 });

router.get('/', async (req, res) => {
  try { const rows = await prisma.parcelProgram.findMany({ where: { isActive: true }, include: { _count: { select: { participants: true } } }, orderBy: [{ year: 'desc' }, { name: 'asc' }] }); return res.json({ success: true, programs: rows.map(format) }); }
  catch (error) { return res.status(500).json({ success: false, message: error.message || 'Program parsel gagal dimuat.' }); }
});

router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(parcelProgramCreateSchema), async (req, res) => {
  try { const { name, year, targetAmount, notes } = req.body || {}; const row = await prisma.parcelProgram.create({ data: { name: String(name).trim(), year: Number(year), targetAmount: Number(targetAmount), notes: notes ? String(notes).trim() : null }, include: { _count: { select: { participants: true } } } }); return res.status(201).json({ success: true, program: format(row) }); }
  catch (error) { return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'Program dan tahun tersebut sudah ada.' : error.message || 'Program gagal dibuat.' }); }
});

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(parcelProgramUpdateSchema), async (req, res) => {
  try { const { name, year, targetAmount, notes } = req.body || {}; const row = await prisma.parcelProgram.update({ where: { id: req.params.id }, data: { ...(name !== undefined ? { name: String(name).trim() } : {}), ...(year !== undefined ? { year: Number(year) } : {}), ...(targetAmount !== undefined ? { targetAmount: Number(targetAmount) } : {}), notes: notes ? String(notes).trim() : null }, include: { _count: { select: { participants: true } } } }); return res.json({ success: true, program: format(row) }); }
  catch (error) { return res.status(error.code === 'P2025' ? 404 : 400).json({ success: false, message: error.message || 'Program gagal diperbarui.' }); }
});

router.delete('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try { await prisma.parcelProgram.update({ where: { id: req.params.id }, data: { isActive: false } }); return res.json({ success: true, message: 'Program berhasil dihapus.' }); }
  catch (error) { return res.status(404).json({ success: false, message: error.message || 'Program gagal dihapus.' }); }
});

export default router;