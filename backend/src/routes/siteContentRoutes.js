import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  contactMessageLimiter,
  validateBody,
  contactMessageSchema,
  siteContentCreateSchema,
  siteContentUpdateSchema,
} from '../middleware/security.js';

const router = express.Router();

const TYPE_MAP = {
  terms: 'TERMS',
  privacy: 'PRIVACY',
  contact: 'CONTACT',
  faq: 'FAQ',
  help: 'HELP',
  testimonials: 'TESTIMONIAL',
};

const PUBLIC_TYPES = Object.keys(TYPE_MAP);

const defaultContent = [
  {
    type: 'TERMS',
    title: 'Syarat & Ketentuan',
    content: `1. Pelanggan wajib memastikan data pemesanan yang dikirim sudah benar sebelum order dikonfirmasi.\n\n2. Pembayaran harus dilakukan sesuai metode yang disepakati dan konfirmasi pembayaran segera dikirim setelah transaksi selesai.\n\n3. Produk yang dipesan akan diproses sesuai stok yang tersedia pada saat order dibuat.\n\n4. Pengiriman dilakukan sesuai kesepakatan jadwal, wilayah, dan biaya yang disetujui sebelumnya.\n\n5. Komplain barang dapat diajukan dalam waktu 1x24 jam setelah paket diterima dengan bukti foto dan informasi lengkap.`,
    slug: 'syarat-ketentuan',
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'PRIVACY',
    title: 'Kebijakan Privasi',
    content: `Kami menghormati privasi pelanggan. Data yang kami kumpulkan meliputi nama, nomor telepon, alamat pengiriman, dan kebutuhan pesanan untuk keperluan proses transaksi dan layanan.\n\nData pelanggan tidak akan dibagikan ke pihak ketiga tanpa persetujuan, kecuali untuk kebutuhan pengiriman atau layanan yang dibutuhkan secara teknis.\n\nKami menggunakan data pelanggan secara aman untuk kebutuhan administrasi, komunikasi, dan peningkatan layanan. Pelanggan dapat meminta pembaruan atau penghapusan data sesuai ketentuan yang berlaku.`,
    slug: 'kebijakan-privasi',
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'CONTACT',
    title: 'Contact Us',
    content: 'Hubungi Glosir untuk kebutuhan produk, paket acara, atau pertanyaan lain melalui informasi kontak pada halaman ini.',
    slug: 'contact-us',
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'FAQ',
    title: 'Pusat Bantuan / FAQ',
    content: `Q: Apakah bisa pesan dengan jumlah banyak?\nA: Ya, kami menerima pesanan untuk kebutuhan rumah tangga, usaha, maupun acara khusus dengan kapasitas yang disesuaikan.\n\nQ: Bagaimana cara proses pembayaran?\nA: Pembayaran dapat dilakukan sesuai metode yang disepakati, lalu konfirmasi akan kami proses setelah data pembayaran diterima.\n\nQ: Apakah tersedia paket custom?\nA: Tersedia, terutama untuk kebutuhan parcel, paket acara, dan kebutuhan usaha dengan pilihan yang bisa disesuaikan.`,
    slug: 'pusat-bantuan-faq',
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'HELP',
    title: 'Pusat Bantuan',
    content: `Jika Anda membutuhkan bantuan, kami siap membantu melalui WhatsApp, telepon, atau chat langsung.\n\n- Cek status pesanan\n- Tanya stok produk\n- Konsultasi paket sesuai kebutuhan\n- Permintaan custom order\n\nTim kami akan merespons secepat mungkin untuk membantu proses pembelian.`,
    slug: 'pusat-bantuan',
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'TESTIMONIAL',
    title: 'Testimoni / Ulasan',
    content: 'Belum ada testimoni pelanggan yang dipublikasikan.',
    slug: 'testimoni-ulasan',
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const defaultContentSeed = defaultContent;

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeType(input) {
  const value = String(input || '').trim().toLowerCase();
  return TYPE_MAP[value] || null;
}

function formatContent(item) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    slug: item.slug,
    content: item.content,
    sortOrder: item.sortOrder,
    isPublished: item.isPublished,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function ensureSeedData() {
  const existing = await prisma.siteContent.findMany({ select: { type: true } });
  const usedTypes = new Set(existing.map((item) => item.type));
  const missing = defaultContentSeed.filter((seed) => !usedTypes.has(seed.type));

  if (missing.length === 0) {
    return;
  }

  await Promise.all(
    missing.map((seed) =>
      prisma.siteContent.create({
        data: {
          type: seed.type,
          title: seed.title,
          slug: slugify(seed.title),
          content: seed.content,
          sortOrder: 0,
          isPublished: true,
        },
      })
    )
  );
}

router.get('/public', async (req, res) => {
  try {
    await ensureSeedData();
    const requestedType = normalizeType(req.query.type || '');
    if (requestedType) {
      const items = await prisma.siteContent.findMany({
        where: { type: requestedType, isPublished: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return res.json({ success: true, data: { type: requestedType, items: items.map(formatContent), item: items[0] ? formatContent(items[0]) : null } });
    }
    const payload = {};
    for (const key of PUBLIC_TYPES) {
      const items = await prisma.siteContent.findMany({
        where: { type: TYPE_MAP[key], isPublished: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      payload[key] = items.map(formatContent);
    }
    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('Public site content load failed:', error.message);
    return res.status(500).json({ success: false, message: 'Konten publik gagal dimuat.' });
  }
});

router.post('/messages', contactMessageLimiter, validateBody(contactMessageSchema), async (req, res) => {
  try {
    const { name, phone, message } = req.body;
    await prisma.contactMessage.create({
      data: { name, phone, message },
    });
    return res.status(201).json({ success: true, message: 'Pesan berhasil dikirim. Tim Glosir akan meninjau pesan Anda.' });
  } catch (error) {
    console.error('Contact message submission failed:', error.message);
    return res.status(500).json({ success: false, message: 'Pesan belum bisa disimpan. Silakan coba lagi.' });
  }
});

router.get('/messages', authenticateToken, requireRole('OWNER'), async (_req, res) => {
  try {
    const [messages, unreadCount, totalCount] = await Promise.all([
      prisma.contactMessage.findMany({
        select: { id: true, name: true, phone: true, message: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.contactMessage.count({ where: { status: 'NEW' } }),
      prisma.contactMessage.count(),
    ]);
    return res.json({ success: true, messages, unreadCount, totalCount });
  } catch (error) {
    console.error('Contact inbox load failed:', error.message);
    return res.status(503).json({ success: false, message: 'Pesan masuk belum bisa dimuat.' });
  }
});

router.patch('/messages/:id/read', authenticateToken, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await prisma.contactMessage.updateMany({
      where: { id: req.params.id, status: 'NEW' },
      data: { status: 'READ' },
    });
    if (!result.count) {
      const message = await prisma.contactMessage.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true },
      });
      if (!message) return res.status(404).json({ success: false, message: 'Pesan tidak ditemukan.' });
      return res.json({ success: true, message: 'Pesan sudah dibaca.' });
    }
    return res.json({ success: true, message: 'Pesan ditandai sudah dibaca.' });
  } catch (error) {
    console.error('Contact message read update failed:', error.message);
    return res.status(503).json({ success: false, message: 'Status pesan belum bisa diperbarui.' });
  }
});

router.delete('/messages/:id', authenticateToken, requireRole('OWNER'), async (req, res) => {
  try {
    const result = await prisma.contactMessage.deleteMany({ where: { id: req.params.id } });
    if (!result.count) return res.status(404).json({ success: false, message: 'Pesan tidak ditemukan.' });
    return res.json({ success: true, deletedCount: result.count, message: 'Pesan berhasil dihapus.' });
  } catch (error) {
    console.error('Contact message delete failed:', error.message);
    return res.status(503).json({ success: false, message: 'Pesan belum bisa dihapus.' });
  }
});

router.delete('/messages', authenticateToken, requireRole('OWNER'), async (_req, res) => {
  try {
    const result = await prisma.contactMessage.deleteMany();
    return res.json({ success: true, deletedCount: result.count, message: 'Semua pesan berhasil dihapus.' });
  } catch (error) {
    console.error('Contact messages bulk delete failed:', error.message);
    return res.status(503).json({ success: false, message: 'Semua pesan belum bisa dihapus.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { type, publishedOnly = 'false' } = req.query || {};
    const normalizedType = normalizeType(type);
    const where = {
      ...(normalizedType ? { type: normalizedType } : {}),
      ...(publishedOnly === 'true' ? { isPublished: true } : {}),
    };

    const items = await prisma.siteContent.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return res.json({ success: true, items: items.map(formatContent) });
  } catch (error) {
    console.error('Site content list failed:', error.message);
    return res.status(500).json({ success: false, message: 'Daftar konten gagal dimuat.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.siteContent.findUnique({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Konten tidak ditemukan.' });
    }
    return res.json({ success: true, item: formatContent(item) });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Konten gagal dimuat.' });
  }
});

router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(siteContentCreateSchema), async (req, res) => {
  try {
    const { type, title, content, sortOrder = 0, isPublished = true } = req.body || {};
    const normalizedType = normalizeType(type);
    const trimmedTitle = String(title || '').trim();
    const trimmedContent = String(content || '').trim();

    if (!normalizedType) {
      return res.status(400).json({ success: false, message: 'Tipe konten tidak valid.' });
    }

    if (!trimmedTitle || !trimmedContent) {
      return res.status(400).json({ success: false, message: 'Judul dan isi konten wajib diisi.' });
    }

    const slugBase = slugify(trimmedTitle) || 'konten';
    const existingSlug = await prisma.siteContent.findFirst({ where: { slug: slugBase }, select: { id: true } });
    const item = await prisma.siteContent.create({
      data: {
        type: normalizedType,
        title: trimmedTitle,
        slug: existingSlug ? `${slugBase}-${Date.now()}` : slugBase,
        content: trimmedContent,
        sortOrder: Number(sortOrder) || 0,
        isPublished: Boolean(isPublished),
      },
    });
    return res.status(201).json({ success: true, item: formatContent(item), message: 'Konten berhasil ditambahkan.' });
  } catch (error) {
    console.error('Site content create failed:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Konten gagal disimpan.' });
  }
});

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), validateBody(siteContentUpdateSchema), async (req, res) => {
  try {
    const { type, title, content, sortOrder, isPublished } = req.body || {};
    const payload = {};

    if (type !== undefined) {
      const normalizedType = normalizeType(type);
      if (!normalizedType) {
        return res.status(400).json({ success: false, message: 'Tipe konten tidak valid.' });
      }
      payload.type = normalizedType;
    }

    if (title !== undefined) {
      const trimmedTitle = String(title || '').trim();
      if (!trimmedTitle) {
        return res.status(400).json({ success: false, message: 'Judul konten wajib diisi.' });
      }
      payload.title = trimmedTitle;
      payload.slug = slugify(trimmedTitle) || 'konten';
    }

    if (content !== undefined) {
      const trimmedContent = String(content || '').trim();
      if (!trimmedContent) {
        return res.status(400).json({ success: false, message: 'Isi konten wajib diisi.' });
      }
      payload.content = trimmedContent;
    }

    if (sortOrder !== undefined) {
      payload.sortOrder = Number(sortOrder) || 0;
    }

    if (isPublished !== undefined) {
      payload.isPublished = Boolean(isPublished);
    }

    const item = await prisma.siteContent.update({ where: { id: req.params.id }, data: payload });
    return res.json({ success: true, item: formatContent(item), message: 'Konten berhasil diperbarui.' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({
      success: false,
      message: error.code === 'P2025' ? 'Konten tidak ditemukan.' : error.message || 'Konten gagal diperbarui.',
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    await prisma.siteContent.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'Konten berhasil dihapus.' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      message: error.code === 'P2025' ? 'Konten tidak ditemukan.' : 'Konten gagal dihapus.',
    });
  }
});

export default router;
