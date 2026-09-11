import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const ownerEmail = 'owner@glosir.com';
const defaultProfile = {
  name: 'Owner Glosir',
  email: ownerEmail,
  phone: '081234567890',
  headline: 'Usaha keluarga yang tumbuh dari kebutuhan sehari-hari.',
  story: 'Glosir hadir untuk membantu keluarga, pemilik usaha kecil, dan panitia acara mendapatkan kebutuhan penting dengan cara yang lebih praktis.',
};

async function getOwner() {
  return prisma.user.findFirst({ where: { role: 'OWNER' }, orderBy: { createdAt: 'asc' } });
}

async function getSiteProfile() {
  return prisma.siteProfile.findUnique({ where: { id: 'main' } });
}

function formatProfile(owner, siteProfile) {
  return {
    name: owner?.name || defaultProfile.name,
    email: owner?.email || defaultProfile.email,
    phone: owner?.phone || defaultProfile.phone,
    headline: siteProfile?.headline || defaultProfile.headline,
    story: siteProfile?.story || defaultProfile.story,
    photoUrl: siteProfile?.photoUrl || '',
  };
}

router.get('/', async (req, res) => {
  try {
    return res.json({ success: true, profile: formatProfile(await getOwner(), await getSiteProfile()) });
  } catch (error) {
    console.error('Public profile load failed:', error.message);
    return res.status(500).json({ success: false, message: 'Profil pemilik gagal dimuat' });
  }
});

router.patch('/', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { name, email, phone, headline, story, photoUrl } = req.body || {};
    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPhone = String(phone || '').trim();
    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      return res.status(400).json({ success: false, message: 'Nama, email, dan WhatsApp wajib diisi' });
    }

    const owner = await getOwner();
    const saved = owner
      ? await prisma.user.update({ where: { id: owner.id }, data: { name: trimmedName, email: trimmedEmail, phone: trimmedPhone } })
      : await prisma.user.create({ data: { name: trimmedName, email: trimmedEmail, phone: trimmedPhone, passwordHash: 'disabled', role: 'OWNER' } });
    const siteProfile = await prisma.siteProfile.upsert({
      where: { id: 'main' },
      update: { headline: String(headline || defaultProfile.headline).trim(), story: String(story || defaultProfile.story).trim(), photoUrl: photoUrl ? String(photoUrl) : null },
      create: { id: 'main', headline: String(headline || defaultProfile.headline).trim(), story: String(story || defaultProfile.story).trim(), photoUrl: photoUrl ? String(photoUrl) : null },
    });

    return res.json({
      success: true,
      profile: formatProfile(saved, siteProfile),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.code === 'P2002' ? 'Email pemilik sudah digunakan' : 'Profil pemilik gagal disimpan' });
  }
});

export default router;
