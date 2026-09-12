import rateLimit from 'express-rate-limit';
import { z } from 'zod';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit.' },
});

export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan checkout. Coba lagi sebentar.' },
});

export const loginSchema = z.object({
  email: z.string().trim().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const checkoutSchema = z.object({
  items: z.array(z.object({
    variantId: z.string().min(1).optional(),
    eventPackageId: z.string().min(1).optional(),
    parcelId: z.string().min(1).optional(),
    quantity: z.coerce.number().int().positive(),
  }).refine((item) => item.variantId || item.eventPackageId || item.parcelId, 'Item harus memiliki produk atau paket')).min(1, 'Keranjang belanja masih kosong'),
  paidAmount: z.coerce.number().nonnegative(),
  paymentMethod: z.enum(['CASH', 'QRIS', 'TRANSFER']).default('CASH'),
  paymentReference: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerType: z.enum(['RETAIL', 'WHOLESALE']).default('RETAIL'),
  cashierName: z.string().optional(),
  redeemedPoints: z.coerce.number().int().nonnegative().default(0),
  discount: z.coerce.number().nonnegative().default(0),
}).passthrough();

export const onlineOrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Nama pelanggan wajib diisi'),
  customerPhone: z.string().trim().min(8, 'Nomor WhatsApp wajib diisi'),
  address: z.string().trim().min(5, 'Alamat wajib diisi'),
  note: z.string().trim().optional().default(''),
  promoCode: z.string().trim().optional().default(''),
  shippingCost: z.coerce.number().nonnegative().default(25000),
  items: z.array(z.object({
    variantId: z.string().min(1).optional(),
    parcelId: z.string().min(1).optional(),
    eventPackageId: z.string().min(1).optional(),
    quantity: z.coerce.number().int().positive(),
  }).refine((item) => item.variantId || item.parcelId || item.eventPackageId, 'Item pesanan tidak valid')).min(1, 'Keranjang belanja masih kosong'),
});

// ---- Kategori ----
export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nama kategori wajib diisi'),
  description: z.string().trim().optional().nullable().default(''),
});

// ---- Pelanggan ----
export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama pelanggan wajib diisi'),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  points: z.coerce.number().optional().default(0),
});
export const customerUpdateSchema = customerCreateSchema.partial().extend({
  name: z.string().trim().min(1, 'Nama pelanggan wajib diisi'),
});

// ---- Piutang ----
export const debtCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer wajib diisi'),
  amount: z.coerce.number('Nominal hutang wajib diisi'),
  status: z.enum(['OPEN', 'PAID']).optional().default('OPEN'),
  dueDate: z.union([z.string(), z.date()]).optional().nullable(),
  description: z.string().trim().optional().nullable(),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
}).passthrough();
export const debtUpdateSchema = z.object({
  amount: z.coerce.number().optional(),
  status: z.enum(['OPEN', 'PAID']).optional(),
  dueDate: z.union([z.string(), z.date()]).optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

// ---- Keuangan ----
export const financeCreateSchema = z.object({
  orderId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'DEBT']),
  amount: z.coerce.number(),
  description: z.string().trim().min(1, 'Keterangan wajib diisi'),
  category: z.string().trim().optional().nullable(),
  paymentMethod: z.string().trim().optional().nullable(),
});
export const financeUpdateSchema = financeCreateSchema.partial();

// ---- Penagihan Parsel ----
export const parcelCollectionCreateSchema = z.object({
  regionId: z.string().min(1, 'Wilayah wajib diisi'),
  collectionDate: z.union([z.string(), z.date()]).optional().nullable(),
  note: z.string().trim().optional().nullable(),
  entries: z.array(z.object({
    participantId: z.string().min(1),
    amount: z.coerce.number(),
    note: z.string().trim().optional().nullable(),
  })).min(1, 'Minimal satu setoran peserta wajib diisi'),
});
export const parcelCollectionVerifySchema = z.object({
  actualCash: z.coerce.number().nonnegative('Nominal cash diterima tidak valid'),
  note: z.string().trim().optional().nullable(),
});

// ---- Akun manager/kasir ----
export const managerCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi'),
  email: z.string().trim().min(1, 'Email wajib diisi'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  phone: z.string().trim().optional().nullable(),
  regionId: z.string().optional().nullable(),
});
export const managerUpdateSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
  phone: z.string().trim().optional().nullable(),
  regionId: z.string().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

// ---- Peserta parsel ----
export const parcelParticipantCreateSchema = z.object({
  customerId: z.string().optional().nullable(),
  participantPhone: z.string().trim().optional().nullable(),
  participantName: z.string().trim().optional(),
  parcelId: z.string().optional().nullable(),
  programId: z.string().min(1, 'Program wajib diisi'),
  name: z.string().trim().optional(),
  regionId: z.string().optional().nullable(),
  targetAmount: z.coerce.number().optional(),
  contributionAmount: z.coerce.number().positive('Nominal setoran wajib diisi'),
  salePrice: z.coerce.number().optional(),
  grossMargin: z.coerce.number().optional(),
  managerCommission: z.coerce.number().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY']).optional().default('DAILY'),
  startDate: z.union([z.string(), z.date()]).optional().nullable(),
  endDate: z.union([z.string(), z.date()]).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
}).passthrough();
export const parcelParticipantUpdateSchema = parcelParticipantCreateSchema.partial().extend({
  status: z.string().optional(),
});
export const parcelContributionSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  paidAt: z.union([z.string(), z.date()]).optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

// ---- Program parsel ----
export const parcelProgramCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama program wajib diisi'),
  year: z.coerce.number().int().positive('Tahun wajib diisi'),
  targetAmount: z.coerce.number().positive('Target wajib diisi'),
  notes: z.string().trim().optional().nullable(),
});
export const parcelProgramUpdateSchema = parcelProgramCreateSchema.partial();

// ---- Wilayah parsel ----
export const parcelRegionCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wilayah wajib diisi'),
  code: z.string().trim().min(1, 'Kode wilayah wajib diisi'),
  managerId: z.string().optional().nullable(),
});
export const parcelRegionUpdateSchema = z.object({
  name: z.string().trim().optional(),
  code: z.string().trim().optional(),
  managerId: z.string().optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

// ---- Produk ----
export const productCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama produk wajib diisi'),
  sku: z.string().trim().optional().nullable(),
  barcode: z.string().trim().optional().nullable(),
  category: z.string().trim().min(1, 'Kategori wajib diisi'),
  price: z.coerce.number('Harga wajib diisi'),
  wholesalePrice: z.coerce.number().optional().nullable(),
  purchasePrice: z.coerce.number().optional().nullable(),
  originalPrice: z.coerce.number().optional().nullable(),
  stock: z.coerce.number('Stok wajib diisi'),
  status: z.string().optional().default('Aktif'),
}).passthrough();
export const productUpdateSchema = productCreateSchema;
export const productBulkSchema = z.object({
  products: z.array(z.object({
    name: z.string().trim().min(1),
    sku: z.string().trim().optional().nullable(),
    barcode: z.string().trim().optional().nullable(),
    category: z.string().trim().min(1),
    price: z.coerce.number(),
    wholesalePrice: z.coerce.number().optional().nullable(),
    purchasePrice: z.coerce.number().optional().nullable(),
    originalPrice: z.coerce.number().optional().nullable(),
    stock: z.coerce.number(),
    unit: z.string().trim().optional(),
    status: z.string().optional(),
  }).passthrough()).min(1, 'Minimal satu produk wajib dikirim'),
});

// ---- Promo ----
export const promoCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama promo wajib diisi'),
  description: z.string().trim().optional().nullable().default(''),
  discountType: z.enum(['PERCENT', 'FIXED']).optional().default('PERCENT'),
  discountValue: z.coerce.number().optional().default(0),
  startsAt: z.union([z.string(), z.date()]).optional().nullable(),
  endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  isActive: z.coerce.boolean().optional().default(true),
});
export const promoUpdateSchema = promoCreateSchema.partial();

// ---- Konten situs ----
export const siteContentCreateSchema = z.object({
  type: z.string().trim().min(1, 'Tipe konten wajib diisi'),
  title: z.string().trim().min(1, 'Judul konten wajib diisi'),
  content: z.string().trim().min(1, 'Isi konten wajib diisi'),
  sortOrder: z.coerce.number().optional().default(0),
  isPublished: z.coerce.boolean().optional().default(true),
});
export const siteContentUpdateSchema = siteContentCreateSchema.partial();

// ---- Profil situs ----
export const siteProfileUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi'),
  email: z.string().trim().min(1, 'Email wajib diisi'),
  phone: z.string().trim().min(1, 'WhatsApp wajib diisi'),
  headline: z.string().trim().optional().nullable(),
  story: z.string().trim().optional().nullable(),
  photoUrl: z.string().trim().optional().nullable(),
});

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Data yang dikirim belum valid.',
        errors: result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      });
    }
    req.body = result.data;
    return next();
  };
}
