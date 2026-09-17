import express from 'express';
import multer from 'multer';
import supabase from '../config/supabase.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const bucket = process.env.SUPABASE_CATALOG_BUCKET || 'catalog-images';
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

const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

router.post('/catalog-image', authenticateToken, requireRole('OWNER', 'ADMIN'), upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Pilih file gambar terlebih dahulu.' });

  const group = String(req.body?.group || '').trim();
  if (!['products', 'parcels', 'event-packages'].includes(group)) {
    return res.status(400).json({ success: false, message: 'Jenis katalog gambar tidak valid.' });
  }

  try {
    const extension = extensions[req.file.mimetype];
    const objectPath = `${group}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, req.file.buffer, {
      contentType: req.file.mimetype,
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return res.status(201).json({ success: true, imageUrl: data.publicUrl, message: 'Gambar berhasil diunggah.' });
  } catch (error) {
    console.error('Catalog image upload failed:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Gambar belum dapat diunggah. Pastikan bucket Supabase "catalog-images" sudah dibuat sebagai public bucket.',
    });
  }
});

export default router;
