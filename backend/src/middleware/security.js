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
    variantId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
  })).min(1, 'Keranjang belanja masih kosong'),
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
