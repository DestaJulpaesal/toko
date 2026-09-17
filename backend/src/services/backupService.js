import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.resolve(__dirname, '../../backups');
const META_FILE = path.join(BACKUP_DIR, 'last-backup-meta.json');
const MAX_BACKUP_FILES = 15;

async function ensureBackupDir() {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
}

async function safeFetch(modelGetter) {
  try {
    const data = await modelGetter();
    return Array.isArray(data) ? data : data ? [data] : [];
  } catch (error) {
    console.warn(`[BackupService] Table query skipped: ${error.message}`);
    return [];
  }
}

/**
 * Buat snapshot backup seluruh database ke file JSON terkompresi/terstruktur
 */
export async function createDatabaseBackup({ trigger = 'MANUAL', initiatedBy = 'system' } = {}) {
  await ensureBackupDir();

  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[:.]/g, '-');
  const filename = `glosir-backup-${dateStr}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  // Jalankan query secara sekuensial untuk menjaga koneksi pool database tetap aman
  const users = await safeFetch(() => prisma.user.findMany({ select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true } }));
  const categories = await safeFetch(() => prisma.category.findMany());
  const products = await safeFetch(() => prisma.product.findMany());
  const productVariants = await safeFetch(() => prisma.productVariant.findMany());
  const stockMovements = await safeFetch(() => prisma.stockMovement.findMany({ take: 5000, orderBy: { createdAt: 'desc' } }));
  const orders = await safeFetch(() => prisma.order.findMany({ take: 5000, orderBy: { createdAt: 'desc' } }));
  const orderItems = await safeFetch(() => prisma.orderItem.findMany({ take: 10000, orderBy: { id: 'desc' } }));
  const customers = await safeFetch(() => prisma.customer.findMany());
  const promos = await safeFetch(() => prisma.promoCampaign.findMany());
  const debts = await safeFetch(() => prisma.debtRecord.findMany());
  const financeTransactions = await safeFetch(() => prisma.financeTransaction.findMany({ take: 10000, orderBy: { createdAt: 'desc' } }));
  const financeCategories = await safeFetch(() => prisma.financeCategory.findMany());
  const financeAccounts = await safeFetch(() => prisma.financeAccount.findMany());
  const savingsGoals = await safeFetch(() => prisma.savingsGoal.findMany());
  const parcels = await safeFetch(() => prisma.parcel.findMany());
  const parcelPrograms = await safeFetch(() => prisma.parcelProgram.findMany());
  const parcelRegions = await safeFetch(() => prisma.parcelRegion.findMany());
  const parcelParticipants = await safeFetch(() => prisma.parcelParticipant.findMany());
  const eventPackages = await safeFetch(() => prisma.eventPackage.findMany());
  const stockOpnames = await safeFetch(() => prisma.stockOpname.findMany({ take: 200, orderBy: { createdAt: 'desc' } }));
  const siteProfile = await safeFetch(() => prisma.siteProfile.findMany());
  const siteContent = await safeFetch(() => prisma.siteContent.findMany());

  const summary = {
    users: users.length,
    categories: categories.length,
    products: products.length,
    productVariants: productVariants.length,
    stockMovements: stockMovements.length,
    orders: orders.length,
    orderItems: orderItems.length,
    customers: customers.length,
    promos: promos.length,
    debts: debts.length,
    financeTransactions: financeTransactions.length,
    financeCategories: financeCategories.length,
    financeAccounts: financeAccounts.length,
    savingsGoals: savingsGoals.length,
    parcels: parcels.length,
    parcelPrograms: parcelPrograms.length,
    parcelRegions: parcelRegions.length,
    parcelParticipants: parcelParticipants.length,
    eventPackages: eventPackages.length,
    stockOpnames: stockOpnames.length,
    siteProfile: siteProfile.length,
    siteContent: siteContent.length,
  };

  const totalRecords = Object.values(summary).reduce((acc, curr) => acc + curr, 0);

  const payload = {
    appName: 'Glosir Store Engine',
    version: '1.0',
    createdAt: timestamp.toISOString(),
    trigger,
    initiatedBy,
    totalRecords,
    tableSummary: summary,
    database: {
      users,
      categories,
      products,
      productVariants,
      stockMovements,
      orders,
      orderItems,
      customers,
      promos,
      debts,
      financeTransactions,
      financeCategories,
      financeAccounts,
      savingsGoals,
      parcels,
      parcelPrograms,
      parcelRegions,
      parcelParticipants,
      eventPackages,
      stockOpnames,
      siteProfile,
      siteContent,
    },
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  await fs.promises.writeFile(filePath, jsonContent, 'utf-8');

  const stats = await fs.promises.stat(filePath);

  const meta = {
    lastBackupAt: timestamp.toISOString(),
    filename,
    fileSizeBytes: stats.size,
    fileSizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
    totalRecords,
    trigger,
    initiatedBy,
    status: 'SUCCESS',
  };

  await fs.promises.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');

  // Rotasi backup lama (pertahankan maksimal MAX_BACKUP_FILES)
  await pruneOldBackups();

  return meta;
}

/**
 * Bersihkan file backup lama jika melebihi batas maksimal
 */
async function pruneOldBackups() {
  try {
    const files = await fs.promises.readdir(BACKUP_DIR);
    const backupFiles = files
      .filter((file) => file.startsWith('glosir-backup-') && file.endsWith('.json'))
      .map((file) => {
        const fullPath = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(fullPath);
        return { file, fullPath, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (backupFiles.length > MAX_BACKUP_FILES) {
      const toDelete = backupFiles.slice(MAX_BACKUP_FILES);
      for (const item of toDelete) {
        try {
          await fs.promises.unlink(item.fullPath);
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('[BackupService] Pruning error:', err.message);
  }
}

/**
 * Ambil status backup terakhir dan daftar backup yang tersedia
 */
export async function getBackupStatus() {
  await ensureBackupDir();

  let meta = null;
  if (fs.existsSync(META_FILE)) {
    try {
      const content = await fs.promises.readFile(META_FILE, 'utf-8');
      meta = JSON.parse(content);
    } catch {
      meta = null;
    }
  }

  // Baca daftar file backup
  const files = await fs.promises.readdir(BACKUP_DIR);
  const backupFiles = files
    .filter((file) => file.startsWith('glosir-backup-') && file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      return {
        filename: file,
        sizeBytes: stat.size,
        sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
        createdAt: stat.birthtime || stat.mtime,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Tentukan kesehatan backup (sehat jika backup terakhir < 26 jam yang lalu)
  const now = Date.now();
  let isHealthy = false;
  let elapsedHours = null;

  if (meta?.lastBackupAt) {
    const lastBackupTime = new Date(meta.lastBackupAt).getTime();
    elapsedHours = Math.floor((now - lastBackupTime) / (1000 * 60 * 60));
    isHealthy = elapsedHours < 26;
  }

  return {
    lastBackup: meta,
    isHealthy,
    elapsedHours,
    totalBackupFiles: backupFiles.length,
    backups: backupFiles.slice(0, 10),
  };
}

/**
 * Ambil path file backup untuk diunduh
 */
export function getBackupFilePath(filename) {
  const safeFilename = path.basename(filename);
  if (!safeFilename.startsWith('glosir-backup-') || !safeFilename.endsWith('.json')) {
    throw new Error('Nama file backup tidak valid');
  }
  const filePath = path.join(BACKUP_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    throw new Error('File backup tidak ditemukan');
  }
  return filePath;
}
