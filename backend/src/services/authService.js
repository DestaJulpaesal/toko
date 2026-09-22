import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/db.js';
import { createToken, hashToken } from './emailService.js';
<<<<<<< HEAD
=======
import { sessions } from './sessionService.js';
>>>>>>> cbd8857 (push fitur notifikasi email)

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET wajib di-set di environment variable');
  return process.env.JWT_SECRET;
};

const googleClient = new OAuth2Client();

<<<<<<< HEAD
export function generateToken(user, rememberMe = false) {
=======
// `tv` = nomor versi token. Saat password diganti atau "keluar dari perangkat lain", nomor di database naik
// sehingga token lama otomatis ditolak (lihat sessionService.js).
// `expiresInSeconds` dipakai untuk token pengganti agar masa sesinya tidak berubah.
export function generateToken(user, rememberMe = false, expiresInSeconds = null) {
>>>>>>> cbd8857 (push fitur notifikasi email)
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      regionId: user.regionId || null,
<<<<<<< HEAD
    },
    getJwtSecret(),
    { expiresIn: user.role === 'OWNER' && rememberMe ? '30d' : '8h' }
=======
      tv: Number(user.tokenVersion ?? 0),
    },
    getJwtSecret(),
    { expiresIn: expiresInSeconds || (user.role === 'OWNER' && rememberMe ? '30d' : '8h') }
>>>>>>> cbd8857 (push fitur notifikasi email)
  );
}

export async function verifyCredentials(email, password) {
  const normalizedEmail = email?.trim().toLowerCase();

  const users = await prisma.$queryRaw`
<<<<<<< HEAD
    SELECT "id", "name", "email", "role", "isActive", "regionId", "emailVerifiedAt",
=======
    SELECT "id", "name", "email", "role", "isActive", "regionId", "emailVerifiedAt", "tokenVersion",
>>>>>>> cbd8857 (push fitur notifikasi email)
      (crypt('123456', "passwordHash") = "passwordHash") AS "mustChangePassword"
    FROM "User"
    WHERE lower("email") = ${normalizedEmail}
      AND "isActive" = true
      AND crypt(${password}, "passwordHash") = "passwordHash"
    LIMIT 1
  `;

  if (users[0]) return users[0];
  return null;
}

export async function verifyGoogleCredential(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error('Google login belum dikonfigurasi.');
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified !== true) return null;
  return prisma.user.findFirst({
    where: { email: payload.email.toLowerCase(), isActive: true },
<<<<<<< HEAD
    select: { id: true, name: true, email: true, role: true, regionId: true, emailVerifiedAt: true },
  });
}

=======
    select: { id: true, name: true, email: true, role: true, regionId: true, emailVerifiedAt: true, tokenVersion: true },
  });
}

// Mengganti password sekaligus mencabut SEMUA sesi lama (tokenVersion naik).
// Mengembalikan data user terbaru supaya perangkat yang sedang dipakai bisa diberi token pengganti.
>>>>>>> cbd8857 (push fitur notifikasi email)
export async function changePassword(userId, newPassword) {
  const hashRows = await prisma.$queryRaw`
    SELECT crypt(${newPassword}, gen_salt('bf')) AS hash
  `;
<<<<<<< HEAD
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashRows[0].hash },
  });
=======
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashRows[0].hash, tokenVersion: { increment: 1 } },
    select: { id: true, name: true, email: true, role: true, regionId: true, tokenVersion: true },
  });
  sessions.invalidate(userId);
  return user;
}

// "Keluar dari perangkat lain": cabut semua sesi, lalu beri token baru untuk perangkat yang sedang dipakai.
export async function revokeOtherSessions(userId) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { id: true, name: true, email: true, role: true, regionId: true, tokenVersion: true },
  });
  sessions.invalidate(userId);
  return user;
>>>>>>> cbd8857 (push fitur notifikasi email)
}

export async function createEmailVerificationToken(userId, expiresInHours = 24) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerificationTokenHash: hashToken(token), emailVerificationExpiresAt: expiresAt },
  });
  return token;
}

export async function createPasswordResetToken(userId, expiresInHours = 1) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: expiresAt },
  });
  return token;
}

export async function consumeEmailVerificationToken(token) {
  const user = await prisma.user.findFirst({ where: { emailVerificationTokenHash: hashToken(token), emailVerificationExpiresAt: { gt: new Date() } } });
  if (!user) return null;
  return prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationExpiresAt: null },
  });
}

export async function consumePasswordResetToken(token, newPassword) {
  const user = await prisma.user.findFirst({ where: { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: { gt: new Date() } } });
  if (!user) return null;
  const hashRows = await prisma.$queryRaw`SELECT crypt(${newPassword}, gen_salt('bf')) AS hash`;
<<<<<<< HEAD
  return prisma.user.update({
=======
  const updated = await prisma.user.update({
>>>>>>> cbd8857 (push fitur notifikasi email)
    where: { id: user.id },
    data: {
      passwordHash: hashRows[0].hash,
      emailVerifiedAt: user.emailVerifiedAt || new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
<<<<<<< HEAD
    },
  });
=======
      tokenVersion: { increment: 1 }, // reset password = anggap akun mungkin diambil orang lain, cabut semua sesi lama
    },
  });
  sessions.invalidate(updated.id);
  return updated;
>>>>>>> cbd8857 (push fitur notifikasi email)
}
