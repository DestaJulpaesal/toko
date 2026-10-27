import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads', 'catalog');
const groups = new Set(['products', 'parcels', 'event-packages', 'categories']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new Error('Gunakan gambar JPG, PNG, atau WebP.'));
      return;
    }
    callback(null, true);
  },
});

const imageFormats = {
  'image/jpeg': {
    extension: 'jpg',
    matches: (buffer) => buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    matches: (buffer) => buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp',
    matches: (buffer) => buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
};

router.post(
  '/catalog-image',
  authenticateToken,
  requireRole('OWNER', 'ADMIN'),
  (req, res, next) => {
    upload.single('image')(req, res, (error) => {
      if (error) {
        return res.status(error instanceof multer.MulterError ? 400 : 415).json({
          success: false,
          message: error.message || 'File gambar tidak valid.',
        });
      }
      return next();
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Pilih file gambar terlebih dahulu.' });

    const group = String(req.body?.group || '').trim();
    if (!groups.has(group)) {
      return res.status(400).json({ success: false, message: 'Jenis katalog gambar tidak valid.' });
    }

    const format = imageFormats[req.file.mimetype];
    if (!format?.matches(req.file.buffer)) {
      return res.status(415).json({ success: false, message: 'Isi file tidak sesuai format gambar yang dipilih.' });
    }

    const filename = `${Date.now()}-${crypto.randomUUID()}.${format.extension}`;
    const relativePath = path.join(group, filename);
    try {
      await fs.mkdir(path.join(uploadDirectory, group), { recursive: true });
      await fs.writeFile(path.join(uploadDirectory, relativePath), req.file.buffer, { flag: 'wx' });
    } catch (error) {
      console.error('Catalog image upload failed:', error.message);
      return res.status(503).json({
        success: false,
        message: 'Gambar tidak dapat disimpan di server. Periksa izin tulis dan kapasitas penyimpanan backend.',
      });
    }

    const publicApiUrl = String(process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    const imageUrl = `${publicApiUrl}/uploads/catalog/${group}/${filename}`;
    return res.status(201).json({ success: true, imageUrl, message: 'Gambar berhasil diunggah.' });
  },
);

export default router;
