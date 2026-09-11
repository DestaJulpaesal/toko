import express from 'express';
import prisma from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

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

const fallbackContent = [
  {
    id: 'fallback-terms',
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
    id: 'fallback-privacy',
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
    id: 'fallback-contact',
    type: 'CONTACT',
    title: 'Contact Us',
    content: `Hubungi Glosir untuk kebutuhan produk, paket acara, atau pertanyaan lain.\n\nWhatsApp: 0812-3456-7890\nEmail: hello@glosir.id\nAlamat: Kota Anda / Area sekitar toko\nJam operasional: Senin - Sabtu, 08.00 - 18.00 WIB`,
    slug: 'contact-us',
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'fallback-faq',
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
    id: 'fallback-help',
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
    id: 'fallback-testimonial',
    type: 'TESTIMONIAL',
    title: 'Testimoni / Ulasan',
    content: `"Pelayanannya ramah dan proses order cepat. Produk sesuai kebutuhan dan kualitas tetap terjaga." - Ibu Sari\n\n"Paket acara yang dibuat sangat rapi dan sesuai budget keluarga kami." - Bapak Rudi\n\n"Cocok untuk kebutuhan usaha kecil, pengiriman tepat waktu, dan komunikasi sangat jelas." - Toko Kue Nusantara`,
    slug: 'testimoni-ulasan',
    sortOrder: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const defaultContentSeed = fallbackContent.map(({ id, ...rest }) => rest);

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

function makeFallbackFilter(type, publishedOnly) {
  return fallbackContent.filter((item) => {
    const matchesType = type ? item.type === type : true;
    const matchesPublished = publishedOnly ? item.isPublished : true;
    return matchesType && matchesPublished;
  });
}

function fallbackReadAll({ type = null, publishedOnly = false } = {}) {
  return makeFallbackFilter(type, publishedOnly).map((item) => ({ ...item, createdAt: new Date(item.createdAt), updatedAt: new Date(item.updatedAt) }));
}

function isPrismaUnavailableError(error) {
  const message = error?.message || '';
  return /Cannot read properties of undefined|does not exist|relation .* does not exist|Undefined column|P2021|P2022/i.test(message);
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

    try {
      if (requestedType) {
        const items = await prisma.siteContent.findMany({
          where: { type: requestedType, isPublished: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        return res.json({
          success: true,
          data: {
            type: requestedType,
            items: items.map(formatContent),
            item: items[0] ? formatContent(items[0]) : null,
          },
        });
      }

      const payload = {};
      for (const key of PUBLIC_TYPES) {
        const type = TYPE_MAP[key];
        const items = await prisma.siteContent.findMany({
          where: { type, isPublished: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        payload[key] = items.map(formatContent);
      }

      return res.json({ success: true, data: payload });
    } catch (prismaError) {
      if (!isPrismaUnavailableError(prismaError)) {
        throw prismaError;
      }

      const items = fallbackReadAll({ type: requestedType, publishedOnly: true });
      const item = requestedType ? items[0] || null : null;
      return res.json({
        success: true,
        data: requestedType ? { type: requestedType, items: items.map(formatContent), item: item ? formatContent(item) : null } : Object.fromEntries(PUBLIC_TYPES.map((key) => [key, fallbackReadAll({ type: TYPE_MAP[key], publishedOnly: true }).map(formatContent)])),
      });
    }
  } catch (error) {
    console.error('Public site content load failed:', error.message);
    return res.status(500).json({ success: false, message: 'Konten publik gagal dimuat.' });
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

    try {
      const items = await prisma.siteContent.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      return res.json({ success: true, items: items.map(formatContent) });
    } catch (prismaError) {
      if (!isPrismaUnavailableError(prismaError)) {
        throw prismaError;
      }

      return res.json({ success: true, items: fallbackReadAll({ type: normalizedType, publishedOnly: publishedOnly === 'true' }).map(formatContent) });
    }
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

router.post('/', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
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

    try {
      const slugBase = slugify(trimmedTitle) || 'konten';
      const existingSlug = await prisma.siteContent.findFirst({
        where: { slug: slugBase },
        select: { id: true },
      });

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
    } catch (prismaError) {
      if (!isPrismaUnavailableError(prismaError)) {
        throw prismaError;
      }

      const item = {
        id: `fallback-${Date.now()}`,
        type: normalizedType,
        title: trimmedTitle,
        slug: slugify(trimmedTitle) || 'konten',
        content: trimmedContent,
        sortOrder: Number(sortOrder) || 0,
        isPublished: Boolean(isPublished),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fallbackContent.push(item);
      return res.status(201).json({ success: true, item: formatContent(item), message: 'Konten berhasil ditambahkan.' });
    }
  } catch (error) {
    console.error('Site content create failed:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Konten gagal disimpan.' });
  }
});

router.patch('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
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

    try {
      const item = await prisma.siteContent.update({ where: { id: req.params.id }, data: payload });
      return res.json({ success: true, item: formatContent(item), message: 'Konten berhasil diperbarui.' });
    } catch (prismaError) {
      if (!isPrismaUnavailableError(prismaError)) {
        throw prismaError;
      }

      const index = fallbackContent.findIndex((item) => item.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Konten tidak ditemukan.' });
      }

      fallbackContent[index] = { ...fallbackContent[index], ...payload, updatedAt: new Date() };
      return res.json({ success: true, item: formatContent(fallbackContent[index]), message: 'Konten berhasil diperbarui.' });
    }
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 400).json({
      success: false,
      message: error.code === 'P2025' ? 'Konten tidak ditemukan.' : error.message || 'Konten gagal diperbarui.',
    });
  }
});

router.delete('/:id', authenticateToken, requireRole('OWNER', 'ADMIN'), async (req, res) => {
  try {
    try {
      await prisma.siteContent.delete({ where: { id: req.params.id } });
      return res.json({ success: true, message: 'Konten berhasil dihapus.' });
    } catch (prismaError) {
      if (!isPrismaUnavailableError(prismaError)) {
        throw prismaError;
      }

      const index = fallbackContent.findIndex((item) => item.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Konten tidak ditemukan.' });
      }

      fallbackContent.splice(index, 1);
      return res.json({ success: true, message: 'Konten berhasil dihapus.' });
    }
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({
      success: false,
      message: error.code === 'P2025' ? 'Konten tidak ditemukan.' : 'Konten gagal dihapus.',
    });
  }
});

export default router;
