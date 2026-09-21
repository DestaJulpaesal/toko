import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import prisma from '../config/db.js';

const defaultPreferences = {
  criticalStock: true,
  overdueDebt: true,
  newOnlineOrder: true,
  onlinePayment: true,
  dailySummary: true,
  backupFailure: true,
  newDeviceLogin: true,
};

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT || '587') === '465',
    auth: { user, pass },
  });
}

export function getNotificationPreferences(value) {
  return { ...defaultPreferences, ...(value && typeof value === 'object' ? value : {}) };
}

export async function sendEmail({ to, subject, html, text, type = 'GENERAL', userId = null }) {
  const log = await prisma.emailLog.create({
    data: { recipient: to, subject, type, status: 'PENDING', userId },
  });
  const transporter = getTransporter();
  if (!transporter) {
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'SKIPPED', error: 'SMTP belum dikonfigurasi.' } });
    return { sent: false, skipped: true, logId: log.id };
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text,
    });
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date() } });
    return { sent: true, logId: log.id };
  } catch (error) {
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: error.message.slice(0, 1000) } });
    console.error('Email gagal dikirim:', error.message);
    return { sent: false, error: error.message, logId: log.id };
  }
}

export function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function appUrl(pathname, token) {
  const baseUrl = String(process.env.APP_BASE_URL || 'http://localhost:5174').replace(/\/$/, '');
  return `${baseUrl}/${pathname.replace(/^\//, '')}?token=${encodeURIComponent(token)}`;
}

export function renderActionEmail({ title, message, actionLabel, actionUrl }) {
  return `<!doctype html><html lang="id"><body style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><h1>${title}</h1><p>${message}</p><p><a href="${actionUrl}" style="display:inline-block;padding:12px 18px;background:#166534;color:#fff;text-decoration:none;border-radius:6px">${actionLabel}</a></p><p>Jika tombol tidak bisa dibuka, salin tautan ini:</p><p>${actionUrl}</p></body></html>`;
}

export { defaultPreferences };
