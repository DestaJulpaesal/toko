import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import hpp from 'hpp';
import multer from 'multer';

import { apiLimiter } from './middleware/security.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import parcelRoutes from './routes/parcelRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import financeCategoryRoutes from './routes/financeCategoryRoutes.js';
import financeAccountRoutes from './routes/financeAccountRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import recurringTransactionRoutes from './routes/recurringTransactionRoutes.js';
import savingsGoalRoutes from './routes/savingsGoalRoutes.js';
import financeTagRoutes from './routes/financeTagRoutes.js';
import financeReminderRoutes from './routes/financeReminderRoutes.js';
import netWorthRoutes from './routes/netWorthRoutes.js';
import financeApprovalRoutes from './routes/financeApprovalRoutes.js';
import financeAdvancedRoutes from './routes/financeAdvancedRoutes.js';
import path from 'node:path';
import categoryRoutes from './routes/categoryRoutes.js';
import siteProfileRoutes from './routes/siteProfileRoutes.js';
import siteContentRoutes from './routes/siteContentRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import promoRoutes from './routes/promoRoutes.js';
import debtRoutes from './routes/debtRoutes.js';
import parcelParticipantRoutes from './routes/parcelParticipantRoutes.js';
import parcelProgramRoutes from './routes/parcelProgramRoutes.js';
import parcelRegionRoutes from './routes/parcelRegionRoutes.js';
import parcelManagerRoutes from './routes/parcelManagerRoutes.js';
import parcelCollectionRoutes from './routes/parcelCollectionRoutes.js';
import stockOpnameRoutes from './routes/stockOpnameRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import eventPackageRoutes from './routes/eventPackageRoutes.js';
import whatsappWebhookRoutes from './routes/whatsappWebhookRoutes.js';
import restockRoutes from './routes/restockRoutes.js';

dotenv.config();

const app = express();

// Percayakan header X-Forwarded-* dari reverse proxy (Vercel/Nginx/dll) satu hop,
// supaya rate limiter & logging membaca IP asli klien, bukan IP proxy.
app.set('trust proxy', 1);

// crossOriginResourcePolicy dilonggarkan ke 'cross-origin' karena frontend
// (origin/port berbeda) perlu menampilkan gambar dari /uploads di backend ini.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5174' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(hpp());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Glosir API is running' });
});

// Batas laju umum untuk semua endpoint /api (di luar /api/health di atas),
// sebagai lapisan tambahan selain loginLimiter & checkoutLimiter yang sudah ada.
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/finance', financeAdvancedRoutes);
app.use('/api/finance/networth', netWorthRoutes);
app.use('/api/finance/reminders', financeReminderRoutes);
app.use('/api/finance/approvals', financeApprovalRoutes);
app.use('/api/finance/categories', financeCategoryRoutes);
app.use('/api/finance/accounts', financeAccountRoutes);
app.use('/api/finance/budgets', budgetRoutes);
app.use('/api/finance/recurring', recurringTransactionRoutes);
app.use('/api/finance/tags', financeTagRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/savings', savingsGoalRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/site-profile', siteProfileRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/parcel-participants', parcelParticipantRoutes);
app.use('/api/parcel-programs', parcelProgramRoutes);
app.use('/api/parcel-regions', parcelRegionRoutes);
app.use('/api/parcel-managers', parcelManagerRoutes);
app.use('/api/parcel-collections', parcelCollectionRoutes);
app.use('/api/stock-opnames', stockOpnameRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/event-packages', eventPackageRoutes);
app.use('/api/whatsapp/webhook', whatsappWebhookRoutes);
app.use('/api/restock', restockRoutes);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /Hanya file CSV/.test(err?.message || '')) {
    return res.status(400).json({ success: false, message: err.message || 'File yang diunggah tidak valid.' });
  }
  console.error(err.stack);
  return res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;
