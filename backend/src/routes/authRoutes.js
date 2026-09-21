import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  changePassword,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  generateToken,
  verifyGoogleCredential,
  verifyCredentials,
} from '../services/authService.js';
import {
  changePasswordSchema,
  emailActionLimiter,
  googleLoginSchema,
  inviteUserSchema,
  loginLimiter,
  loginSchema,
  notificationPreferencesSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  validateBody,
  verifyEmailSchema,
} from '../middleware/security.js';
import { appUrl, getNotificationPreferences, renderActionEmail, sendEmail } from '../services/emailService.js';
import prisma from '../config/db.js';

const router = express.Router();

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password, rememberMe = false } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan password wajib diisi',
    });
  }

  const user = await verifyCredentials(email, password);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Email atau password salah',
    });
  }

  const token = generateToken(user, Boolean(rememberMe));

    return res.json({
    success: true,
    message: 'Login berhasil',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      regionId: user.regionId || null,
    },
      mustChangePassword: Boolean(user.mustChangePassword),
      emailVerificationRequired: !user.emailVerifiedAt,
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(503).json({ success: false, message: 'Login belum bisa diproses. Coba lagi sebentar.' });
  }
});

router.post('/google', loginLimiter, validateBody(googleLoginSchema), async (req, res) => {
  try {
    const user = await verifyGoogleCredential(req.body.credential);
    if (!user) return res.status(401).json({ success: false, message: 'Email Google belum terdaftar di Glosir.' });
    const token = generateToken(user);
    await prisma.auditLog.create({ data: { entityType: 'User', entityId: user.id, field: 'login', newValue: 'google', changedById: user.id } });
    return res.json({
      success: true,
      message: 'Login Google berhasil.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, regionId: user.regionId || null },
      emailVerificationRequired: false,
    });
  } catch (error) {
    console.error('Google login error:', error.message);
    return res.status(401).json({ success: false, message: 'Login Google belum bisa diproses. Coba lagi.' });
  }
});

router.post('/change-password', authenticateToken, validateBody(changePasswordSchema), async (req, res) => {
  try {
    await changePassword(req.user.id, req.body.newPassword);
    return res.json({ success: true, message: 'Password berhasil diganti.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Password belum berhasil diganti. Coba lagi.' });
  }
});

router.post('/request-verification', emailActionLimiter, authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
    if (user.emailVerifiedAt) return res.json({ success: true, message: 'Email sudah terverifikasi.' });
    const token = await createEmailVerificationToken(user.id);
    const actionUrl = appUrl('verify-email', token);
    await sendEmail({
      to: user.email,
      userId: user.id,
      type: 'EMAIL_VERIFICATION',
      subject: 'Verifikasi email Glosir',
      text: `Buka tautan ini untuk memverifikasi email: ${actionUrl}`,
      html: renderActionEmail({ title: 'Verifikasi email Glosir', message: 'Tautan ini berlaku selama 24 jam.', actionLabel: 'Verifikasi email', actionUrl }),
    });
    await prisma.auditLog.create({ data: { entityType: 'User', entityId: user.id, field: 'emailVerification', newValue: 'requested', changedById: user.id } });
    return res.json({ success: true, message: 'Tautan verifikasi sudah dikirim ke email Anda.' });
  } catch (error) {
    console.error('Email verification request failed:', error.message);
    return res.status(503).json({ success: false, message: 'Email verifikasi belum bisa dikirim. Coba lagi sebentar.' });
  }
});

router.get('/verify-email', async (req, res) => {
  try {
    const tokenResult = verifyEmailSchema.safeParse(req.query);
    if (!tokenResult.success) return res.status(400).json({ success: false, message: 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.' });
    const user = await consumeEmailVerificationToken(tokenResult.data.token);
    if (!user) return res.status(400).json({ success: false, message: 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.' });
    await prisma.auditLog.create({ data: { entityType: 'User', entityId: user.id, field: 'emailVerification', newValue: 'verified', changedById: user.id } });
    return res.json({ success: true, message: 'Email berhasil diverifikasi. Anda bisa masuk ke Glosir.' });
  } catch (error) {
    console.error('Email verification failed:', error.message);
    return res.status(503).json({ success: false, message: 'Verifikasi email belum bisa diproses.' });
  }
});

router.post('/request-password-reset', emailActionLimiter, validateBody(requestPasswordResetSchema), async (req, res) => {
  const neutralMessage = 'Jika email terdaftar, tautan reset password sudah dikirim.';
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user?.isActive) {
      const token = await createPasswordResetToken(user.id);
      const actionUrl = appUrl('reset-password', token);
      await sendEmail({
        to: user.email,
        userId: user.id,
        type: 'PASSWORD_RESET',
        subject: 'Reset password Glosir',
        text: `Buka tautan ini untuk membuat password baru: ${actionUrl}`,
        html: renderActionEmail({ title: 'Reset password Glosir', message: 'Tautan ini berlaku selama 1 jam dan hanya bisa dipakai sekali.', actionLabel: 'Buat password baru', actionUrl }),
      });
      await prisma.auditLog.create({ data: { entityType: 'User', entityId: user.id, field: 'passwordReset', newValue: 'requested', changedById: user.id } });
    }
    return res.json({ success: true, message: neutralMessage });
  } catch (error) {
    console.error('Password reset request failed:', error.message);
    return res.json({ success: true, message: neutralMessage });
  }
});

router.post('/reset-password', emailActionLimiter, validateBody(resetPasswordSchema), async (req, res) => {
  try {
    const user = await consumePasswordResetToken(req.body.token, req.body.newPassword);
    if (!user) return res.status(400).json({ success: false, message: 'Tautan reset tidak valid atau sudah kedaluwarsa.' });
    await prisma.auditLog.create({ data: { entityType: 'User', entityId: user.id, field: 'password', newValue: 'reset', changedById: user.id } });
    return res.json({ success: true, message: 'Password berhasil dibuat. Silakan masuk.' });
  } catch (error) {
    console.error('Password reset failed:', error.message);
    return res.status(503).json({ success: false, message: 'Password belum berhasil diubah. Coba lagi.' });
  }
});

router.post('/invite', authenticateToken, requireRole('OWNER'), emailActionLimiter, validateBody(inviteUserSchema), async (req, res) => {
  try {
    const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (existing) return res.status(409).json({ success: false, message: 'Email tersebut sudah terdaftar.' });
    const user = await prisma.user.create({ data: { name: req.body.name, email: req.body.email, phone: req.body.phone || null, role: req.body.role, passwordHash: 'disabled' } });
    const token = await createPasswordResetToken(user.id, 48);
    const actionUrl = appUrl('reset-password', token);
    await sendEmail({
      to: user.email,
      userId: user.id,
      type: 'USER_INVITATION',
      subject: 'Undangan akun Glosir',
      text: `Anda diundang ke Glosir. Buat password melalui: ${actionUrl}`,
      html: renderActionEmail({ title: 'Undangan akun Glosir', message: 'Buat password Anda sendiri melalui tautan berikut. Tautan berlaku selama 48 jam.', actionLabel: 'Buat password', actionUrl }),
    });
    await prisma.auditLog.create({ data: { entityType: 'User', entityId: user.id, field: 'invitation', newValue: req.body.role, changedById: req.user.id } });
    return res.status(201).json({ success: true, message: 'Undangan sudah dikirim ke email karyawan.' });
  } catch (error) {
    console.error('User invitation failed:', error.message);
    return res.status(503).json({ success: false, message: 'Undangan belum bisa dikirim. Coba lagi.' });
  }
});

router.get('/me/notification-preferences', authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { notificationPreferences: true } });
  return res.json({ success: true, preferences: getNotificationPreferences(user?.notificationPreferences) });
});

router.patch('/me/notification-preferences', authenticateToken, async (req, res) => {
  const parsed = notificationPreferencesSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Pilihan notifikasi belum valid.' });
  const preferences = getNotificationPreferences(parsed.data);
  await prisma.user.update({ where: { id: req.user.id }, data: { notificationPreferences: preferences } });
  await prisma.auditLog.create({ data: { entityType: 'User', entityId: req.user.id, field: 'notificationPreferences', newValue: JSON.stringify(preferences), changedById: req.user.id } });
  return res.json({ success: true, message: 'Pilihan notifikasi berhasil disimpan.', preferences });
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.patch('/me/dashboard-layout', authenticateToken, async (req, res) => {
  const layout = Array.isArray(req.body?.layout) ? req.body.layout.map(String).slice(0, 20) : null;
  if (!layout) return res.status(400).json({ success: false, message: 'Layout dashboard tidak valid.' });
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { dashboardLayout: layout }, select: { dashboardLayout: true } });
  return res.json({ success: true, data: user.dashboardLayout });
});

router.get('/owner-demo', authenticateToken, requireRole('OWNER'), (req, res) => {
  res.json({ success: true, message: 'Akses owner berhasil', user: req.user });
});

router.get('/cashier-demo', authenticateToken, requireRole('CASHIER'), (req, res) => {
  res.json({ success: true, message: 'Akses kasir berhasil', user: req.user });
});

export default router;
