import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import parcelRoutes from './routes/parcelRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
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

dotenv.config();

const app = express();

app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Glosir API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/finance', financeRoutes);
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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

export default app;
